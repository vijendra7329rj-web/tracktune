import { Router } from "express";
import { db, songsTable, historyTable } from "@workspace/db";
import { IdentifySongBody } from "@workspace/api-zod";
import { exec } from "child_process";
import { promisify } from "util";
import { createHash, createHmac } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import fetch from "node-fetch";
import FormData from "form-data";

const execAsync = promisify(exec);
const router = Router();

const ACR_HOST = process.env.ACR_HOST!;
const ACR_ACCESS_KEY = process.env.ACR_ACCESS_KEY!;
const ACR_ACCESS_SECRET = process.env.ACR_ACCESS_SECRET!;

async function downloadAudio(url: string, outputPath: string): Promise<void> {
  const command = `yt-dlp --no-playlist -x --audio-format mp3 --audio-quality 0 -o "${outputPath}" "${url}"`;
  await execAsync(command, { timeout: 60000 });
}

async function trimAudio(inputPath: string, outputPath: string): Promise<void> {
  const command = `ffmpeg -i "${inputPath}" -sseof -4 -t 4 -y "${outputPath}"`;
  await execAsync(command, { timeout: 30000 });
}

async function recognizeSong(audioPath: string): Promise<any> {
  const timestamp = Math.floor(Date.now() / 1000);
  const stringToSign = `POST\n/v1/identify\n${ACR_ACCESS_KEY}\naudio\n1\n${timestamp}`;
  const signature = createHmac("sha1", ACR_ACCESS_SECRET)
    .update(stringToSign)
    .digest("base64");

  const audioData = fs.readFileSync(audioPath);
  const form = new FormData();
  form.append("sample", audioData, {
    filename: "sample.mp3",
    contentType: "audio/mpeg",
  });
  form.append("access_key", ACR_ACCESS_KEY);
  form.append("data_type", "audio");
  form.append("signature_version", "1");
  form.append("signature", signature);
  form.append("sample_bytes", audioData.length.toString());
  form.append("timestamp", timestamp.toString());

  const response = await fetch(`https://${ACR_HOST}/v1/identify`, {
    method: "POST",
    body: form,
    headers: form.getHeaders(),
  });

  return response.json();
}

router.post("/identify", async (req, res) => {
  const parsed = IdentifySongBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request. Provide a valid video URL." });
    return;
  }

  const { url } = parsed.data;
  if (!url || url.trim().length === 0) {
    res.status(400).json({ error: "URL is required." });
    return;
  }

  const tmpDir = os.tmpdir();
  const rawAudio = path.join(tmpDir, `raw_${Date.now()}.mp3`);
  const trimmedAudio = path.join(tmpDir, `trim_${Date.now()}.mp3`);

  try {
    await downloadAudio(url, rawAudio);
    await trimAudio(rawAudio, trimmedAudio);
    const result = await recognizeSong(trimmedAudio);

    if (result.status?.code !== 0) {
      res.status(404).json({ error: "Song not recognized. Try a different video." });
      return;
    }

    const music = result.metadata?.music?.[0];
    if (!music) {
      res.status(404).json({ error: "No song found in this video." });
      return;
    }

    const title = music.title || "Unknown";
    const artist = music.artists?.[0]?.name || "Unknown";
    const album = music.album?.name || "Unknown";
    const year = music.release_date?.split("-")[0] || "Unknown";
    const genre = music.genres?.[0]?.name || "Unknown";
    const spotifyId = music.external_metadata?.spotify?.track?.id || null;
    const youtubeId = music.external_metadata?.youtube?.vid || null;
    const spotifyUrl = spotifyId ? `https://open.spotify.com/track/${spotifyId}` : null;
    const youtubeUrl = youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : null;

    const [song] = await db
      .insert(songsTable)
      .values({
        title,
        artist,
        album,
        year,
        genre,
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

    res.json({
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
      previewUrl: song.previewUrl,
    });

  } catch (err) {
    req.log.error({ err }, "Failed to identify song");
    res.status(500).json({ error: "Failed to identify song" });
  } finally {
    try { fs.unlinkSync(rawAudio); } catch {}
    try { fs.unlinkSync(trimmedAudio); } catch {}
  }
});

export default router;
