import { NextResponse } from "next/server";
import { z } from "zod";
import { createAiChatCompletion } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth";
import { buildWeightContext } from "@/lib/ai-analysis";
import { checkDailyRateLimit } from "@/lib/rate-limit";
import { listWeightEntries } from "@/lib/weight";

export const dynamic = "force-dynamic";

const chatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "请先登录。" }, { status: 401 });
    }

    const rateLimit = await checkDailyRateLimit({
      userId: user.id,
      key: "ai_chat",
      limit: 20,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: "今日 AI 对话次数已用完，请明天再试。" },
        { status: 429 },
      );
    }

    const { message } = chatSchema.parse(await request.json());
    const entries = await listWeightEntries(user.id);
    const context = buildWeightContext({ user, entries, maxEntries: 10 });
    const reply = await createAiChatCompletion([
      {
        role: "system",
        content: [
          "你是体重记录网站里的中文 AI 助手。回答要简洁、实用。",
          "你可以基于用户真实体重记录回答趋势、平台期、目标差距等问题。",
          "不要提供医疗诊断；涉及健康风险时建议用户咨询专业医生。",
          "",
          context,
        ].join("\n"),
      },
      {
        role: "user",
        content: message,
      },
    ]);

    return NextResponse.json({ reply });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error && error.message === "Missing SILICONFLOW_API_KEY"
        ? "缺少 SILICONFLOW_API_KEY 环境变量。"
        : "AI 请求失败。";

    return NextResponse.json({ message }, { status: 400 });
  }
}
