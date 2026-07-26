import { Router } from "express";
import { db } from "../db.js";
import { songsTable, historyTable } from "../schema.js";
import { eq, and } from "drizzle-orm";
import defaultYoutubedl, { create as createYoutubeDl } from "yt-dlp-exec";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import axios from "axios";
import FormData from "form-data";
import { execFile } from "child_process";
import { promisify } from "util";

const getBinaryPath = () => {
  if (fs.existsSync("/usr/local/bin/yt-dlp")) return "/usr/local/bin/yt-dlp";
  if (fs.existsSync("/tmp/yt-dlp")) return "/tmp/yt-dlp";
  return null;
};

const binaryPath = getBinaryPath();
const youtubedl = binaryPath ? createYoutubeDl(binaryPath) : defaultYoutubedl;

const router = Router();
const execFileAsync = promisify(execFile);

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
  const rounded = starts.map(s => Math.round(s));
  return [...new Set(rounded)];
}

// Generates multiple starting offsets for ACRCloud recognition
async function getOffsetSeconds(filePath) {
  const duration = await getDurationSeconds(filePath);
  if (duration <= SAMPLE_SECONDS) {
    return [0];
  }
  if (duration <= 15) {
    return dedupeStarts([0, Math.max(0, duration - SAMPLE_SECONDS)]);
  }
  
  const mid = duration / 2;
  const third = duration / 3;
  const offsets = [
    0,
    third - SAMPLE_SECONDS / 2,
    mid - SAMPLE_SECONDS / 2,
    (2 * third) - SAMPLE_SECONDS / 2,
    duration - SAMPLE_SECONDS - 1
  ];
  
  return dedupeStarts(offsets.filter(o => o >= 0 && o <= duration - SAMPLE_SECONDS));
}

// Extracts a short 4-second audio clip at a specific timestamp
async function extractSegment(sourcePath, offset, tempDir, debugId) {
  const outputPath = path.join(tempDir, `tracktune_${debugId}_segment_${offset}.mp3`);
  
  try {
    await runTool(
      FFMPEG_PATH,
      ["-y", "-ss", String(offset), "-t", String(SAMPLE_SECONDS), "-i", sourcePath, "-vn", "-acodec", "libmp3lame", "-ar", "8000", "-ac", "1", "-ab", "32k", outputPath],
      20000
    );
    if (fs.existsSync(outputPath)) {
      return outputPath;
    }
  } catch (err) {
    console.warn(`[${debugId}] Failed to extract segment at ${offset}s:`, err.message);
  }
  return null;
}

// ── Download Video Helper ──

const COBALT_MIRRORS = [
  "https://co.wuk.sh/api/json",
  "https://api.cobalt.tools",
  "https://cobalt.shizuku.io/api/json",
  "https://cobalt.xyz/api/json"
];

async function downloadViaMirror(url, targetPath, debugId) {
  let lastError = null;
  for (const mirror of COBALT_MIRRORS) {
    try {
      console.log(`[${debugId}] Attempting mirror download from: ${mirror}`);
      const response = await axios.post(mirror, {
        url: url,
        codec: "mp3",
        downloadMode: "audio"
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

      console.log(`[${debugId}] Mirror succeeded. Downloading audio payload...`);
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

      console.log(`[${debugId}] Audio saved. Size: ${fs.statSync(targetPath).size} bytes`);
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
    throw new Error("Missing RAPIDAPI_KEY");
  }

  console.log(`[${debugId}] Downloading video via RapidAPI downloader service...`);
  const options = {
    method: 'GET',
    url: 'https://social-media-video-downloader.p.rapidapi.com/api/v1/social/autolink',
    params: { url: url },
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'social-media-video-downloader.p.rapidapi.com'
    },
    timeout: 15000
  };

  const response = await axios.request(options);
  const downloadUrl = response.data?.links?.[0]?.link || response.data?.url;
  
  if (!downloadUrl) {
    throw new Error("RapidAPI response did not contain a valid media download URL.");
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

async function downloadAudio(url, sourceTemplate, debugId) {
  const tempDir = "/tmp";
  const mirrorPath = path.join(tempDir, `tracktune_${debugId}_source.mp3`);

  // Try RapidAPI first for high reliability (Instagram, TikTok bypass)
  try {
    const hasApiKey = !!process.env.RAPIDAPI_KEY;
    if (hasApiKey) {
      await downloadViaRapidAPI(url, mirrorPath, debugId);
      return mirrorPath;
    } else {
      console.warn(`[${debugId}] RAPIDAPI_KEY not found. Skipping RapidAPI.`);
    }
  } catch (err) {
    console.warn(`[${debugId}] RapidAPI downloader failed, trying Cobalt mirror...`, err.message);
  }

  // Try public mirrors next (to avoid local IP blocks)
  try {
    await downloadViaMirror(url, mirrorPath, debugId);
    return mirrorPath;
  } catch (mirrorError) {
    console.warn(`[${debugId}] Public mirror chain failed, falling back to local yt-dlp...`, mirrorError.message);
  }

  // Local yt-dlp fallback
  const ytdlpOptions = {
    output: sourceTemplate,
    extractAudio: true,
    audioFormat: "mp3",
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
    } catch (e) {
      console.warn("Failed to write cookies file:", e.message);
    }
  }

  try {
    console.log(`[${debugId}] Downloading video locally for: ${url}`);
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

// ── ACRCloud Recognition API Call ──

async function recognizeAudio(filePath, debugId) {
  const host = process.env.ACR_HOST?.trim();
  const accessKey = process.env.ACR_ACCESS_KEY?.trim();
  const accessSecret = process.env.ACR_ACCESS_SECRET?.trim();

  if (!host || !accessKey || !accessSecret) {
    throw new Error("TrackTune is missing ACRCloud recognition configurations.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const stringToSign = [
    "POST",
    "/v1/identify",
    accessKey,
    "audio",
    "1",
    String(timestamp)
  ].join("\n");

  const signature = crypto
    .createHmac("sha1", accessSecret)
    .update(stringToSign)
    .digest()
    .toString("base64");

  const form = new FormData();
  form.append("sample", fs.createReadStream(filePath));
  form.append("sample_bytes", String(fs.statSync(filePath).size));
  form.append("access_key", accessKey);
  form.append("data_type", "audio");
  form.append("signature_version", "1");
  form.append("signature", signature);
  form.append("timestamp", String(timestamp));

  const response = await axios.post(`https://${host}/v1/identify`, form, {
    headers: form.getHeaders(),
    timeout: 15000,
  });

  return response.data;
}

// ── Spotify/YouTube Meta Scraper ──

async function fetchMetadata(title, artist) {
  const spotifyUrl = `https://api.spotify.com/v1/search?q=track:${encodeURIComponent(title)}%20artist:${encodeURIComponent(artist)}&type=track&limit=1`;
  const youtubeUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(title + " " + artist)}&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`;
  
  let spotifyId = "";
  let youtubeId = "";
  let spotifyTrackUrl = "";
  let youtubeVideoUrl = "";
  let album = "";
  let releaseYear = 0;
  let genre = "Pop";

  // Spotify query
  try {
    const tokenRes = await axios.post(
      "https://accounts.spotify.com/api/token",
      "grant_type=client_credentials",
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
          ).toString("base64")}`,
        },
      }
    );
    const token = tokenRes.data.access_token;
    const searchRes = await axios.get(spotifyUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const track = searchRes.data.tracks?.items?.[0];
    if (track) {
      spotifyId = track.id;
      spotifyTrackUrl = track.external_urls?.spotify || "";
      album = track.album?.name || "";
      releaseYear = track.album?.release_date
        ? Number.parseInt(track.album.release_date.split("-")[0])
        : 0;
    }
  } catch (err) {
    console.warn("Spotify API lookup failed:", err.message);
  }

  // YouTube query
  try {
    if (process.env.YOUTUBE_API_KEY) {
      const ytRes = await axios.get(youtubeUrl);
      const item = ytRes.data.items?.[0];
      if (item && item.id?.videoId) {
        youtubeId = item.id.videoId;
        youtubeVideoUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
      }
    }
  } catch (err) {
    console.warn("YouTube API lookup failed:", err.message);
  }

  return {
    spotifyId,
    youtubeId,
    spotifyUrl: spotifyTrackUrl,
    youtubeUrl: youtubeVideoUrl,
    album,
    year: releaseYear,
    genre,
  };
}

// ─────────────────────────────────────────────
// Primary API Route Handler
// ─────────────────────────────────────────────

router.post("/identify", async (req, res) => {
  const debugId = crypto.randomUUID();
  const rawUrl = req.body.url || "";
  const url = extractUrl(rawUrl);

  if (!url) {
    return res.status(400).json({ error: "Please share or paste a valid video URL.", debugId });
  }

  const tempDir = "/tmp";
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const sourceTemplate = path.join(tempDir, `tracktune_${debugId}_source.%(ext)s`);
  const tempFiles = [];

  try {
    // 1. Download audio/video
    console.log(`[${debugId}] Downloading target URL: ${url}`);
    const sourcePath = await downloadAudio(url, sourceTemplate, debugId);
    tempFiles.push(sourcePath);

    // 2. Identify offset segments
    const offsets = await getOffsetSeconds(sourcePath);
    console.log(`[${debugId}] Identification offsets calculated:`, offsets);

    let matchResult = null;
    let recognitionAttempts = 0;

    // 3. Scan offsets sequentially until match found
    for (const offset of offsets) {
      if (recognitionAttempts >= MAX_ATTEMPTS) {
        console.log(`[${debugId}] Max recognition attempts (${MAX_ATTEMPTS}) reached. Aborting scan.`);
        break;
      }
      
      recognitionAttempts++;
      console.log(`[${debugId}] Attempt ${recognitionAttempts}: Scanning segment at ${offset}s offset...`);
      
      const segmentPath = await extractSegment(sourcePath, offset, tempDir, debugId);
      if (!segmentPath) continue;
      tempFiles.push(segmentPath);

      const acrResult = await recognizeAudio(segmentPath, debugId);
      const musicItem = acrResult.status?.code === 0 ? acrResult.metadata?.music?.[0] : null;

      if (musicItem) {
        const title = cleanText(musicItem.title);
        const artist = cleanText(musicItem.artists?.[0]?.name);
        const confidence = Number(musicItem.score || 0);

        if (title && artist && confidence >= 40) {
          console.log(`[${debugId}] Match confirmed! "${title}" by ${artist} (Score: ${confidence})`);
          
          matchResult = {
            title,
            artist,
            score: confidence,
          };
          
          if (confidence >= HIGH_CONFIDENCE_SCORE) {
            console.log(`[${debugId}] Match score ${confidence} meets confidence threshold. Terminating scan.`);
            break;
          }
        }
      }
    }

    if (!matchResult) {
      return res.status(404).json({
        error: "We couldn't identify any song in this video. Make sure the background music is clear and try again.",
        debugId
      });
    }

    // ── DATABASE CACHE CHECK ──
    let song = null;
    const existingSongs = await db.select().from(songsTable)
      .where(and(eq(songsTable.title, matchResult.title), eq(songsTable.artist, matchResult.artist)))
      .limit(1);

    if (existingSongs.length > 0) {
      console.log(`[${debugId}] Database Cache Hit for: "${matchResult.title}" by ${matchResult.artist}`);
      song = existingSongs[0];
    } else {
      // 4. Fetch metadata (Spotify/YouTube/Genre/Release Year)
      console.log(`[${debugId}] Database Cache Miss. Fetching metadata for: "${matchResult.title}" by ${matchResult.artist}`);
      const meta = await fetchMetadata(matchResult.title, matchResult.artist);

      // Save to database
      const [newSong] = await db.insert(songsTable).values({
        title: matchResult.title,
        artist: matchResult.artist,
        album: meta.album,
        year: meta.year,
        genre: meta.genre,
        spotifyId: meta.spotifyId,
        youtubeId: meta.youtubeId,
        spotifyUrl: meta.spotifyUrl,
        youtubeUrl: meta.youtubeUrl,
      }).returning();
      
      song = newSong;
    }

    // 5. Save to user search history
    await db.insert(historyTable).values({
      songId: song.id,
      title: song.title,
      artist: song.artist,
      genre: song.genre,
      spotifyUrl: song.spotifyUrl,
      youtubeUrl: song.youtubeUrl,
      spotifyId: song.spotifyId,
      youtubeId: song.youtubeId,
    });

    return res.json({
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      year: song.year,
      genre: song.genre,
      spotifyUrl: song.spotifyUrl,
      youtubeUrl: song.youtubeUrl,
      spotifyId: song.spotifyId,
      youtubeId: song.youtubeId,
      confidence: matchResult.score,
      debugId
    });

  } catch (error) {
    console.error(`[${debugId}] Identification Error:`, error.response?.data || error.message);
    let message = "TrackTune could not process this link right now. Please try again.";
    if (error?.message?.includes("ACRCloud")) {
      message = "Server is missing music recognition configuration.";
    }
    return res.status(500).json({ error: message, debugId });
  } finally {
    // Cleanup temporary files from disk
    for (const file of tempFiles) {
      if (fs.existsSync(file)) {
        try { fs.unlinkSync(file); } catch (e) {}
      }
    }
  }
});

export default router;
