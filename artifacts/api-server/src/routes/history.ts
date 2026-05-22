import { Router } from "express";
import { db, historyTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { DeleteHistoryEntryParams } from "@workspace/api-zod";

const router = Router();

router.get("/history", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(historyTable)
      .orderBy(desc(historyTable.searchedAt))
      .limit(100);

    res.json(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        artist: r.artist,
        genre: r.genre,
        searchedAt: r.searchedAt.toISOString(),
        spotifyUrl: r.spotifyUrl,
        youtubeUrl: r.youtubeUrl,
        spotifyId: r.spotifyId,
        youtubeId: r.youtubeId,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get history");
    res.status(500).json({ error: "Failed to get history" });
  }
});

router.delete("/history", async (req, res) => {
  try {
    await db.delete(historyTable);
    req.log.info("History cleared");
    res.json({ success: true, message: "History cleared" });
  } catch (err) {
    req.log.error({ err }, "Failed to clear history");
    res.status(500).json({ error: "Failed to clear history" });
  }
});

router.delete("/history/:id", async (req, res) => {
  const parsed = DeleteHistoryEntryParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  try {
    const deleted = await db
      .delete(historyTable)
      .where(eq(historyTable.id, parsed.data.id))
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }

    req.log.info({ id: parsed.data.id }, "History entry deleted");
    res.json({ success: true, message: "Entry deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete history entry");
    res.status(500).json({ error: "Failed to delete entry" });
  }
});

export default router;
