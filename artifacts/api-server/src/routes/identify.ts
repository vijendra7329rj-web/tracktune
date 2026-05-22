import { Router } from "express";
import { db, songsTable, historyTable } from "@workspace/db";
import { IdentifySongBody } from "@workspace/api-zod";

const router = Router();

const MOCK_SONGS = [
  { title: "Kesariya", artist: "Arijit Singh", album: "Brahmastra", year: 2022, genre: "Bollywood", spotifyId: "0tRvKyFLGHqLHpFnrMnJPn", youtubeId: "BddP6PYo2gs", spotifyUrl: "https://open.spotify.com/track/0tRvKyFLGHqLHpFnrMnJPn", youtubeUrl: "https://www.youtube.com/watch?v=BddP6PYo2gs" },
  { title: "Pasoori", artist: "Ali Sethi", album: "Coke Studio Season 14", year: 2022, genre: "Indie", spotifyId: "0OiFy5rfFb8BTMY3raWxMT", youtubeId: "Z-m1jQEoEOQ", spotifyUrl: "https://open.spotify.com/track/0OiFy5rfFb8BTMY3raWxMT", youtubeUrl: "https://www.youtube.com/watch?v=Z-m1jQEoEOQ" },
  { title: "Lover", artist: "Diljit Dosanjh", album: "MoonChild Era", year: 2023, genre: "Punjabi", spotifyId: "1tDFwRRVCjsRMoFyOuvRxT", youtubeId: "MfCzSFrBNGg", spotifyUrl: "https://open.spotify.com/track/1tDFwRRVCjsRMoFyOuvRxT", youtubeUrl: "https://www.youtube.com/watch?v=MfCzSFrBNGg" },
  { title: "Tere Vaaste", artist: "Varun Jain", album: "Zara Hatke Zara Bachke", year: 2023, genre: "Bollywood", spotifyId: "0CNoXUwJrrNm8uXJioG8Sv", youtubeId: "y8opyKmInD8", spotifyUrl: "https://open.spotify.com/track/0CNoXUwJrrNm8uXJioG8Sv", youtubeUrl: "https://www.youtube.com/watch?v=y8opyKmInD8" },
  { title: "Unstoppable", artist: "Sia", album: "This Is Acting", year: 2016, genre: "Pop", spotifyId: "6M14BiCN00nOsba4JaYsHW", youtubeId: "cNAdtkSjSps", spotifyUrl: "https://open.spotify.com/track/6M14BiCN00nOsba4JaYsHW", youtubeUrl: "https://www.youtube.com/watch?v=cNAdtkSjSps" },
  { title: "Apna Bana Le", artist: "Arijit Singh", album: "Bhediya", year: 2022, genre: "Bollywood", spotifyId: "2rk4DLMHW6Qjhf7XMakmBQ", youtubeId: "9TvSBiqhUDw", spotifyUrl: "https://open.spotify.com/track/2rk4DLMHW6Qjhf7XMakmBQ", youtubeUrl: "https://www.youtube.com/watch?v=9TvSBiqhUDw" },
];

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

  await new Promise((resolve) => setTimeout(resolve, 1200));

  const randomIdx = Math.floor(Math.random() * MOCK_SONGS.length);
  const mock = MOCK_SONGS[randomIdx];

  try {
    const [song] = await db
      .insert(songsTable)
      .values({
        title: mock.title,
        artist: mock.artist,
        album: mock.album,
        year: mock.year,
        genre: mock.genre,
        spotifyId: mock.spotifyId,
        youtubeId: mock.youtubeId,
        spotifyUrl: mock.spotifyUrl,
        youtubeUrl: mock.youtubeUrl,
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

    req.log.info({ songId: song.id, title: song.title }, "Song identified");

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
  }
});

export default router;
