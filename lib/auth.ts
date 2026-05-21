import { cookies } from "next/headers";
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { ensureSchema, pool } from "@/lib/db";

const scryptAsync = promisify(scrypt);
const sessionCookieName = "weight_session";
const sessionMaxAge = 60 * 60 * 24 * 30;

export type AuthUser = {
  id: number;
  username: string;
  heightCm: number | null;
  targetWeightKg: number | null;
};

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, key] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !key) {
    return false;
  }

  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  const storedKey = Buffer.from(key, "hex");
  return (
    storedKey.length === derivedKey.length &&
    timingSafeEqual(storedKey, derivedKey)
  );
}

async function createSession(userId: number) {
  await ensureSchema();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + sessionMaxAge * 1000);

  await pool.query(
    "INSERT INTO user_sessions (token, user_id, expires_at) VALUES ($1, $2, $3)",
    [token, userId, expiresAt],
  );

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAge,
  });
}

export async function registerUser(input: {
  username: string;
  password: string;
}) {
  await ensureSchema();
  const passwordHash = await hashPassword(input.password);
  const result = await pool.query(
    `
      INSERT INTO users (username, password_hash)
      VALUES (LOWER($1), $2)
      RETURNING id, username, height_cm, target_weight_kg
    `,
    [input.username, passwordHash],
  );

  const user = mapAuthUser(result.rows[0]);
  await createSession(user.id);
  return user;
}

export async function loginUser(input: { username: string; password: string }) {
  await ensureSchema();
  const result = await pool.query(
    "SELECT id, username, height_cm, target_weight_kg, password_hash FROM users WHERE username = LOWER($1)",
    [input.username],
  );
  const row = result.rows[0];
  if (!row || !(await verifyPassword(input.password, row.password_hash))) {
    return null;
  }

  await createSession(row.id);
  return mapAuthUser(row);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  await ensureSchema();
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (!token) {
    return null;
  }

  const result = await pool.query(
    `
      SELECT users.id, users.username, users.height_cm, users.target_weight_kg
      FROM user_sessions
      JOIN users ON users.id = user_sessions.user_id
      WHERE user_sessions.token = $1 AND user_sessions.expires_at > NOW()
    `,
    [token],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return mapAuthUser(row);
}

export async function updateCurrentUserProfile(input: {
  userId: number;
  heightCm: number | null;
  targetWeightKg: number | null;
  password?: string;
}) {
  await ensureSchema();
  const params: unknown[] = [
    input.heightCm,
    input.targetWeightKg,
    input.userId,
  ];
  let passwordSql = "";

  if (input.password) {
    params.push(await hashPassword(input.password));
    passwordSql = ", password_hash = $4";
  }

  const result = await pool.query(
    `
      UPDATE users
      SET height_cm = $1,
          target_weight_kg = $2
          ${passwordSql}
      WHERE id = $3
      RETURNING id, username, height_cm, target_weight_kg
    `,
    params,
  );

  const row = result.rows[0];
  return mapAuthUser(row);
}

export async function logoutUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (token) {
    await ensureSchema();
    await pool.query("DELETE FROM user_sessions WHERE token = $1", [token]);
  }

  cookieStore.delete(sessionCookieName);
}

function parseHeight(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}

function parseWeight(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}

function mapAuthUser(row: Record<string, unknown>): AuthUser {
  return {
    id: Number(row.id),
    username: String(row.username),
    heightCm: parseHeight(row.height_cm),
    targetWeightKg: parseWeight(row.target_weight_kg),
  };
}
