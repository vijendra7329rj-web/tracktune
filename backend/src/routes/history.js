import { Router } from "express";
import { db } from "../db.js";
import { historyTable } from "../schema.js";
import { desc, eq } from "drizzle-orm";

const router = Router();

router.get("/history", async (req, res) => {
  try {
    const records = await db.select().from(historyTable).orderBy(desc(historyTable.searchedAt)).limit(100);
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

router.delete("/history", async (req, res) => {
  try {
    await db.delete(historyTable);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to clear history" });
  }
});

router.delete("/history/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
    await db.delete(historyTable).where(eq(historyTable.id, id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete history entry" });
  }
});

export default router;
