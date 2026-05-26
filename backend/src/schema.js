// ─────────────────────────────────────────────────────────
// src/schema.js — Drizzle ORM table definitions
// Defines: songs, history, trending
// Ported from lib/db/src/schema/songs.ts (TypeScript → JS)
// ─────────────────────────────────────────────────────────
import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
} from "drizzle-orm/pg-core";

// ── Songs table — stores every identified song ────────
export const songsTable = pgTable("songs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  album: text("album").notNull().default(""),
  year: integer("year").notNull().default(0),
  genre: text("genre").notNull().default(""),
  spotifyId: text("spotify_id").notNull().default(""),
  youtubeId: text("youtube_id").notNull().default(""),
  spotifyUrl: text("spotify_url").notNull().default(""),
  youtubeUrl: text("youtube_url").notNull().default(""),
  previewUrl: text("preview_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── History table — one row per identification request ─
export const historyTable = pgTable("history", {
  id: serial("id").primaryKey(),
  songId: integer("song_id").notNull(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  genre: text("genre").notNull().default(""),
  spotifyUrl: text("spotify_url").notNull().default(""),
  youtubeUrl: text("youtube_url").notNull().default(""),
  spotifyId: text("spotify_id").notNull().default(""),
  youtubeId: text("youtube_id").notNull().default(""),
  searchedAt: timestamp("searched_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Trending table — curated trending songs ───────────
export const trendingTable = pgTable("trending", {
  id: serial("id").primaryKey(),
  songId: integer("song_id").notNull(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  genre: text("genre").notNull().default(""),
  rank: integer("rank").notNull(),
  searchCount: integer("search_count").notNull().default(0),
  growthPercent: integer("growth_percent").notNull().default(0),
  isViral: boolean("is_viral").notNull().default(false),
  spotifyUrl: text("spotify_url").notNull().default(""),
  youtubeUrl: text("youtube_url").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
