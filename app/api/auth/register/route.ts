import { NextResponse } from "next/server";
import { z } from "zod";
import { registerUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, { message: "账号至少需要 3 个字符。" })
    .max(40, { message: "账号最多 40 个字符。" })
    .regex(/^[a-zA-Z0-9_]+$/, {
      message: "账号只能使用字母、数字和下划线。",
    }),
  password: z
    .string()
    .min(6, { message: "密码至少需要 6 个字符。" })
    .max(100, { message: "密码最多 100 个字符。" }),
});

export async function POST(request: Request) {
  try {
    const input = registerSchema.parse(await request.json());
    const user = await registerUser(input);
    return NextResponse.json({ user });
  } catch (error: unknown) {
    console.error(error);

    if (error instanceof z.ZodError) {
      const message = error.issues[0]?.message ?? "注册信息有误，请检查后重试。";
      return NextResponse.json({ message }, { status: 400 });
    }

    const message =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
        ? "这个账号已经注册。"
        : "注册失败，请稍后重试。";

    return NextResponse.json({ message }, { status: 400 });
  }
}
