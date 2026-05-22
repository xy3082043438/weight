import { NextResponse } from "next/server";
import { z } from "zod";
import { aiErrorToMessage, createAiChatCompletion } from "@/lib/ai";
import { buildReportPrompt, filterEntriesByDays } from "@/lib/ai-analysis";
import { getCurrentUser } from "@/lib/auth";
import { listWeightEntries } from "@/lib/weight";

export const dynamic = "force-dynamic";

const reportSchema = z.object({
  days: z.union([z.literal(7), z.literal(30)]),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "请先登录。" }, { status: 401 });
    }

    const { days } = reportSchema.parse(await request.json());
    const allEntries = await listWeightEntries(user.id);
    const entries = filterEntriesByDays(allEntries, days);

    if (entries.length === 0) {
      return NextResponse.json(
        { message: `最近 ${days} 天没有体重记录。` },
        { status: 400 },
      );
    }

    const report = await createAiChatCompletion([
      {
        role: "system",
        content:
          "你是中文体重数据分析师。你只基于提供的数据做复盘，简洁、鼓励但不夸张，不做医疗诊断。",
      },
      {
        role: "user",
        content: buildReportPrompt({ user, entries, days }),
      },
    ]);

    return NextResponse.json({ report });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: aiErrorToMessage(error, "AI 复盘生成失败。") },
      { status: 400 },
    );
  }
}
