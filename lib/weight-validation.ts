import type { WeightEntry } from "@/lib/db";

export const minWeightKg = 20;
export const maxWeightKg = 250;
export const abnormalWeightDeltaKg = 3;
// 没有可比对的旧记录时，用身高算 BMI 兜底：超出此区间视为明显不合理，需二次确认。
export const minPlausibleBmi = 13;
export const maxPlausibleBmi = 45;

export function getImplausibleBmiWarning(input: {
  weightKg: number;
  heightCm: number | null | undefined;
}) {
  if (!input.heightCm || input.heightCm <= 0) {
    return null;
  }

  const heightM = input.heightCm / 100;
  const bmi = Number((input.weightKg / (heightM * heightM)).toFixed(1));
  if (bmi >= minPlausibleBmi && bmi <= maxPlausibleBmi) {
    return null;
  }

  return { bmi, heightCm: input.heightCm };
}

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
