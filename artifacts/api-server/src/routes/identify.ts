import { Router } from "express";
import { db, songsTable, historyTable } from "@workspace/db";
import { IdentifySongBody } from "@workspace/api-zod";
import youtubedl from "yt-dlp-exec";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import axios from "axios";
import FormData from "form-data";
import { execFile } from "child_process";
import { promisify } from "util";

const router = Router();
const execFileAsync = promisify(execFile);

const SAMPLE_SECONDS = 10;
const MAX_ATTEMPTS = Number(process.env.MAX_RECOGNITION_ATTEMPTS || 8);
const HIGH_CONFIDENCE_SCORE = Number(process.env.HIGH_CONFIDENCE_SCORE || 80);
const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE_PATH = process.env.FFPROBE_PATH || "ffprobe";

type SamplePlan = {
  label: string;
  start: number;
  filter: string;
  path: string;
};

type CandidateMatch = {
  title: string;
  artist: string;
  album: string;
  score: number;
  spotifyId: string;
  youtubeId: string;
  spotifyUrl: string;
  youtubeUrl: string;
  matchedSample: string;
  recognitionMethod: string;
};

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isUnknownValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "" || normalized === "unknown" || normalized === "unknown title" || normalized === "unknown artist";
}

function uniqueKey(match: CandidateMatch): string {
  return `${match.title.toLowerCase()}::${match.artist.toLowerCase()}`;
}

function getSpotifyUrl(spotifyId: string): string {
  return spotifyId ? `https://open.spotify.com/track/${spotifyId}` : "";
}

function getYoutubeUrl(youtubeId: string): string {
  return youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : "";
}

const COBALT_MIRRORS = [
  "https://co.wuk.sh/api/json",
  "https://api.cobalt.tools",
  "https://cobalt.shizuku.io/api/json",
  "https://cobalt.xyz/api/json"
];

async function downloadViaMirror(url: string, targetPath: string, debugId: string): Promise<boolean> {
  let lastError: any = null;

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
      
      const fileResponse = await axios({
        method: "get",
        url: downloadUrl,
        responseType: "stream",
        timeout: 25000
      });

      const writer = fs.createWriteStream(targetPath);
      fileResponse.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      console.log(`[${debugId}] File saved successfully. Size: ${fs.statSync(targetPath).size} bytes`);
      return true;
    } catch (err: any) {
      console.warn(`[${debugId}] Mirror ${mirror} failed:`, err.message);
      lastError = err;
    }
  }

  throw new Error(`All download mirrors failed. Last error: ${lastError?.message}`);
}

async function downloadViaRapidAPI(url: string, targetPath: string, debugId: string): Promise<boolean> {
  const apiKey = process.env.RAPIDAPI_KEY ? process.env.RAPIDAPI_KEY.trim() : null;
  if (!apiKey) {
    throw new Error("No RAPIDAPI_KEY found in environment variables.");
  }

  console.log(`[${debugId}] Attempting download via Social Download All In One API...`);
  
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

  const medias = response.data?.medias || [];
  const audioMedia = medias.find((m: any) => m.type === "audio" || m.extension === "mp3" || m.quality === "audio") || medias.find((m: any) => m.extension === "mp4") || medias[0];
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

  await new Promise<void>((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  console.log(`[${debugId}] RapidAPI file saved. Size: ${fs.statSync(targetPath).size} bytes`);
  return true;
}

async function downloadViaRapidAPIBackup(url: string, targetPath: string, debugId: string): Promise<boolean> {
  const apiKey = process.env.RAPIDAPI_KEY ? process.env.RAPIDAPI_KEY.trim() : null;
  if (!apiKey) {
    throw new Error("No RAPIDAPI_KEY found in environment variables.");
  }

  console.log(`[${debugId}] Attempting download via Backup RapidAPI (Downloader B)...`);
  
  const response = await axios.get("https://all-in-one-video-downloader.p.rapidapi.com/index.php", {
    params: { url: url },
    headers: {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": "all-in-one-video-downloader.p.rapidapi.com"
    },
    timeout: 15000
  });

  const links = response.data?.links || [];
  const audioLinkObj = links.find((l: any) => l.quality === "audio" || l.link?.includes(".mp3") || l.link?.includes("audio") || l.link?.includes("music")) || response.data?.video || response.data?.audio || links[0];
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

  await new Promise<void>((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  console.log(`[${debugId}] Backup RapidAPI file saved. Size: ${fs.statSync(targetPath).size} bytes`);
  return true;
}

async function downloadAudio(url: string, sourceTemplate: string, debugId: string): Promise<string> {
  const tempDir = "/tmp";
  const mirrorPath = path.join(tempDir, `tracktune_${debugId}_source.mp3`);

  // 1. Scan for any environment variables containing "RAPID" (bulletproof key detection)
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

  // 1. Try Premium RapidAPI Downloader A
  if (rapidApiKey) {
    process.env.RAPIDAPI_KEY = rapidApiKey;
    try {
      await downloadViaRapidAPI(url, mirrorPath, debugId);
      return mirrorPath;
    } catch (rapidError: any) {
      console.warn(`[${debugId}] Premium RapidAPI Downloader A failed, trying Downloader B...`, rapidError.message);
      
      // Try Downloader B
      try {
        await downloadViaRapidAPIBackup(url, mirrorPath, debugId);
        return mirrorPath;
      } catch (backupError: any) {
        console.warn(`[${debugId}] Premium RapidAPI Downloader B failed, trying fallback mirrors...`, backupError.message);
      }
    }
  } else {
    console.error(`[${debugId}] *** CRITICAL: No RapidAPI key found in environment variables. Skipping premium downloaders. ***`);
  }

  // 2. Try public mirrors
  try {
    await downloadViaMirror(url, mirrorPath, debugId);
    return mirrorPath;
  } catch (mirrorError: any) {
    console.warn(`[${debugId}] Public mirror chain failed, falling back to local yt-dlp...`, mirrorError.message);
  }

  // 3. Local yt-dlp fallback (uses Android bypass + Cookies if available)
  const ytdlpOptions: any = {
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
  let cookieFilePath: string | null = null;
  
  if (cookiesEnv) {
    cookieFilePath = path.join(tempDir, `yt_cookies_${debugId}.txt`);
    try {
      fs.writeFileSync(cookieFilePath, cookiesEnv, "utf8");
      ytdlpOptions.cookies = cookieFilePath;
      console.log(`[${debugId}] Using YouTube cookies from environment`);
    } catch (e: any) {
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

async function runTool(command: string, args: string[], timeout = 30_000): Promise<{ stdout: string; stderr: string }> {
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

async function getDurationSeconds(filePath: string): Promise<number> {
  try {
    const { stdout } = await runTool(
      FFPROBE_PATH,
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath],
      20_000,
    );
    const duration = Number.parseFloat(stdout.trim());
    return Number.isFinite(duration) && duration > 0 ? duration : SAMPLE_SECONDS;
  } catch (error) {
    console.warn("ffprobe duration failed, falling back to 10 seconds", error);
    return SAMPLE_SECONDS;
  }
}

async function measureMeanVolume(filePath: string, start: number): Promise<number> {
  try {
    const { stderr } = await runTool(
      FFMPEG_PATH,
      [
        "-hide_banner",
        "-ss",
        start.toFixed(2),
        "-t",
        SAMPLE_SECONDS.toString(),
        "-i",
        filePath,
        "-af",
        "volumedetect",
        "-f",
        "null",
        "-",
      ],
      45_000,
    );

    const match = stderr.match(/mean_volume:\s*(-?\d+(?:\.\d+)?) dB/i);
    return match ? Number.parseFloat(match[1]) : -100;
  } catch (error) {
    console.warn("ffmpeg volume detection failed", error);
    return -100;
  }
}

function dedupeStarts(starts: Array<{ label: string; start: number }>) {
  const seen = new Set<number>();
  return starts.filter((item) => {
    const rounded = Math.max(0, Math.round(item.start));
    if (seen.has(rounded)) return false;
    seen.add(rounded);
    item.start = rounded;
    return true;
  });
}

async function findLoudestStart(filePath: string, duration: number): Promise<number> {
  const maxStart = Math.max(0, duration - SAMPLE_SECONDS);
  const candidates = dedupeStarts([
    { label: "loudness-0", start: 0 },
    { label: "loudness-25", start: maxStart * 0.25 },
    { label: "loudness-50", start: maxStart * 0.5 },
    { label: "loudness-75", start: maxStart * 0.75 },
    { label: "loudness-end", start: maxStart },
  ]);

  let loudest = candidates[0]?.start || 0;
  let loudestVolume = -100;

  for (const candidate of candidates) {
    const volume = await measureMeanVolume(filePath, candidate.start);
    if (volume > loudestVolume) {
      loudestVolume = volume;
      loudest = candidate.start;
    }
  }

  return loudest;
}

async function buildSamplePlans(sourcePath: string, tempDir: string, debugId: string): Promise<SamplePlan[]> {
  const duration = await getDurationSeconds(sourcePath);
  const maxStart = Math.max(0, duration - SAMPLE_SECONDS);
  const loudestStart = await findLoudestStart(sourcePath, duration);

  const baseStarts = dedupeStarts([
    { label: "loudest", start: loudestStart },
    { label: "end", start: maxStart },
    { label: "middle", start: maxStart * 0.5 },
    { label: "start", start: 0 },
  ]);

  const normalized = "aresample=16000,loudnorm=I=-16:TP=-1.5:LRA=11";
  const plans: SamplePlan[] = [];

  for (const base of baseStarts) {
    plans.push({
      label: `${base.label}-clean`,
      start: base.start,
      filter: normalized,
      path: path.join(tempDir, `${debugId}_${base.label}_clean.m4a`),
    });
  }

  const priorityBase = baseStarts[0] || { label: "start", start: 0 };
  const variants = [
    { suffix: "slowed", filter: `atempo=0.92,${normalized}` },
    { suffix: "sped", filter: `atempo=1.08,${normalized}` },
    { suffix: "pitch-down", filter: `asetrate=15040,aresample=16000,atempo=1.064,${normalized}` },
    { suffix: "pitch-up", filter: `asetrate=16960,aresample=16000,atempo=0.943,${normalized}` },
  ];

  for (const variant of variants) {
    plans.push({
      label: `${priorityBase.label}-${variant.suffix}`,
      start: priorityBase.start,
      filter: variant.filter,
      path: path.join(tempDir, `${debugId}_${priorityBase.label}_${variant.suffix}.m4a`),
    });
  }

  return plans.slice(0, Math.max(1, MAX_ATTEMPTS));
}

async function createSample(sourcePath: string, plan: SamplePlan) {
  await runTool(
    FFMPEG_PATH,
    [
      "-hide_banner",
      "-y",
      "-ss",
      plan.start.toFixed(2),
      "-t",
      SAMPLE_SECONDS.toString(),
      "-i",
      sourcePath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-af",
      plan.filter,
      "-b:a",
      "64k",
      plan.path,
    ],
    60_000,
  );
}

function parseMatches(acrData: any, plan: SamplePlan): CandidateMatch[] {
  const musicList = Array.isArray(acrData?.metadata?.music)
    ? acrData.metadata.music
    : acrData?.metadata?.music
      ? [acrData.metadata.music]
      : [];

  return musicList
    .map((music: any) => {
      const title = cleanText(music?.title);
      const artist = Array.isArray(music?.artists)
        ? music.artists.map((item: any) => cleanText(item?.name)).filter(Boolean).join(", ")
        : cleanText(music?.artist);
      const album = cleanText(music?.album?.name);
      const spotifyId = cleanText(music?.external_metadata?.spotify?.track?.id);
      const youtubeId = cleanText(music?.external_metadata?.youtube?.vid);

      return {
        title,
        artist,
        album,
        score: Number(music?.score || 0),
        spotifyId,
        youtubeId,
        spotifyUrl: getSpotifyUrl(spotifyId),
        youtubeUrl: getYoutubeUrl(youtubeId),
        matchedSample: plan.label,
        recognitionMethod: "acrcloud-multi-sample-v2",
      };
    })
    .filter((match: CandidateMatch) => !isUnknownValue(match.title) && !isUnknownValue(match.artist));
}

async function identifyWithAcrCloud(samplePath: string, plan: SamplePlan) {
  const host = process.env.ACR_HOST || "identify-ap-southeast-1.acrcloud.com";
  const accessKey = process.env.ACR_ACCESS_KEY;
  const accessSecret = process.env.ACR_ACCESS_SECRET;

  if (!accessKey || !accessSecret) {
    throw new Error("TrackTune is missing ACRCloud server keys.");
  }

  const endpoint = "/v1/identify";
  const signatureVersion = "1";
  const dataType = "audio";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const stringToSign = ["POST", endpoint, accessKey, dataType, signatureVersion, timestamp].join("\n");
  const signature = crypto.createHmac("sha1", accessSecret).update(Buffer.from(stringToSign, "utf-8")).digest().toString("base64");
  const sampleBytes = fs.statSync(samplePath).size;

  const form = new FormData();
  form.append("sample", fs.createReadStream(samplePath));
  form.append("access_key", accessKey);
  form.append("data_type", dataType);
  form.append("signature_version", signatureVersion);
  form.append("signature", signature);
  form.append("sample_bytes", sampleBytes);
  form.append("timestamp", timestamp);

  const acrResponse = await axios.post(`https://${host}${endpoint}`, form, {
    headers: form.getHeaders(),
    timeout: 30_000,
  });

  return {
    status: acrResponse.data?.status,
    matches: parseMatches(acrResponse.data, plan),
  };
}

function chooseBestMatch(matches: CandidateMatch[]): CandidateMatch | null {
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => b.score - a.score)[0] || null;
}

function topUniqueMatches(matches: CandidateMatch[]) {
  const byKey = new Map<string, CandidateMatch>();

  for (const match of matches) {
    const existing = byKey.get(uniqueKey(match));
    if (!existing || match.score > existing.score) {
      byKey.set(uniqueKey(match), match);
    }
  }

  return [...byKey.values()].sort((a, b) => b.score - a.score).slice(0, 3);
}

router.post("/identify", async (req, res) => {
  const debugId = crypto.randomUUID();
  const parsed = IdentifySongBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request. Provide a valid video URL.", debugId });
  }

  const url = parsed.data.url.trim();
  if (!url) {
    return res.status(400).json({ error: "URL is required.", debugId });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: "Please paste a full public video URL.", debugId });
  }

  const tempDir = "/tmp";
  const sourceTemplate = path.join(tempDir, `tracktune_${debugId}_source.%(ext)s`);
  const tempFiles: string[] = [];

  try {
    console.log(`[${debugId}] Starting download for: ${url}`);

    const sourcePath = await downloadAudio(url, sourceTemplate, debugId);
    tempFiles.push(sourcePath);

    const fileSize = fs.statSync(sourcePath).size;
    console.log(`[${debugId}] Source audio file size: ${fileSize} bytes`);

    const samplePlans = await buildSamplePlans(sourcePath, tempDir, debugId);
    tempFiles.push(...samplePlans.map((plan) => plan.path));

    const allMatches: CandidateMatch[] = [];
    let bestMatch: CandidateMatch | null = null;

    for (const plan of samplePlans) {
      console.log(`[${debugId}] Creating sample ${plan.label} from ${plan.start}s`);
      await createSample(sourcePath, plan);

      console.log(`[${debugId}] Sending sample ${plan.label} to ACRCloud`);
      const result = await identifyWithAcrCloud(plan.path, plan);
      const statusCode = result.status?.code ?? "unknown";
      const statusMessage = result.status?.msg ?? "unknown";
      console.log(`[${debugId}] ACRCloud status for ${plan.label}: ${statusCode} ${statusMessage}`);

      allMatches.push(...result.matches);
      bestMatch = chooseBestMatch(allMatches);

      if (bestMatch && bestMatch.score >= HIGH_CONFIDENCE_SCORE) {
        console.log(`[${debugId}] High confidence match found: ${bestMatch.title} - ${bestMatch.artist} (${bestMatch.score})`);
        break;
      }
    }

    const possibleMatches = topUniqueMatches(allMatches);
    bestMatch = chooseBestMatch(possibleMatches);

    if (!bestMatch) {
      return res.status(404).json({
        error: "TrackTune could not identify this song yet. The audio may be too edited, noisy, or missing from the recognition catalog.",
        confidence: 0,
        matchedSample: "",
        recognitionMethod: "acrcloud-multi-sample-v2",
        possibleMatches: [],
        debugId,
      });
    }

    const [song] = await db
      .insert(songsTable)
      .values({
        title: bestMatch.title,
        artist: bestMatch.artist,
        album: bestMatch.album,
        year: 2024,
        genre: "Pop",
        spotifyId: bestMatch.spotifyId,
        youtubeId: bestMatch.youtubeId,
        spotifyUrl: bestMatch.spotifyUrl,
        youtubeUrl: bestMatch.youtubeUrl,
        previewUrl: null,
      })
      .returning();

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
      spotifyUrl: song.spotifyUrl,
      youtubeUrl: song.youtubeUrl,
      previewUrl: song.previewUrl,
      confidence: bestMatch.score,
      matchedSample: bestMatch.matchedSample,
      recognitionMethod: bestMatch.recognitionMethod,
      possibleMatches,
      debugId,
    });
  } catch (error: any) {
    console.error(`[${debugId}] Identification Error:`, error);
    const message = error?.code === "ENOENT"
      ? "TrackTune audio processing is missing FFmpeg on the server."
      : "TrackTune could not process this video right now. Try another public Reel or YouTube Shorts link.";

    return res.status(500).json({
      error: message,
      confidence: 0,
      matchedSample: "",
      recognitionMethod: "acrcloud-multi-sample-v2",
      possibleMatches: [],
      debugId,
    });
  } finally {
    for (const file of tempFiles) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
  }
});

export default router;
