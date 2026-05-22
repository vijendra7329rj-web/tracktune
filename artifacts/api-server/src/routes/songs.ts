import { Router } from "express";
import { db, songsTable, historyTable } from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";
import { GetSongParams } from "@workspace/api-zod";

const router = Router();

router.get("/songs/:id", async (req, res) => {
  const parsed = GetSongParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  try {
    const [song] = await db
      .select()
      .from(songsTable)
      .where(eq(songsTable.id, parsed.data.id))
      .limit(1);

    if (!song) {
      const [historyEntry] = await db
        .select()
        .from(historyTable)
        .where(eq(historyTable.id, parsed.data.id))
        .limit(1);

      if (!historyEntry) {
        res.status(404).json({ error: "Song not found" });
        return;
      }

      res.json({
        id: historyEntry.id,
        title: historyEntry.title,
        artist: historyEntry.artist,
        album: "",
        year: 2024,
        genre: historyEntry.genre,
        spotifyUrl: historyEntry.spotifyUrl,
        youtubeUrl: historyEntry.youtubeUrl,
        spotifyId: historyEntry.spotifyId,
        youtubeId: historyEntry.youtubeId,
        previewUrl: null,
      });
      return;
    }

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
    req.log.error({ err }, "Failed to get song");
    res.status(500).json({ error: "Failed to get song" });
  }
});

router.get("/stats", async (_req, res) => {
  try {
    const [totalSongs] = await db.select({ count: count() }).from(songsTable);
    const [totalSearches] = await db.select({ count: count() }).from(historyTable);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [todaySearches] = await db
      .select({ count: count() })
      .from(historyTable)
      .where(sql`${historyTable.searchedAt} >= ${today}`);

    const [trendingCount] = await db.select({ count: count() }).from(songsTable);

    res.json({
      totalSearches: totalSearches?.count ?? 0,
      totalSongs: totalSongs?.count ?? 0,
      trendingCount: trendingCount?.count ?? 0,
      todaySearches: todaySearches?.count ?? 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get stats" });
  }
});

export default router;
