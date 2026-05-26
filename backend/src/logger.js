// ─────────────────────────────────────────────────────────
// src/logger.js — Pino logger configuration
// Uses pino-pretty in development for colourful output.
// ─────────────────────────────────────────────────────────
import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  // Redact sensitive headers from logs
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  // In development use pino-pretty for readable logs
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
