// ─────────────────────────────────────────────────────────
// src/index.js — Entry point for the TrackTune API server
// Reads PORT from environment and starts listening.
// ─────────────────────────────────────────────────────────
import app from "./app.js";
import { logger } from "./logger.js";

const PORT = Number(process.env.PORT) || 10000;

app.listen(PORT, () => {
  logger.info({ port: PORT }, "🎵 TrackTune API server listening");
  console.log(`TrackTune server is running on http://localhost:${PORT}`);
});
