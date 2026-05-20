import { NextResponse } from "next/server";
import { z } from "zod";
import { createOcrCompletion } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth";
import { checkDailyRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const ocrSchema = z
  .object({
    imageUrl: z.string().trim().url().optional(),
    imageBase64: z.string().trim().min(1).optional(),
    mimeType: z.string().trim().min(1).max(100).optional(),
    prompt: z.string().trim().max(500).optional(),
  })
  .refine((value) => value.imageUrl || value.imageBase64, {
    message: "需要提供 imageUrl 或 imageBase64。",
  });

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "请先登录。" }, { status: 401 });
    }

    const rateLimit = await checkDailyRateLimit({
      userId: user.id,
      key: "ai_ocr",
      limit: 5,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: "今日 OCR 识别次数已用完，请明天再试。" },
        { status: 429 },
      );
    }

    const input = ocrSchema.parse(await request.json());
    const imageUrl =
      input.imageUrl ??
      `data:${input.mimeType ?? "image/png"};base64,${input.imageBase64}`;

    const text = await createOcrCompletion({
      imageUrl,
      prompt: input.prompt,
    });

    return NextResponse.json({ text });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error && error.message === "Missing SILICONFLOW_API_KEY"
        ? "缺少 SILICONFLOW_API_KEY 环境变量。"
        : "OCR 识别失败。";

    return NextResponse.json({ message }, { status: 400 });
  }
}
