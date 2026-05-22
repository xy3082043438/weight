import { NextResponse } from "next/server";
import { z } from "zod";
import { aiErrorToMessage, createAiChatCompletion } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth";
import { getWeightStats, listWeightEntries, upsertWeightEntry } from "@/lib/weight";
import {
  findPreviousEntry,
  getAbnormalWeightWarning,
  getImplausibleBmiWarning,
  maxWeightKg,
  minWeightKg,
} from "@/lib/weight-validation";

export const dynamic = "force-dynamic";

const naturalInputSchema = z.object({
  text: z.string().trim().min(1).max(500),
  confirmAbnormal: z.boolean().optional(),
});

const parsedEntrySchema = z.object({
  measuredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weightKg: z.coerce.number().min(minWeightKg).max(maxWeightKg),
  note: z.string().max(500).nullable().optional(),
});

function todayInShanghai() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function extractJson(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced?.[1] ?? content;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI response did not contain JSON");
  }

  return JSON.parse(source.slice(start, end + 1)) as unknown;
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "请先登录。" }, { status: 401 });
    }

    const { text, confirmAbnormal } = naturalInputSchema.parse(await request.json());
    const currentDate = todayInShanghai();
    const aiContent = await createAiChatCompletion([
      {
        role: "system",
        content: [
          "你是体重记录解析器，只输出 JSON，不要输出解释。",
          "从用户的中文自然语言输入中提取体重记录。",
          "返回格式必须是：{\"measuredAt\":\"YYYY-MM-DD\",\"weightKg\":72.4,\"note\":\"备注或null\"}",
          "日期缺省时使用当前日期。今天、昨天、前天等相对日期以 Asia/Shanghai 当前日期为准。",
          "体重单位默认 kg。",
          "备注（note）只保留与饮食、运动、身体状态相关的有意义信息。",
          "像「今天、今早、昨天、早上、晚上、刚才」这类仅用于推断日期或测量时段的词，不要写进备注。",
          "如果除时间和体重外没有其它有效信息，note 返回 null。",
          "如果无法识别体重，返回：{\"error\":\"无法识别体重\"}",
        ].join("\n"),
      },
      {
        role: "user",
        content: `当前日期：${currentDate}\n用户输入：${text}`,
      },
    ]);

    let parsed: unknown;
    try {
      parsed = extractJson(aiContent);
    } catch {
      console.error("[natural] AI 返回无法解析为 JSON:", aiContent);
      return NextResponse.json(
        { message: "AI 返回格式异常，请换种说法重试。" },
        { status: 400 },
      );
    }
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "error" in parsed
    ) {
      return NextResponse.json(
        { message: String(parsed.error || "无法识别体重。") },
        { status: 400 },
      );
    }

    const parsedResult = parsedEntrySchema.safeParse(parsed);
    if (!parsedResult.success) {
      console.error("[natural] AI 返回不符合 schema:", aiContent, parsedResult.error.issues);
      const weightIssue = parsedResult.error.issues.find(
        (issue) => issue.path[0] === "weightKg",
      );
      const message = weightIssue
        ? `识别到的体重超出范围，需在 ${minWeightKg}-${maxWeightKg} kg 之间。`
        : "未能识别出有效的日期或体重，请补充说明后重试。";
      return NextResponse.json({ message }, { status: 400 });
    }
    const entryInput = parsedResult.data;
    const existingEntries = await listWeightEntries(user.id);
    const warning = getAbnormalWeightWarning({
      entries: existingEntries,
      measuredAt: entryInput.measuredAt,
      weightKg: entryInput.weightKg,
    });
    // 仅当没有更早记录可比对时，才用身高 BMI 兜底，避免对体重本就偏高的老用户重复打扰。
    const bmiWarning =
      warning || findPreviousEntry(existingEntries, entryInput.measuredAt)
        ? null
        : getImplausibleBmiWarning({
            weightKg: entryInput.weightKg,
            heightCm: user.heightCm,
          });
    if ((warning || bmiWarning) && !confirmAbnormal) {
      return NextResponse.json(
        {
          code: warning ? "ABNORMAL_WEIGHT_DELTA" : "IMPLAUSIBLE_BMI",
          message: warning
            ? `本次体重比上次记录变化 ${Math.abs(warning.delta).toFixed(1)} kg，请确认输入无误。`
            : `当前体重对应 BMI 约 ${bmiWarning!.bmi}，明显偏离正常范围，请确认输入无误。`,
          warning: warning ?? bmiWarning,
          parsed: entryInput,
        },
        { status: 409 },
      );
    }

    const entry = await upsertWeightEntry({
      userId: user.id,
      measuredAt: entryInput.measuredAt,
      weightKg: entryInput.weightKg,
      note: entryInput.note ?? null,
    });
    const entries = await listWeightEntries(user.id);

    return NextResponse.json({
      entry,
      parsed: entryInput,
      entries,
      stats: getWeightStats(entries),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: aiErrorToMessage(error, "解析失败，请稍后重试。") },
      { status: 400 },
    );
  }
}
