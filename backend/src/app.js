// ─────────────────────────────────────────────────────────
// src/app.js — Express application setup
// Configures CORS, JSON parsing, pino-http logging, and
// mounts all API routes under /api.
// Serves frontend static files from ../frontend/dist.
// ─────────────────────────────────────────────────────────
import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { logger } from "./logger.js";

// Import route modules
import healthRouter from "./routes/health.js";
import identifyRouter from "./routes/identify.js";
import identifyAudioRouter from "./routes/identify-audio.js";
import historyRouter from "./routes/history.js";
import trendingRouter from "./routes/trending.js";
import songsRouter from "./routes/songs.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ── CORS — allow all origins for now ──────────────────
app.use(cors());

// ── Request logging with pino ─────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0], // strip query params from logs
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── Body parsing ──────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api/identify-audio", express.raw({ type: "*/*", limit: "20mb" }));

// ── Mount all API routes under /api ───────────────────
app.use("/api", healthRouter);
app.use("/api", identifyRouter);
app.use("/api", identifyAudioRouter);
app.use("/api", historyRouter);
app.use("/api", trendingRouter);
app.use("/api", songsRouter);

// ── Serve frontend static files ───────────────────────
const frontendDist = path.resolve(__dirname, "../../frontend/dist");
if (fs.existsSync(frontendDist)) {
  console.log(`Serving frontend from: ${frontendDist}`);
  app.use(express.static(frontendDist));

  // SPA catch-all: any non-API route serves index.html
  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  console.warn(`Frontend dist not found at ${frontendDist}. Run the frontend build first.`);
  app.get("/", (req, res) => {
    res.status(503).send("Frontend not built yet. Please redeploy.");
  });
}

export default app;
