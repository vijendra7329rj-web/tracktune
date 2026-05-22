import { Router } from "express";
import { db, trendingTable } from "@workspace/db";
import { asc } from "drizzle-orm";

const router = Router();

router.get("/trending", async (req, res) => {
  const genre = req.query.genre as string | undefined;
  const region = req.query.region as string | undefined;

  try {
    const rows = await db
      .select()
      .from(trendingTable)
      .orderBy(asc(trendingTable.rank))
      .limit(50);

    let filtered = rows;

    if (genre && genre !== "all") {
      filtered = filtered.filter(
        (r) => r.genre.toLowerCase() === genre.toLowerCase()
      );
    }

    const isPremium = false;
    const totalShown = isPremium ? filtered.length : Math.min(filtered.length, 3);

    res.json({
      songs: filtered.map((r) => ({
        rank: r.rank,
        id: r.id,
        title: r.title,
        artist: r.artist,
        genre: r.genre,
        searchCount: r.searchCount,
        growthPercent: r.growthPercent,
        isViral: r.isViral,
        spotifyUrl: r.spotifyUrl,
        youtubeUrl: r.youtubeUrl,
      })),
      isPremium,
      totalShown,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get trending");
    res.status(500).json({ error: "Failed to get trending songs" });
  }
});

export default router;
