import { Router } from "express";
import { db } from "../db.js";
import { songs, history } from "../schema.js";
import { eq, and } from "drizzle-orm";
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
  return ${match.title.toLowerCase()}::;
}

function getSpotifyUrl(spotifyId) {
  return spotifyId ? https://open.spotify.com/track/ : "";
}

function getYoutubeUrl(youtubeId) {
  return youtubeId ? https://www.youtube.com/watch?v= : "";
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

async function measureMeanVolume(filePath, start) {
  try {
    const { stderr } = await runTool(
      FFMPEG_PATH,
      ["-hide_banner", "-ss", start.toFixed(2), "-t", SAMPLE_SECONDS.toString(), "-i", filePath, "-af", "volumedetect", "-f", "null", "-"],
      45000,
    );
    const match = stderr.match(/mean_volume:\s*(-?\d+(?:\.\d+)?) dB/i);
    return match ? Number.parseFloat(match[1]) : -100;
  } catch (error) {
    console.warn("ffmpeg volume detection failed", error);
    return -100;
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

async function findLoudestStart(filePath, duration) {
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

async function buildSamplePlans(sourcePath, tempDir, debugId) {
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
  const plans = [];

  for (const base of baseStarts) {
    plans.push({
      label: ${base.label}-clean,
      start: base.start,
      filter: normalized,
      path: path.join(tempDir, ${debugId}__clean.m4a),
    });
  }

  const priorityBase = baseStarts[0] || { label: "start", start: 0 };
  const variants = [
    { suffix: "slowed", filter: tempo=0.92, },
    { suffix: "sped", filter: tempo=1.08, },
    { suffix: "pitch-down", filter: setrate=15040,aresample=16000,atempo=1.064, },
    { suffix: "pitch-up", filter: setrate=16960,aresample=16000,atempo=0.943, },
  ];

  for (const variant of variants) {
    plans.push({
      label: ${priorityBase.label}-,
      start: priorityBase.start,
      filter: variant.filter,
      path: path.join(tempDir, ${debugId}__.m4a),
    });
  }
  return plans.slice(0, Math.max(1, MAX_ATTEMPTS));
}

async function createSample(sourcePath, plan) {
  await runTool(
    FFMPEG_PATH,
    ["-hide_banner", "-y", "-ss", plan.start.toFixed(2), "-t", SAMPLE_SECONDS.toString(), "-i", sourcePath, "-vn", "-ac", "1", "-ar", "16000", "-af", plan.filter, "-b:a", "64k", plan.path],
    60000,
  );
}

function parseMatches(acrData, plan) {
  const musicList = Array.isArray(acrData?.metadata?.music) ? acrData.metadata.music : acrData?.metadata?.music ? [acrData.metadata.music] : [];
  return musicList.map((music) => {
    const title = cleanText(music?.title);
    const artist = Array.isArray(music?.artists) ? music.artists.map((item) => cleanText(item?.name)).filter(Boolean).join(", ") : cleanText(music?.artist);
    const album = cleanText(music?.album?.name);
    const yearStr = cleanText(music?.release_date);
    const year = yearStr ? parseInt(yearStr.substring(0, 4)) : new Date().getFullYear();
    const genre = music?.genres && music.genres.length > 0 ? cleanText(music.genres[0].name) : "Pop";
    const spotifyId = cleanText(music?.external_metadata?.spotify?.track?.id);
    const youtubeId = cleanText(music?.external_metadata?.youtube?.vid);
    return {
      title, artist, album, year, genre,
      score: Number(music?.score || 0),
      spotifyId, youtubeId,
      spotifyUrl: getSpotifyUrl(spotifyId),
      youtubeUrl: getYoutubeUrl(youtubeId),
      matchedSample: plan.label,
      recognitionMethod: "acrcloud-multi-sample-v2",
    };
  }).filter((match) => !isUnknownValue(match.title) && !isUnknownValue(match.artist));
}

async function identifyWithAcrCloud(samplePath, plan) {
  const host = process.env.ACR_HOST || "identify-ap-southeast-1.acrcloud.com";
  const accessKey = process.env.ACR_ACCESS_KEY;
  const accessSecret = process.env.ACR_ACCESS_SECRET;
  if (!accessKey || !accessSecret) throw new Error("TrackTune is missing ACRCloud server keys.");
  
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

  const acrResponse = await axios.post(https://System.Management.Automation.Internal.Host.InternalHost, form, {
    headers: form.getHeaders(),
    timeout: 30000,
  });

  return { status: acrResponse.data?.status, matches: parseMatches(acrResponse.data, plan) };
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

router.post("/identify", async (req, res) => {
  const debugId = crypto.randomUUID();
  let rawUrl = req.body.url || "";
  
  // Extract actual URL if it contains extra text from a native share
  const url = extractUrl(rawUrl);
  if (!url) return res.status(400).json({ error: "Please share or paste a valid public video URL.", debugId });

  const tempDir = "/tmp";
  // Make sure temp directory exists
  if (!fs.existsSync(tempDir)) {
     fs.mkdirSync(tempDir, { recursive: true });
  }
  const sourcePath = path.join(tempDir, 	racktune__source.m4a);
  const tempFiles = [sourcePath];

  try {
    console.log([] Starting download for: );
    await youtubedl(url, { f: "bestaudio", output: sourcePath, noWarnings: true, noCallHome: true });
    
    if (!fs.existsSync(sourcePath)) {
        throw new Error("Download failed - file not created");
    }

    const fileSize = fs.statSync(sourcePath).size;
    console.log([] Source audio file size:  bytes);

    const samplePlans = await buildSamplePlans(sourcePath, tempDir, debugId);
    tempFiles.push(...samplePlans.map((plan) => plan.path));

    const allMatches = [];
    let bestMatch = null;

    for (const plan of samplePlans) {
      console.log([] Creating sample  from s);
      await createSample(sourcePath, plan);
      console.log([] Sending sample  to ACRCloud);
      const result = await identifyWithAcrCloud(plan.path, plan);
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

    // Deduplicate songs by title and artist
    let song = null;
    const existingSongs = await db.select().from(songs)
      .where(and(eq(songs.title, bestMatch.title), eq(songs.artist, bestMatch.artist)))
      .limit(1);

    if (existingSongs.length > 0) {
      song = existingSongs[0];
    } else {
      const [newSong] = await db.insert(songs).values({
        title: bestMatch.title, artist: bestMatch.artist, album: bestMatch.album,
        year: bestMatch.year, genre: bestMatch.genre, spotifyId: bestMatch.spotifyId,
        youtubeId: bestMatch.youtubeId, spotifyUrl: bestMatch.spotifyUrl,
        youtubeUrl: bestMatch.youtubeUrl, previewUrl: null,
      }).returning();
      song = newSong;
    }

    await db.insert(history).values({
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
    console.error([] Identification Error:, error);
    const message = error?.code === "ENOENT" ? "Server missing FFmpeg/yt-dlp." : "TrackTune could not process this video. Try another link.";
    return res.status(500).json({ error: message, confidence: 0, matchedSample: "", recognitionMethod: "acrcloud", possibleMatches: [], debugId });
  } finally {
    for (const file of tempFiles) {
      if (fs.existsSync(file)) {
        try { fs.unlinkSync(file); } catch (e) {}
      }
    }
  }
});

export default router;
