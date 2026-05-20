import { ensureSchema, mapWeightEntry, pool, type WeightEntry } from "@/lib/db";

export type WeightStats = {
  latest: number | null;
  latestDate: string | null;
  change: number | null;
  min: number | null;
  max: number | null;
  average: number | null;
  count: number;
};

export async function listWeightEntries(userId: number): Promise<WeightEntry[]> {
  await ensureSchema();
  const result = await pool.query(
    `
    SELECT id, measured_at, weight_kg, body_fat, note, created_at, updated_at
    FROM weight_entries
    WHERE user_id = $1
    ORDER BY measured_at ASC
  `,
    [userId],
  );
  return result.rows.map(mapWeightEntry);
}

export async function upsertWeightEntry(input: {
  userId: number;
  measuredAt: string;
  weightKg: number;
  note?: string | null;
}) {
  await ensureSchema();
  const result = await pool.query(
    `
      INSERT INTO weight_entries (user_id, measured_at, weight_kg, body_fat, note)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, measured_at)
      DO UPDATE SET
        weight_kg = EXCLUDED.weight_kg,
        body_fat = EXCLUDED.body_fat,
        note = EXCLUDED.note,
        updated_at = NOW()
      RETURNING id, measured_at, weight_kg, body_fat, note, created_at, updated_at
    `,
    [
      input.userId,
      input.measuredAt,
      input.weightKg,
      null,
      input.note ?? null,
    ],
  );
  return mapWeightEntry(result.rows[0]);
}

export async function deleteWeightEntry(id: number, userId: number) {
  await ensureSchema();
  await pool.query("DELETE FROM weight_entries WHERE id = $1 AND user_id = $2", [
    id,
    userId,
  ]);
}

export function getWeightStats(entries: WeightEntry[]): WeightStats {
  if (entries.length === 0) {
    return {
      latest: null,
      latestDate: null,
      change: null,
      min: null,
      max: null,
      average: null,
      count: 0,
    };
  }

  const weights = entries.map((entry) => entry.weightKg);
  const latestEntry = entries[entries.length - 1];
  const firstEntry = entries[0];
  const sum = weights.reduce((total, value) => total + value, 0);

  return {
    latest: latestEntry.weightKg,
    latestDate: latestEntry.measuredAt,
    change: Number((latestEntry.weightKg - firstEntry.weightKg).toFixed(2)),
    min: Math.min(...weights),
    max: Math.max(...weights),
    average: Number((sum / weights.length).toFixed(2)),
    count: entries.length,
  };
}
