import { NextResponse } from "next/server";
import { z } from "zod";
import { registerUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const registerSchema = z.object({
  name: z.string().trim().min(1).max(40),
  account: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6).max(100),
});

export async function POST(request: Request) {
  try {
    const input = registerSchema.parse(await request.json());
    const user = await registerUser(input);
    return NextResponse.json({ user });
  } catch (error: unknown) {
    console.error(error);
    const message =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
        ? "这个账号已经注册。"
        : "注册失败，请检查昵称、账号和密码。账号只能使用字母、数字和下划线。";

    return NextResponse.json({ message }, { status: 400 });
  }
}
