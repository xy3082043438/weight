import type { AuthUser } from "@/lib/auth";
import type { WeightEntry } from "@/lib/db";

export function buildWeightContext(input: {
  user: AuthUser;
  entries: WeightEntry[];
  maxEntries?: number;
}) {
  const recentEntries = input.entries.slice(-(input.maxEntries ?? 10));
  const profile = [
    `账号：${input.user.account}`,
    `身高：${input.user.heightCm ? `${input.user.heightCm}cm` : "未设置"}`,
    `目标体重：${input.user.targetWeightKg ? `${input.user.targetWeightKg}kg` : "未设置"}`,
  ].join("\n");

  const rows =
    recentEntries.length > 0
      ? recentEntries
          .map(
            (entry) =>
              `${entry.measuredAt}: ${entry.weightKg}kg${entry.note ? `，备注：${entry.note}` : ""}`,
          )
          .join("\n")
      : "暂无体重记录";

  return `用户资料：\n${profile}\n\n最近体重记录：\n${rows}`;
}

export function filterEntriesByDays(entries: WeightEntry[], days: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);

  return entries.filter((entry) => {
    const measuredAt = new Date(`${entry.measuredAt}T00:00:00`);
    return measuredAt >= start;
  });
}

export function buildReportPrompt(input: {
  user: AuthUser;
  entries: WeightEntry[];
  days: 7 | 30;
}) {
  const periodLabel = input.days === 7 ? "周报" : "月报";
  const context = buildWeightContext({
    user: input.user,
    entries: input.entries,
    maxEntries: input.days,
  });

  return [
    `请生成一份中文体重${periodLabel}。`,
    "要求：",
    "1. 先用一句话总结趋势。",
    "2. 结合备注解释明显波动，但不要过度推断。",
    "3. 如果接近目标或偏离目标，给出简短提醒。",
    "4. 给 2-3 条下周可执行建议。",
    "5. 不要提供医疗诊断，必要时提醒咨询专业人士。",
    "6. 输出控制在 180 字以内。",
    "",
    context,
  ].join("\n");
}
