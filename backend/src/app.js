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

// ── Top-level Health Checks (Ensures Render health checks always succeed) ──
app.get("/healthz", (req, res) => res.json({ status: "ok" }));
app.get("/health", (req, res) => res.json({ status: "ok" }));

// ── Serve frontend static files ───────────────────────
const frontendDist = path.resolve(__dirname, "../dist");
if (fs.existsSync(frontendDist)) {
  console.log(`Serving frontend from: ${frontendDist}`);
  app.use(express.static(frontendDist));

  // SPA catch-all: any non-API route serves index.html
  app.get("/*", (req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  console.warn(`Frontend dist not found at ${frontendDist}. Run the frontend build first.`);
  app.get("/", (req, res) => {
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>🎵 TrackTune API Server</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0c0f1d; color: #fff; text-align: center; padding: 50px; }
            .card { max-width: 600px; margin: 0 auto; background: rgba(255, 255, 255, 0.05); padding: 40px; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); }
            h1 { color: #818cf8; margin-bottom: 20px; }
            p { color: #94a3b8; font-size: 16px; line-height: 1.6; }
            .badge { display: inline-block; background: #10b981; color: #fff; padding: 6px 12px; border-radius: 20px; font-weight: bold; font-size: 14px; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>🎵 TrackTune API Server</h1>
            <p>The backend server is running successfully!</p>
            <p>The frontend build is either currently compiling or was not completed yet. Please wait a few moments for the build to finish or trigger a redeploy.</p>
            <div class="badge">Server Status: Online</div>
          </div>
        </body>
      </html>
    `);
  });
}

export default app;
