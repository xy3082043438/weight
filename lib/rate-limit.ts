import { ensureSchema, pool } from "@/lib/db";

export async function checkDailyRateLimit(input: {
  userId: number;
  key: string;
  limit: number;
}) {
  await ensureSchema();
  const result = await pool.query(
    `
      INSERT INTO ai_rate_limits (user_id, usage_key, usage_date, count)
      VALUES ($1, $2, CURRENT_DATE, 1)
      ON CONFLICT (user_id, usage_key, usage_date)
      DO UPDATE SET count = ai_rate_limits.count + 1
      RETURNING count
    `,
    [input.userId, input.key, input.limit],
  );

  const count = Number(result.rows[0]?.count ?? 0);
  return {
    allowed: count <= input.limit,
    count,
    limit: input.limit,
  };
}
