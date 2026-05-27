import { Router } from "express";
import { db } from "../db.js";
import { songsTable, trendingTable, historyTable } from "../schema.js";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/songs/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    const records = await db.select().from(songsTable).where(eq(songsTable.id, id)).limit(1);
    if (records.length === 0) return res.status(404).json({ error: "Song not found" });
    res.json(records[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch song" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const [{ count: totalSongs }] = await db.select({ count: sql`count(*)` }).from(songsTable);
    const [{ count: totalSearches }] = await db.select({ count: sql`count(*)` }).from(historyTable);
    const [{ count: trendingCount }] = await db.select({ count: sql`count(*)` }).from(trendingTable);
    const [{ count: todaySearches }] = await db.select({ count: sql`count(*)` })
      .from(historyTable)
      .where(sql`searched_at > now() - interval '1 day'`);
      
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
