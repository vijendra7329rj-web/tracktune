import { Router } from "express";
import { db } from "../db.js";
import { trendingTable } from "../schema.js";
import { asc, eq } from "drizzle-orm";

const router = Router();

router.get("/trending", async (req, res) => {
  try {
    const genre = req.query.genre || "all";
    let query = db.select().from(trendingTable);
    if (genre !== "all") {
      query = query.where(eq(trendingTable.genre, genre));
    }
    const records = await query.orderBy(asc(trendingTable.rank)).limit(50);
    res.json({ data: records });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch trending" });
  }
});

export default router;
