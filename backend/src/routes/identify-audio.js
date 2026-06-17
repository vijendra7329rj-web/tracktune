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

async function identifyWithShazam(audioPath) {
  const apiKey = process.env.RAPIDAPI_KEY ? process.env.RAPIDAPI_KEY.trim() : null;
  if (!apiKey) throw new Error("TrackTune is missing the RAPIDAPI_KEY environment variable.");

  const rawBuffer = fs.readFileSync(audioPath);
  const base64Audio = rawBuffer.toString("base64");

  const response = await axios.post("https://shazam.p.rapidapi.com/songs/v2/detect", base64Audio, {
    headers: {
      "content-type": "text/plain",
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": "shazam.p.rapidapi.com"
    },
    timeout: 25000
  });

  return response.data;
}

async function convertToRawPcm(inputPath, outputPath) {
  await execFileAsync(FFMPEG_PATH, [
    "-hide_banner", "-y",
    "-i", inputPath,
    "-ar", "44100",
    "-ac", "1",
    "-af", "highpass=f=200,lowpass=f=4000,dynaudnorm=f=150:g=15",
    "-f", "s16le",
    "-acodec", "pcm_s16le",
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
  const convertedPath = path.join(tempDir, `tracktune_mic_${debugId}.raw`);
  const tempFiles = [inputPath, convertedPath];

  try {
    // If express.raw middleware is active, it parses the body into req.body as a Buffer.
    // Otherwise, we fallback to reading the request stream chunks.
    let audioBuffer = req.body;
    if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
      const chunks = [];
      await new Promise((resolve, reject) => {
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", resolve);
        req.on("error", reject);
      });
      audioBuffer = Buffer.concat(chunks);
    }

    if (audioBuffer.length < 1000) {
      return res.status(400).json({ error: "Audio recording is too short or empty. Please try again." });
    }

    fs.writeFileSync(inputPath, audioBuffer);
    console.log(`[${debugId}] Received mic audio: ${audioBuffer.length} bytes`);

    // Convert to standard raw PCM for Shazam API
    try {
      await convertToRawPcm(inputPath, convertedPath);
      console.log(`[${debugId}] Converted to raw PCM successfully`);
    } catch (convertErr) {
      // If conversion fails, try sending the original file directly
      console.warn(`[${debugId}] Raw PCM conversion failed, using original:`, convertErr.message);
      fs.copyFileSync(inputPath, convertedPath);
    }

    // Send to Shazam API
    const shazamData = await identifyWithShazam(convertedPath);
    const track = shazamData?.track;

    if (!track) {
      return res.status(404).json({
        error: "Could not identify the song. Make sure the music is clearly audible and try again.",
        debugId
      });
    }

    const title = cleanText(track.title);
    const artist = cleanText(track.subtitle);
    const album = cleanText(track.sections?.[0]?.metadata?.find(m => m.title === "Album")?.text || "");
    const genre = cleanText(track.genres?.primary || "Pop");

    // Construct search queries for Spotify and YouTube
    const searchTerms = `${artist} ${title}`;
    const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(searchTerms)}`;
    const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerms)}`;

    const bestMatch = {
      title,
      artist,
      album,
      genre,
      spotifyId: "",
      youtubeId: "",
      spotifyUrl,
      youtubeUrl,
      score: 100
    };

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
        year: new Date().getFullYear(), genre: bestMatch.genre,
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
      confidence: bestMatch.score, possibleMatches: [bestMatch], debugId,
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
