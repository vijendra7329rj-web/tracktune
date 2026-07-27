import { Router } from "express";
import { db } from "../db.js";
import { songsTable, historyTable } from "../schema.js";
import { eq, and } from "drizzle-orm";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import axios from "axios";
import FormData from "form-data";
import { execFile } from "child_process";
import { promisify } from "util";

const router = Router();
const execFileAsync = promisify(execFile);

// Custom transparent child_process wrapper to invoke yt-dlp CLI
async function youtubedl(url, options) {
  const getBinaryPath = () => {
    if (fs.existsSync("/usr/local/bin/yt-dlp")) return "/usr/local/bin/yt-dlp";
    if (fs.existsSync("/tmp/yt-dlp")) return "/tmp/yt-dlp";
    // Check standard node_modules paths
    const nodeModulesPath = path.resolve("node_modules/yt-dlp-exec/bin/yt-dlp");
    if (fs.existsSync(nodeModulesPath)) return nodeModulesPath;
    const nodeModulesExePath = path.resolve("node_modules/yt-dlp-exec/bin/yt-dlp.exe");
    if (fs.existsSync(nodeModulesExePath)) return nodeModulesExePath;
    return "yt-dlp";
  };

  const binary = getBinaryPath();
  const args = [url];
  
  if (options.output) args.push("--output", options.output);
  if (options.extractAudio) args.push("--extract-audio");
  if (options.audioFormat) args.push("--audio-format", options.audioFormat);
  if (options.noWarnings) args.push("--no-warnings");
  if (options.noCallHome) args.push("--no-call-home");
  if (options.cookies) args.push("--cookies", options.cookies);
  if (options.addHeader) {
    for (const header of options.addHeader) {
      args.push("--add-header", header);
    }
  }

  console.log(`[EXEC] Running command: ${binary} ${args.join(" ")}`);
  
  return execFileAsync(binary, args, {
    timeout: 60000,
    maxBuffer: 1024 * 1024 * 10,
  });
}

const SAMPLE_SECONDS = 4;
const MAX_ATTEMPTS = Number(process.env.MAX_RECOGNITION_ATTEMPTS || 8);
const HIGH_CONFIDENCE_SCORE = Number(process.env.HIGH_CONFIDENCE_SCORE || 80);
const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE_PATH = process.env.FFPROBE_PATH || "ffprobe";

// ── STARTUP DIAGNOSTICS (will print when container boots) ──
console.log("\n=== TRACKTUNE STARTUP DIAGNOSTICS ===");
console.log("RAPIDAPI_KEY exists:", "RAPIDAPI_KEY" in process.env);
console.log("RAPIDAPI_KEY typeof:", typeof process.env.RAPIDAPI_KEY);
console.log("RAPIDAPI_KEY length:", process.env.RAPIDAPI_KEY ? process.env.RAPIDAPI_KEY.length : "(undefined)");
console.log("RAPIDAPI_KEY truthy:", !!process.env.RAPIDAPI_KEY);
console.log("RAPIDAPI_KEY first 4 chars:", process.env.RAPIDAPI_KEY ? process.env.RAPIDAPI_KEY.substring(0, 4) + "..." : "(none)");
console.log("All env keys containing RAPID:", Object.keys(process.env).filter(k => k.toUpperCase().includes("RAPID")));
console.log("All env keys containing API:", Object.keys(process.env).filter(k => k.toUpperCase().includes("API")));
console.log("=== END DIAGNOSTICS ===\n");

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function extractUrl(text) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  return matches ? matches[0] : null;
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isUnknownValue(value) {
  const normalized = value.trim().toLowerCase();
  return normalized === "" || normalized === "unknown" || normalized === "unknown title" || normalized === "unknown artist";
}

function uniqueKey(match) {
  return `${match.title.toLowerCase()}::${match.artist.toLowerCase()}`;
}

function getSpotifyUrl(spotifyId) {
  return spotifyId ? `https://open.spotify.com/track/${spotifyId}` : "";
}

function getYoutubeUrl(youtubeId) {
  return youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : "";
}

function getYoutubeId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

async function runTool(command, args, timeout = 30000) {
  const result = await execFileAsync(command, args, {
    timeout,
    maxBuffer: 1024 * 1024 * 10,
    encoding: "utf8",
  });
  return {
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
  };
}

async function getDurationSeconds(filePath) {
  try {
    const { stdout } = await runTool(
      FFPROBE_PATH,
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath],
      20000,
    );
    const duration = Number.parseFloat(stdout.trim());
    return Number.isFinite(duration) && duration > 0 ? duration : SAMPLE_SECONDS;
  } catch (error) {
    console.warn("ffprobe duration failed, falling back to 10 seconds", error);
    return SAMPLE_SECONDS;
  }
}

function dedupeStarts(starts) {
  const seen = new Set();
  return starts.filter((item) => {
    const rounded = Math.max(0, Math.round(item.start));
    if (seen.has(rounded)) return false;
    seen.add(rounded);
    item.start = rounded;
    return true;
  });
}

async function buildSamplePlans(sourcePath, tempDir, debugId) {
  const duration = await getDurationSeconds(sourcePath);
  const maxStart = Math.max(0, duration - SAMPLE_SECONDS);

  // Directly check from middle (drop/chorus), start, and end of the track (no CPU volume checks)
  const baseStarts = dedupeStarts([
    { label: "middle", start: maxStart * 0.5 },
    { label: "start", start: 0 },
    { label: "end", start: maxStart },
  ]);

  const normalized = "aresample=44100,highpass=f=200,lowpass=f=4000,dynaudnorm=f=150:g=15";
  const plans = [];

  for (const base of baseStarts) {
    plans.push({
      label: `${base.label}-clean`,
      start: base.start,
      filter: normalized,
      path: path.join(tempDir, `${debugId}_${base.label}_clean.raw`),
    });
  }

  const priorityBase = baseStarts[0] || { label: "middle", start: maxStart * 0.5 };
  const variants = [
    { suffix: "slowed", filter: `atempo=0.92,${normalized}` },
    { suffix: "sped", filter: `atempo=1.08,${normalized}` },
    { suffix: "pitch-down", filter: `asetrate=41454,aresample=44100,atempo=1.064,highpass=f=200,lowpass=f=4000,dynaudnorm=f=150:g=15` },
    { suffix: "pitch-up", filter: `asetrate=46746,aresample=44100,atempo=0.943,highpass=f=200,lowpass=f=4000,dynaudnorm=f=150:g=15` },
  ];

  for (const variant of variants) {
    plans.push({
      label: `${priorityBase.label}-${variant.suffix}`,
      start: priorityBase.start,
      filter: variant.filter,
      path: path.join(tempDir, `${debugId}_${priorityBase.label}_${variant.suffix}.raw`),
    });
  }
  return plans.slice(0, Math.max(1, MAX_ATTEMPTS));
}

async function createSample(sourcePath, plan) {
  // Output raw signed 16-bit PCM little-endian mono audio sampled at 44100Hz
  await runTool(
    FFMPEG_PATH,
    ["-hide_banner", "-y", "-ss", plan.start.toFixed(2), "-t", SAMPLE_SECONDS.toString(), "-i", sourcePath, "-vn", "-ac", "1", "-ar", "44100", "-af", plan.filter, "-f", "s16le", "-acodec", "pcm_s16le", plan.path],
    60000,
  );
}

async function identifyWithShazam(samplePath, plan) {
  const apiKey = process.env.RAPIDAPI_KEY ? process.env.RAPIDAPI_KEY.trim() : null;
  if (!apiKey) throw new Error("TrackTune is missing the RAPIDAPI_KEY environment variable.");

  const rawBuffer = fs.readFileSync(samplePath);
  const base64Audio = rawBuffer.toString("base64");

  const response = await axios.post("https://shazam.p.rapidapi.com/songs/v2/detect", base64Audio, {
    headers: {
      "content-type": "text/plain",
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": "shazam.p.rapidapi.com"
    },
    timeout: 25000
  });

  const track = response.data?.track;
  if (!track) {
    return { matches: [] };
  }

  const title = cleanText(track.title);
  const artist = cleanText(track.subtitle);
  const album = cleanText(track.sections?.[0]?.metadata?.find(m => m.title === "Album")?.text || "");
  const genre = cleanText(track.genres?.primary || "Pop");

  // Construct fallback search URLs for Spotify and YouTube
  const searchTerms = `${artist} ${title}`;
  const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(searchTerms)}`;
  const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerms)}`;

  const match = {
    title,
    artist,
    album,
    year: new Date().getFullYear(),
    genre,
    spotifyId: "",
    youtubeId: "",
    spotifyUrl,
    youtubeUrl,
    score: 100,
    matchedSample: plan.label,
    recognitionMethod: "shazam-rapidapi",
  };

  return { matches: [match] };
}

function chooseBestMatch(matches) {
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => b.score - a.score)[0] || null;
}

function topUniqueMatches(matches) {
  const byKey = new Map();
  for (const match of matches) {
    const existing = byKey.get(uniqueKey(match));
    if (!existing || match.score > existing.score) byKey.set(uniqueKey(match), match);
  }
  return [...byKey.values()].sort((a, b) => b.score - a.score).slice(0, 3);
}

// ─────────────────────────────────────────────
// Core Download Function - Uses a Failover Chain of Public Download Mirrors
// ─────────────────────────────────────────────

// List of public Cobalt instances that process audio conversions for us
const COBALT_MIRRORS = [
  "https://cobalt.hyper.us.kg/",
  "https://api.smooth.cafe/",
  "https://cobalt.sh.alby.im/",
  "https://cobalt.foxtrot.us.kg/",
  "https://cobalt.perennial.us.kg/",
  "https://co.wuk.sh/api/json",
  "https://api.cobalt.tools",
  "https://api.cobalt.tools/"
];

async function downloadViaMirror(url, targetPath, debugId) {
  let lastError = null;

  for (const mirror of COBALT_MIRRORS) {
    try {
      console.log(`[${debugId}] Attempting mirror download from: ${mirror}`);
      const response = await axios.post(mirror, {
        url: url,
        codec: "mp3",
        downloadMode: "audio",
        audioFormat: "mp3"
      }, {
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 15000
      });

      const downloadUrl = response.data?.url;
      if (!downloadUrl) {
        throw new Error(`Mirror ${mirror} did not return direct download link.`);
      }

      console.log(`[${debugId}] Mirror succeeded. Downloading audio payload from CDN...`);
      
      // Download actual audio file from CDN link returned by the mirror
      const fileResponse = await axios({
        method: "get",
        url: downloadUrl,
        responseType: "stream",
        timeout: 25000
      });

      const writer = fs.createWriteStream(targetPath);
      fileResponse.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      console.log(`[${debugId}] File saved successfully. Size: ${fs.statSync(targetPath).size} bytes`);
      return true;
    } catch (err) {
      console.warn(`[${debugId}] Mirror ${mirror} failed:`, err.message);
      lastError = err;
    }
  }

  throw new Error(`All download mirrors failed. Last error: ${lastError?.message}`);
}

async function downloadViaRapidAPI(url, targetPath, debugId) {
  const apiKey = process.env.RAPIDAPI_KEY ? process.env.RAPIDAPI_KEY.trim() : null;
  if (!apiKey) {
    throw new Error("No RAPIDAPI_KEY found in environment variables.");
  }

  console.log(`[${debugId}] Attempting download via Social Download All In One API...`);
  
  // Call the highly stable Social Download All In One on RapidAPI
  const response = await axios.post("https://social-download-all-in-one.p.rapidapi.com/v1/social/autolink", {
    url: url
  }, {
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": "social-download-all-in-one.p.rapidapi.com"
    },
    timeout: 15000
  });

  // Find direct MP4/MP3 download link in the standardized medias array
  const medias = response.data?.medias || [];
  const audioMedia = medias.find(m => m.type === "audio" || m.extension === "mp3" || m.quality === "audio") || medias.find(m => m.extension === "mp4") || medias[0];
  const downloadUrl = audioMedia?.url;

  if (!downloadUrl) {
    throw new Error("RapidAPI response did not contain a valid download URL.");
  }

  console.log(`[${debugId}] RapidAPI success! Download URL: ${downloadUrl.substring(0, 80)}...`);

  const fileResponse = await axios({
    method: "get",
    url: downloadUrl,
    responseType: "stream",
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.google.com/",
      "Connection": "keep-alive"
    }
  });

  const writer = fs.createWriteStream(targetPath);
  fileResponse.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  console.log(`[${debugId}] RapidAPI file saved. Size: ${fs.statSync(targetPath).size} bytes`);
  return true;
}

async function downloadViaRapidAPIBackup(url, targetPath, debugId) {
  const apiKey = process.env.RAPIDAPI_KEY ? process.env.RAPIDAPI_KEY.trim() : null;
  if (!apiKey) {
    throw new Error("No RAPIDAPI_KEY found in environment variables.");
  }

  console.log(`[${debugId}] Attempting download via Backup RapidAPI (Downloader B)...`);
  
  // Call the backup All-in-One Downloader on RapidAPI
  const response = await axios.get("https://all-in-one-video-downloader.p.rapidapi.com/index.php", {
    params: { url: url },
    headers: {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": "all-in-one-video-downloader.p.rapidapi.com"
    },
    timeout: 15000
  });

  // Find direct MP4/MP3 download link
  const links = response.data?.links || [];
  const audioLinkObj = links.find(l => l.quality === "audio" || l.link?.includes(".mp3") || l.link?.includes("audio") || l.link?.includes("music")) || response.data?.video || response.data?.audio || links[0];
  const downloadUrl = typeof audioLinkObj === "string" ? audioLinkObj : audioLinkObj?.link || response.data?.url;

  if (!downloadUrl) {
    throw new Error("Backup RapidAPI response did not contain a valid media download URL.");
  }

  console.log(`[${debugId}] Backup RapidAPI success! Download URL: ${downloadUrl.substring(0, 80)}...`);

  const fileResponse = await axios({
    method: "get",
    url: downloadUrl,
    responseType: "stream",
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.google.com/",
      "Connection": "keep-alive"
    }
  });

  const writer = fs.createWriteStream(targetPath);
  fileResponse.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  console.log(`[${debugId}] Backup RapidAPI file saved. Size: ${fs.statSync(targetPath).size} bytes`);
  return true;
}

async function downloadAudio(url, sourceTemplate, debugId) {
  const tempDir = "/tmp";
  const mirrorPath = path.join(tempDir, `tracktune_${debugId}_source.mp3`);

  // ── Bulletproof RapidAPI key detection ──
  // Search ALL env vars for anything containing "RAPID" (handles typos, whitespace in key names)
  let rapidApiKey = process.env.RAPIDAPI_KEY ? process.env.RAPIDAPI_KEY.trim() : null;
  if (!rapidApiKey) {
    const allRapidKeys = Object.keys(process.env).filter(k => k.toUpperCase().includes("RAPID"));
    console.log(`[${debugId}] RAPIDAPI_KEY not found directly. Scanning env... found keys:`, allRapidKeys);
    for (const altKey of allRapidKeys) {
      const val = process.env[altKey]?.trim();
      if (val && val.length > 10) {
        console.log(`[${debugId}] Using alternate key name: "${altKey}" (length=${val.length})`);
        rapidApiKey = val;
        break;
      }
    }
  }

  console.log(`[${debugId}] RapidAPI key available: ${!!rapidApiKey}, length: ${rapidApiKey ? rapidApiKey.length : 0}`);

  // 1. First Priority: Try Premium RapidAPI Downloader A
  if (rapidApiKey) {
    // Temporarily set process.env so the download functions can read it
    process.env.RAPIDAPI_KEY = rapidApiKey;
    try {
      await downloadViaRapidAPI(url, mirrorPath, debugId);
      return mirrorPath;
    } catch (rapidError) {
      console.warn(`[${debugId}] Premium RapidAPI Downloader A failed, trying Downloader B...`, rapidError.message);
      
      // Fallback to Downloader B using the exact same key!
      try {
        await downloadViaRapidAPIBackup(url, mirrorPath, debugId);
        return mirrorPath;
      } catch (backupError) {
        console.warn(`[${debugId}] Premium RapidAPI Downloader B failed, trying fallback mirrors...`, backupError.message);
      }
    }
  } else {
    console.error(`[${debugId}] *** CRITICAL: No RapidAPI key found in ANY environment variable! Skipping premium downloaders. ***`);
  }

  // 2. Second Priority: Try public mirrors (Failover chain)
  try {
    await downloadViaMirror(url, mirrorPath, debugId);
    return mirrorPath;
  } catch (mirrorError) {
    console.warn(`[${debugId}] Public mirror chain failed, falling back to local yt-dlp...`, mirrorError.message);
  }

  // 2. Local yt-dlp fallback (uses Android bypass + Cookies)
  const ytdlpOptions = {
    f: "bestaudio",
    output: sourceTemplate,
    noWarnings: true,
    noCallHome: true,
    addHeader: [
      "User-Agent:Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36",
      "Accept-Language:en-US,en;q=0.9"
    ]
  };

  const cookiesEnv = process.env.YOUTUBE_COOKIES;
  let cookieFilePath = null;
  
  if (cookiesEnv) {
    cookieFilePath = path.join(tempDir, `yt_cookies_${debugId}.txt`);
    try {
      fs.writeFileSync(cookieFilePath, cookiesEnv, "utf8");
      ytdlpOptions.cookies = cookieFilePath;
      console.log(`[${debugId}] Using YouTube cookies from environment`);
    } catch (e) {
      console.warn(`[${debugId}] Failed to write cookie file:`, e.message);
    }
  } else {
    ytdlpOptions.extractorArgs = "youtube:player_client=android,web";
    console.log(`[${debugId}] No cookies found, using Android client bypass`);
  }

  try {
    console.log(`[${debugId}] Downloading audio locally for: ${url}`);
    await youtubedl(url, ytdlpOptions);

    const files = fs.readdirSync(tempDir);
    const downloadedFile = files.find((f) => f.startsWith(`tracktune_${debugId}_source.`));
    
    if (!downloadedFile) {
      throw new Error("Download failed - local file not created");
    }
    
    const sourcePath = path.join(tempDir, downloadedFile);
    console.log(`[${debugId}] Local yt-dlp success. Size: ${fs.statSync(sourcePath).size} bytes`);
    return sourcePath;
  } finally {
    if (cookieFilePath && fs.existsSync(cookieFilePath)) {
      try { fs.unlinkSync(cookieFilePath); } catch (e) {}
    }
  }
}

// ─────────────────────────────────────────────
// Main Route
// ─────────────────────────────────────────────

router.post("/identify", async (req, res) => {
  const debugId = crypto.randomUUID();
  let rawUrl = req.body.url || "";
  
  console.log(`[${debugId}] DIAGNOSTIC - RAPIDAPI_KEY exists:`, !!process.env.RAPIDAPI_KEY);
  if (process.env.RAPIDAPI_KEY) {
    console.log(`[${debugId}] DIAGNOSTIC - RAPIDAPI_KEY length:`, process.env.RAPIDAPI_KEY.length);
  }
  
  const url = extractUrl(rawUrl);
  if (!url) return res.status(400).json({ error: "Please share or paste a valid public video URL.", debugId });

  const tempDir = "/tmp";
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const sourceTemplate = path.join(tempDir, `tracktune_${debugId}_source.%(ext)s`);
  const tempFiles = [];

  try {
    const sourcePath = await downloadAudio(url, sourceTemplate, debugId);
    tempFiles.push(sourcePath);

    const fileSize = fs.statSync(sourcePath).size;
    console.log(`[${debugId}] Source audio file size: ${fileSize} bytes`);

    const samplePlans = await buildSamplePlans(sourcePath, tempDir, debugId);
    tempFiles.push(...samplePlans.map((plan) => plan.path));

    const allMatches = [];
    let bestMatch = null;

    for (const plan of samplePlans) {
      console.log(`[${debugId}] Creating sample ${plan.label} from ${plan.start}s`);
      await createSample(sourcePath, plan);
      console.log(`[${debugId}] Sending sample ${plan.label} to Shazam API`);
      const result = await identifyWithShazam(plan.path, plan);
      allMatches.push(...result.matches);
      bestMatch = chooseBestMatch(allMatches);

      if (bestMatch && bestMatch.score >= HIGH_CONFIDENCE_SCORE) break;
    }

    const possibleMatches = topUniqueMatches(allMatches);
    bestMatch = chooseBestMatch(possibleMatches);

    if (!bestMatch) {
      return res.status(404).json({
        error: "TrackTune could not identify this song. The audio may be too edited, noisy, or missing from the catalog.",
        confidence: 0, matchedSample: "", recognitionMethod: "acrcloud-multi-sample-v2", possibleMatches: [], debugId,
      });
    }

    let song = null;
    const existingSongs = await db.select().from(songsTable)
      .where(and(eq(songsTable.title, bestMatch.title), eq(songsTable.artist, bestMatch.artist)))
      .limit(1);

    if (existingSongs.length > 0) {
      song = existingSongs[0];
    } else {
      const [newSong] = await db.insert(songsTable).values({
        title: bestMatch.title, artist: bestMatch.artist, album: bestMatch.album,
        year: bestMatch.year, genre: bestMatch.genre, spotifyId: bestMatch.spotifyId,
        youtubeId: bestMatch.youtubeId, spotifyUrl: bestMatch.spotifyUrl,
        youtubeUrl: bestMatch.youtubeUrl, previewUrl: null,
      }).returning();
      song = newSong;
    }

    await db.insert(historyTable).values({
      songId: song.id, title: song.title, artist: song.artist, genre: song.genre,
      spotifyUrl: song.spotifyUrl, youtubeUrl: song.youtubeUrl,
      spotifyId: song.spotifyId, youtubeId: song.youtubeId,
    });

    return res.json({
      id: song.id, title: song.title, artist: song.artist, album: song.album, year: song.year, genre: song.genre,
      spotifyUrl: song.spotifyUrl, youtubeUrl: song.youtubeUrl, previewUrl: song.previewUrl,
      confidence: bestMatch.score, matchedSample: bestMatch.matchedSample,
      recognitionMethod: bestMatch.recognitionMethod, possibleMatches, debugId,
    });
  } catch (error) {
    console.error(`[${debugId}] Identification Error:`, error);
    let message = "TrackTune could not process this video. Try another link.";
    if (error?.code === "ENOENT") message = "Server missing FFmpeg/yt-dlp.";
    if (error?.message?.includes("Sign in") || error?.message?.includes("bot")) {
      message = "YouTube is blocking this request. Please add YOUTUBE_COOKIES to Render environment variables.";
    }
    return res.status(500).json({ error: message, confidence: 0, matchedSample: "", recognitionMethod: "shazam-rapidapi", possibleMatches: [], debugId });
  } finally {
    for (const file of tempFiles) {
      if (fs.existsSync(file)) {
        try { fs.unlinkSync(file); } catch (e) {}
      }
    }
  }
});

export default router;
