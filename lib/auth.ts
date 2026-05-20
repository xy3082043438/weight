import { cookies } from "next/headers";
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { ensureSchema, pool } from "@/lib/db";

const scryptAsync = promisify(scrypt);
const sessionCookieName = "weight_session";
const sessionMaxAge = 60 * 60 * 24 * 30;

export type AuthUser = {
  id: number;
  name: string;
  email: string;
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
  name: string;
  email: string;
  password: string;
}) {
  await ensureSchema();
  const passwordHash = await hashPassword(input.password);
  const result = await pool.query(
    `
      INSERT INTO users (name, email, password_hash)
      VALUES ($1, LOWER($2), $3)
      RETURNING id, name, email
    `,
    [input.name, input.email, passwordHash],
  );

  const user = result.rows[0] as AuthUser;
  await createSession(user.id);
  return user;
}

export async function loginUser(input: { email: string; password: string }) {
  await ensureSchema();
  const result = await pool.query(
    "SELECT id, name, email, password_hash FROM users WHERE email = LOWER($1)",
    [input.email],
  );
  const row = result.rows[0];
  if (!row || !(await verifyPassword(input.password, row.password_hash))) {
    return null;
  }

  await createSession(row.id);
  return {
    id: Number(row.id),
    name: String(row.name),
    email: String(row.email),
  };
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
      SELECT users.id, users.name, users.email
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

  return {
    id: Number(row.id),
    name: String(row.name),
    email: String(row.email),
  };
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
