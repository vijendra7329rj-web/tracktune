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

const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg";

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

function parseMatches(acrData) {
  const musicList = Array.isArray(acrData?.metadata?.music)
    ? acrData.metadata.music
    : acrData?.metadata?.music ? [acrData.metadata.music] : [];

  return musicList.map((music) => {
    const title = cleanText(music?.title);
    const artist = Array.isArray(music?.artists)
      ? music.artists.map((item) => cleanText(item?.name)).filter(Boolean).join(", ")
      : cleanText(music?.artist);
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
    };
  }).filter((match) => !isUnknownValue(match.title) && !isUnknownValue(match.artist));
}

async function identifyAudioWithAcrCloud(audioPath) {
  const host = process.env.ACR_HOST || "identify-ap-southeast-1.acrcloud.com";
  const accessKey = process.env.ACR_ACCESS_KEY;
  const accessSecret = process.env.ACR_ACCESS_SECRET;
  if (!accessKey || !accessSecret) throw new Error("Missing ACRCloud credentials.");

  const endpoint = "/v1/identify";
  const signatureVersion = "1";
  const dataType = "audio";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const stringToSign = ["POST", endpoint, accessKey, dataType, signatureVersion, timestamp].join("\n");
  const signature = crypto.createHmac("sha1", accessSecret)
    .update(Buffer.from(stringToSign, "utf-8"))
    .digest()
    .toString("base64");
  const sampleBytes = fs.statSync(audioPath).size;

  const form = new FormData();
  form.append("sample", fs.createReadStream(audioPath));
  form.append("access_key", accessKey);
  form.append("data_type", dataType);
  form.append("signature_version", signatureVersion);
  form.append("signature", signature);
  form.append("sample_bytes", sampleBytes);
  form.append("timestamp", timestamp);

  const acrResponse = await axios.post(`https://${host}${endpoint}`, form, {
    headers: form.getHeaders(),
    timeout: 30000,
  });

  return acrResponse.data;
}

async function convertToWav(inputPath, outputPath) {
  await execFileAsync(FFMPEG_PATH, [
    "-hide_banner", "-y",
    "-i", inputPath,
    "-ar", "16000",
    "-ac", "1",
    "-f", "wav",
    outputPath
  ], { timeout: 30000 });
}

// POST /api/identify-audio — accepts raw audio from microphone
// Expects multipart form data with field "audio" (webm/ogg/mp4/wav blob)
router.post("/identify-audio", async (req, res) => {
  const debugId = crypto.randomUUID();
  const tempDir = "/tmp";

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // The audio blob is sent as raw body bytes with Content-Type header
  const inputPath = path.join(tempDir, `tracktune_mic_${debugId}.webm`);
  const convertedPath = path.join(tempDir, `tracktune_mic_${debugId}.wav`);
  const tempFiles = [inputPath, convertedPath];

  try {
    // Write the raw audio buffer to disk
    const chunks = [];
    await new Promise((resolve, reject) => {
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", resolve);
      req.on("error", reject);
    });

    const audioBuffer = Buffer.concat(chunks);
    if (audioBuffer.length < 1000) {
      return res.status(400).json({ error: "Audio recording is too short or empty. Please try again." });
    }

    fs.writeFileSync(inputPath, audioBuffer);
    console.log(`[${debugId}] Received mic audio: ${audioBuffer.length} bytes`);

    // Convert to standard WAV for ACRCloud
    try {
      await convertToWav(inputPath, convertedPath);
      console.log(`[${debugId}] Converted to WAV successfully`);
    } catch (convertErr) {
      // If conversion fails, try sending the original file directly
      console.warn(`[${debugId}] WAV conversion failed, using original:`, convertErr.message);
      fs.copyFileSync(inputPath, convertedPath);
    }

    // Send to ACRCloud
    const acrData = await identifyAudioWithAcrCloud(convertedPath);
    const matches = parseMatches(acrData);
    const topMatches = [...new Map(matches.map(m => [uniqueKey(m), m]))
      .values()].sort((a, b) => b.score - a.score).slice(0, 3);
    const bestMatch = topMatches[0] || null;

    if (!bestMatch || bestMatch.score < 50) {
      return res.status(404).json({
        error: "Could not identify the song. Make sure the music is clearly audible and try again.",
        debugId
      });
    }

    // Save to DB
    let song = null;
    const existingSongs = await db.select().from(songsTable)
      .where(and(eq(songsTable.title, bestMatch.title), eq(songsTable.artist, bestMatch.artist)))
      .limit(1);

    if (existingSongs.length > 0) {
      song = existingSongs[0];
    } else {
      const [newSong] = await db.insert(songsTable).values({
        title: bestMatch.title, artist: bestMatch.artist, album: bestMatch.album,
        year: bestMatch.year, genre: bestMatch.genre,
        spotifyId: bestMatch.spotifyId, youtubeId: bestMatch.youtubeId,
        spotifyUrl: bestMatch.spotifyUrl, youtubeUrl: bestMatch.youtubeUrl,
        previewUrl: null,
      }).returning();
      song = newSong;
    }

    await db.insert(historyTable).values({
      songId: song.id, title: song.title, artist: song.artist, genre: song.genre,
      spotifyUrl: song.spotifyUrl, youtubeUrl: song.youtubeUrl,
      spotifyId: song.spotifyId, youtubeId: song.youtubeId,
    });

    return res.json({
      id: song.id, title: song.title, artist: song.artist, album: song.album,
      year: song.year, genre: song.genre,
      spotifyUrl: song.spotifyUrl, youtubeUrl: song.youtubeUrl,
      confidence: bestMatch.score, possibleMatches: topMatches, debugId,
    });

  } catch (error) {
    console.error(`[${debugId}] Mic identify error:`, error.message);
    return res.status(500).json({ error: "Failed to process audio. Please try again.", debugId });
  } finally {
    for (const file of tempFiles) {
      if (fs.existsSync(file)) {
        try { fs.unlinkSync(file); } catch (e) {}
      }
    }
  }
});

export default router;
