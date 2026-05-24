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
    // 1. Validate Request
    const parsed = IdentifySongBody.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request. Provide a valid video URL." });
    }
    
    const { url } = parsed.data;
    if (!url || url.trim().length === 0) {
        return res.status(400).json({ error: "URL is required." });
    }

    // Create a temporary path to save the reel
    const tmpFilePath = path.join("/tmp", `reel_${Date.now()}.mp4`);

    try {
        // 2. Download video directly
        await youtubedl(url, {
            f: "best[ext=mp4]",
            output: tmpFilePath,
            noWarnings: true,
            noCallHome: true,
        });

        // 3. Prepare ACRCloud Request
        const host = process.env.ACR_HOST || "identify-ap-southeast-1.acrcloud.com";
        const accessKey = process.env.ACR_ACCESS_KEY;
        const accessSecret = process.env.ACR_ACCESS_SECRET;

        if (!accessKey || !accessSecret) {
            throw new Error("ACRCloud keys are missing in Render environment variables.");
        }

        const endpoint = "/v1/identify";
        const signatureVersion = "1";
        const dataType = "audio"; // ACRCloud accepts video files under the 'audio' data type
        const timestamp = Math.floor(Date.now() / 1000).toString();

        const stringToSign = ["POST", endpoint, accessKey, dataType, signatureVersion, timestamp].join("\n");
        const signature = crypto.createHmac("sha1", accessSecret).update(Buffer.from(stringToSign, "utf-8")).digest().toString("base64");

        // 4. Send file to ACRCloud
        const form = new FormData();
        form.append("sample", fs.createReadStream(tmpFilePath));
        form.append("access_key", accessKey);
        form.append("data_type", dataType);
        form.append("signature_version", signatureVersion);
        form.append("signature", signature);
        form.append("sample_bytes", fs.statSync(tmpFilePath).size);
        form.append("timestamp", timestamp);

        const acrResponse = await axios.post(`https://${host}${endpoint}`, form, {
            headers: form.getHeaders(),
        });

        // Cleanup temp file so Render's disk doesn't fill up
        if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);

        const acrData = acrResponse.data;

        // 5. Process the Result and Save to Database
        if (acrData.status.msg === "Success") {
            const music = acrData.metadata.music;
            const songTitle = music.title;
            const songArtist = music.artists ? music.artists.map((a: any) => a.name).join(", ") : "Unknown";
            const songAlbum = music.album ? music.album.name : "";
            const spotUrl = music.external_metadata?.spotify?.track?.id ? `https://open.spotify.com/track/${music.external_metadata.spotify.track.id}` : null;
            const ytUrl = music.external_metadata?.youtube?.vid ? `https://www.youtube.com/watch?v=${music.external_metadata.youtube.vid}` : null;

            // Save to PostgreSQL database
            const [song] = await db.insert(songsTable).values({
                title: songTitle,
                artist: songArtist,
                album: songAlbum,
                year: 2024,
                genre: "Pop", 
                spotifyId: music.external_metadata?.spotify?.track?.id || null,
                youtubeId: music.external_metadata?.youtube?.vid || null,
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

            // Return real data to frontend
            return res.json({
                id: song.id,
                title: song.title,
                artist: song.artist,
                album: song.album,
                spotifyUrl: song.spotifyUrl,
                youtubeUrl: song.youtubeUrl,
            });
        } else {
            return res.status(404).json({ error: "ACRCloud could not identify the song in this video." });
        }

    } catch (error: any) {
        console.error("Identification Error:", error.message);
        if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath); // Failsafe cleanup
        return res.status(500).json({ error: error.message || "Failed to process video." });
    }
});

export default router;
