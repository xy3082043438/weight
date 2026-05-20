import type { WeightEntry } from "@/lib/db";

export const minWeightKg = 20;
export const maxWeightKg = 250;
export const abnormalWeightDeltaKg = 3;

export function validateWeightRange(weightKg: number) {
  return weightKg >= minWeightKg && weightKg <= maxWeightKg;
}

export function findPreviousEntry(entries: WeightEntry[], measuredAt: string) {
  return [...entries]
    .filter((entry) => entry.measuredAt < measuredAt)
    .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0] ?? null;
}

export function getAbnormalWeightWarning(input: {
  entries: WeightEntry[];
  measuredAt: string;
  weightKg: number;
}) {
  const previousEntry = findPreviousEntry(input.entries, input.measuredAt);
  if (!previousEntry) {
    return null;
  }

  const delta = Number((input.weightKg - previousEntry.weightKg).toFixed(1));
  if (Math.abs(delta) <= abnormalWeightDeltaKg) {
    return null;
  }

  return {
    previousDate: previousEntry.measuredAt,
    previousWeightKg: previousEntry.weightKg,
    delta,
  };
}
