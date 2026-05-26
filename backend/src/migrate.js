// ─────────────────────────────────────────────────────────
// src/migrate.js — Creates tables if they don't exist
// Run with: node src/migrate.js
// This uses raw SQL so we don't need drizzle-kit.
// ─────────────────────────────────────────────────────────
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is required to run migrations.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const CREATE_TABLES_SQL = `
-- Songs table: stores every identified song
CREATE TABLE IF NOT EXISTS songs (
  id              SERIAL PRIMARY KEY,
  title           TEXT NOT NULL,
  artist          TEXT NOT NULL,
  album           TEXT NOT NULL DEFAULT '',
  year            INTEGER NOT NULL DEFAULT 0,
  genre           TEXT NOT NULL DEFAULT '',
  spotify_id      TEXT NOT NULL DEFAULT '',
  youtube_id      TEXT NOT NULL DEFAULT '',
  spotify_url     TEXT NOT NULL DEFAULT '',
  youtube_url     TEXT NOT NULL DEFAULT '',
  preview_url     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- History table: one row per identification request
CREATE TABLE IF NOT EXISTS history (
  id              SERIAL PRIMARY KEY,
  song_id         INTEGER NOT NULL,
  title           TEXT NOT NULL,
  artist          TEXT NOT NULL,
  genre           TEXT NOT NULL DEFAULT '',
  spotify_url     TEXT NOT NULL DEFAULT '',
  youtube_url     TEXT NOT NULL DEFAULT '',
  spotify_id      TEXT NOT NULL DEFAULT '',
  youtube_id      TEXT NOT NULL DEFAULT '',
  searched_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trending table: curated trending songs
CREATE TABLE IF NOT EXISTS trending (
  id              SERIAL PRIMARY KEY,
  song_id         INTEGER NOT NULL,
  title           TEXT NOT NULL,
  artist          TEXT NOT NULL,
  genre           TEXT NOT NULL DEFAULT '',
  rank            INTEGER NOT NULL,
  search_count    INTEGER NOT NULL DEFAULT 0,
  growth_percent  INTEGER NOT NULL DEFAULT 0,
  is_viral        BOOLEAN NOT NULL DEFAULT FALSE,
  spotify_url     TEXT NOT NULL DEFAULT '',
  youtube_url     TEXT NOT NULL DEFAULT '',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

async function migrate() {
  console.log("🔄 Running database migrations...");
  const client = await pool.connect();

  try {
    await client.query(CREATE_TABLES_SQL);
    console.log("✅ All tables created (or already exist).");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
