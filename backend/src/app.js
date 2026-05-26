// ─────────────────────────────────────────────────────────
// src/app.js — Express application setup
// Configures CORS, JSON parsing, pino-http logging, and
// mounts all API routes under /api.
// ─────────────────────────────────────────────────────────
import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { logger } from "./logger.js";

// Import route modules
import healthRouter from "./routes/health.js";
import identifyRouter from "./routes/identify.js";
import historyRouter from "./routes/history.js";
import trendingRouter from "./routes/trending.js";
import songsRouter from "./routes/songs.js";

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Mount all API routes under /api ───────────────────
app.use("/api", healthRouter);
app.use("/api", identifyRouter);
app.use("/api", historyRouter);
app.use("/api", trendingRouter);
app.use("/api", songsRouter);

export default app;
