import { Router } from "express";
import { db, songsTable, historyTable } from "@workspace/db";
import { IdentifySongBody } from "@workspace/api-zod";
import youtubedl from "yt-dlp-exec";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import axios from "axios";
import FormData from "form-data";

const router = Router();

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isUnknownValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "" || normalized === "unknown" || normalized === "unknown title" || normalized === "unknown artist";
}

router.post("/identify", async (req, res) => {
  const parsed = IdentifySongBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request. Provide a valid video URL." });
  }

  const url = parsed.data.url.trim();
  if (!url) {
    return res.status(400).json({ error: "URL is required." });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: "Please paste a full public video URL." });
  }

  const tmpFilePath = path.join("/tmp", `audio_${Date.now()}.m4a`);

  try {
    console.log(`Starting download for: ${url}`);

    await youtubedl(url, {
      f: "bestaudio",
      output: tmpFilePath,
      noWarnings: true,
      noCallHome: true,
    });

    const fileSize = fs.statSync(tmpFilePath).size;
    console.log(`Audio file size: ${fileSize} bytes`);

    const host = process.env.ACR_HOST || "identify-ap-southeast-1.acrcloud.com";
    const accessKey = process.env.ACR_ACCESS_KEY;
    const accessSecret = process.env.ACR_ACCESS_SECRET;

    if (!accessKey || !accessSecret) {
      console.error("ACRCloud keys are missing in Render environment variables.");
      return res.status(500).json({ error: "TrackTune is missing ACRCloud server keys." });
    }

    const endpoint = "/v1/identify";
    const signatureVersion = "1";
    const dataType = "audio";
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const stringToSign = ["POST", endpoint, accessKey, dataType, signatureVersion, timestamp].join("\n");
    const signature = crypto
      .createHmac("sha1", accessSecret)
      .update(Buffer.from(stringToSign, "utf-8"))
      .digest()
      .toString("base64");

    const form = new FormData();
    form.append("sample", fs.createReadStream(tmpFilePath));
    form.append("access_key", accessKey);
    form.append("data_type", dataType);
    form.append("signature_version", signatureVersion);
    form.append("signature", signature);
    form.append("sample_bytes", fileSize);
    form.append("timestamp", timestamp);

    console.log("Sending to ACRCloud...");
    const acrResponse = await axios.post(`https://${host}${endpoint}`, form, {
      headers: form.getHeaders(),
    });

    const acrData = acrResponse.data;
    console.log("ACRCloud response received");

    if (acrData?.status?.msg !== "Success") {
      return res.status(404).json({ error: "ACRCloud could not identify the song in this video." });
    }

    const musicList = Array.isArray(acrData?.metadata?.music)
      ? acrData.metadata.music
      : acrData?.metadata?.music
        ? [acrData.metadata.music]
        : [];

    const music = musicList[0];
    if (!music) {
      return res.status(404).json({ error: "No song metadata was found in this video." });
    }

    const songTitle = cleanText(music.title);
    const songArtist = Array.isArray(music.artists)
      ? music.artists.map((artist: any) => cleanText(artist?.name)).filter(Boolean).join(", ")
      : cleanText(music.artist);
    const songAlbum = cleanText(music.album?.name);
    const parsedYear = Number.parseInt(cleanText(music.release_date).slice(0, 4), 10);
    const songYear = Number.isFinite(parsedYear) ? parsedYear : 2024;
    const songGenre = cleanText(music.genres?.[0]?.name) || "Pop";

    if (isUnknownValue(songTitle) || isUnknownValue(songArtist)) {
      return res.status(404).json({
        error: "TrackTune heard audio, but could not identify a real song from this Reel. Try a clearer or longer public video.",
      });
    }

    const spotifyId = cleanText(music.external_metadata?.spotify?.track?.id);
    const youtubeId = cleanText(music.external_metadata?.youtube?.vid);
    const spotifyUrl = spotifyId ? `https://open.spotify.com/track/${spotifyId}` : "";
    const youtubeUrl = youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : "";

    const [song] = await db
      .insert(songsTable)
      .values({
        title: songTitle,
        artist: songArtist,
        album: songAlbum,
        year: songYear,
        genre: songGenre,
        spotifyId,
        youtubeId,
        spotifyUrl,
        youtubeUrl,
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
    });
  } catch (error: any) {
    console.error("Identification Error:", error);
    return res.status(500).json({
      error: "TrackTune could not process this video right now. Try another public Reel or YouTube Shorts link.",
    });
  } finally {
    if (fs.existsSync(tmpFilePath)) {
      fs.unlinkSync(tmpFilePath);
    }
  }
});

export default router;
