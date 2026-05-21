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
    : process.env.PGSSLMODE === "require"
      ? { rejectUnauthorized: false }
      : undefined;

export const pool =
  globalThis.weightPool ??
  new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER ?? process.env.POSTGRES_USER ?? "postgres",
    password: process.env.PG_PASSWORD ?? process.env.PGPASSWORD,
    database: process.env.PGDATABASE ?? "weight_tmp",
    ssl,
    max: Number(process.env.PG_POOL_MAX ?? 5),
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
      account TEXT NOT NULL UNIQUE,
      height_cm NUMERIC(5, 2),
      target_weight_kg NUMERIC(5, 2),
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS weight_entries (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      measured_at DATE NOT NULL,
      weight_kg NUMERIC(5, 2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 500),
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, measured_at)
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS account TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5, 2);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS target_weight_kg NUMERIC(5, 2);
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'email'
      ) THEN
        ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
      END IF;
    END $$;
    UPDATE users
      SET account = COALESCE(account, email, 'user_' || id::TEXT)
      WHERE account IS NULL;
    UPDATE users
      SET name = COALESCE(name, account)
      WHERE name IS NULL;
    ALTER TABLE users ALTER COLUMN account SET NOT NULL;
    ALTER TABLE users ALTER COLUMN name SET NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS users_account_unique_idx
      ON users (account);

    ALTER TABLE weight_entries ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE weight_entries DROP COLUMN IF EXISTS body_fat;

    CREATE TABLE IF NOT EXISTS user_sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ai_rate_limits (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      usage_key TEXT NOT NULL,
      usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, usage_key, usage_date)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS weight_entries_user_measured_at_unique_idx
      ON weight_entries (user_id, measured_at);

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
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export function mapWeightEntry(row: Record<string, unknown>): WeightEntry {
  return {
    id: Number(row.id),
    measuredAt: toDateString(row.measured_at),
    weightKg: Number(row.weight_kg),
    note: row.note === null ? null : String(row.note),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

// node-postgres 默认把 DATE 列解析成本地午夜的 Date 对象，
// 这里统一规整成 YYYY-MM-DD 字符串（用本地分量避免时区偏移导致日期差一天）。
function toDateString(value: unknown): string {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}
