import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var weightPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var weightDbReady: Promise<void> | undefined;
}

const ssl =
  process.env.PGSSLMODE === "disable"
    ? false
    : process.env.PGSSLMODE === "require" || process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : undefined;

export const pool =
  globalThis.weightPool ??
  new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? process.env.POSTGRES_USER ?? "postgres",
    password: process.env.PG_PASSWORD ?? process.env.PGPASSWORD,
    database: process.env.PGDATABASE ?? "weight",
    ssl,
    max: 5,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.weightPool = pool;
}

export async function ensureSchema() {
  globalThis.weightDbReady ??= pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS weight_entries (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      measured_at DATE NOT NULL,
      weight_kg NUMERIC(5, 2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 500),
      body_fat NUMERIC(5, 2) CHECK (body_fat IS NULL OR (body_fat >= 0 AND body_fat <= 100)),
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, measured_at)
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS weight_entries_measured_at_idx
      ON weight_entries (user_id, measured_at DESC);

    CREATE INDEX IF NOT EXISTS user_sessions_expires_at_idx
      ON user_sessions (expires_at);
  `).then(() => undefined);

  return globalThis.weightDbReady;
}

export type WeightEntry = {
  id: number;
  measuredAt: string;
  weightKg: number;
  bodyFat: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export function mapWeightEntry(row: Record<string, unknown>): WeightEntry {
  return {
    id: Number(row.id),
    measuredAt: String(row.measured_at),
    weightKg: Number(row.weight_kg),
    bodyFat: row.body_fat === null ? null : Number(row.body_fat),
    note: row.note === null ? null : String(row.note),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
