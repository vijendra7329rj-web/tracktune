// ─────────────────────────────────────────────────────────
// src/db.js — PostgreSQL connection with Drizzle ORM
// Reads DATABASE_URL from environment and exports a
// Drizzle instance + the raw pg Pool.
// ─────────────────────────────────────────────────────────
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create the connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create the Drizzle ORM instance with our schema
export const db = drizzle(pool, { schema });
