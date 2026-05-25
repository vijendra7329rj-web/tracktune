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

router.post("/identify", async (req, res) => {
    const parsed = IdentifySongBody.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request. Provide a valid video URL." });
    }
    
    const { url } = parsed.data;
    if (!url || url.trim().length === 0) {
        return res.status(400).json({ error: "URL is required." });
    }

    const tmpFilePath = path.join("/tmp", `audio_${Date.now()}.m4a`);

    try {
        console.log(` Starting download for: ${url}`);
        
        await youtubedl(url, {
            f: "bestaudio",
            output: tmpFilePath,
            noWarnings: true,
        });

        const fileSize = fs.statSync(tmpFilePath).size;
        console.log(` Audio file size: ${fileSize} bytes`);

        const host = process.env.ACR_HOST || "identify-ap-southeast-1.acrcloud.com";
        const accessKey = process.env.ACR_ACCESS_KEY;
        const accessSecret = process.env.ACR_ACCESS_SECRET;

        const endpoint = "/v1/identify";
        const signatureVersion = "1";
        const dataType = "audio";
        const timestamp = Math.floor(Date.now() / 1000).toString();

        const stringToSign = ["POST", endpoint, accessKey, dataType, signatureVersion, timestamp].join("\n");
        const signature = crypto.createHmac("sha1", accessSecret).update(Buffer.from(stringToSign, "utf-8")).digest().toString("base64");

        const form = new FormData();
        form.append("sample", fs.createReadStream(tmpFilePath));
        form.append("access_key", accessKey!);
        form.append("data_type", dataType);
        form.append("signature_version", signatureVersion);
        form.append("signature", signature);
        form.append("sample_bytes", fileSize);
        form.append("timestamp", timestamp);

        console.log(` Sending to ACRCloud...`);
        const acrResponse = await axios.post(`https://${host}${endpoint}`, form, {
            headers: form.getHeaders(),
        });

        if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);

        const acrData = acrResponse.data;
        console.log(` ACRCloud Success!`);

        if (acrData.status.msg === "Success") {
            const music = acrData.metadata.music;
            
            const songTitle = music.title || "Unknown Title";
            const songArtist = music.artists ? music.artists.map((a: any) => a.name).join(", ") : "Unknown Artist";
            const songAlbum = music.album ? music.album.name : "Unknown Album";
            
            // CRITICAL FIX: Use null instead of "" so Postgres doesn't crash on unique constraints
            const spotId = music.external_metadata?.spotify?.track?.id || null;
            const ytId = music.external_metadata?.youtube?.vid || null;
            const spotUrl = spotId ? `https://open.spotify.com/track/${spotId}` : null;
            const ytUrl = ytId ? `https://www.youtube.com/watch?v=${ytId}` : null;

            // Save to Database
            const [song] = await db.insert(songsTable).values({
                title: songTitle,
                artist: songArtist,
                album: songAlbum,
                year: 2024,
                genre: "Pop", 
                spotifyId: spotId,
                youtubeId: ytId,
                spotifyUrl: spotUrl,
                youtubeUrl: ytUrl,
                previewUrl: null,
            }).returning();

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
                youtubeUrl: song.youtubeUrl
            });
        } else {
            return res.status(404).json({ error: "ACRCloud could not identify the song in this video." });
        }

    } catch (error: any) {
        console.error("Identification Error:", error.message);
        if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
        return res.status(500).json({ error: error.message || "Failed to process video." });
    }
});

export default router;
