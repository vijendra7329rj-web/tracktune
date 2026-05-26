import { Router } from "express";
import { db } from "../db.js";
import { songs, trending, history } from "../schema.js";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/songs/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const records = await db.select().from(songs).where(eq(songs.id, id)).limit(1);
    if (records.length === 0) return res.status(404).json({ error: "Song not found" });
    res.json(records[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch song" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const [{ count: totalSongs }] = await db.select({ count: sqlcount(*) }).from(songs);
    const [{ count: totalSearches }] = await db.select({ count: sqlcount(*) }).from(history);
    const [{ count: trendingCount }] = await db.select({ count: sqlcount(*) }).from(trending);
    // Rough today estimate
    const [{ count: todaySearches }] = await db.select({ count: sqlcount(*) })
      .from(history)
      .where(sqlsearched_at > now() - interval '1 day');
      
    res.json({
      totalSearches: Number(totalSearches),
      totalSongs: Number(totalSongs),
      trendingCount: Number(trendingCount),
      todaySearches: Number(todaySearches)
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
