import { NextResponse } from "next/server";
import { z } from "zod";
import { registerUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const registerSchema = z.object({
  name: z.string().trim().min(1).max(40),
  email: z.string().trim().email().max(120),
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
        ? "这个邮箱已经注册。"
        : "注册失败，请检查姓名、邮箱和密码。";

    return NextResponse.json({ message }, { status: 400 });
  }
}
