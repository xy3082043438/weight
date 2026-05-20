import { NextResponse } from "next/server";
import { z } from "zod";
import { registerUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const registerSchema = z.object({
  account: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6).max(100),
  heightCm: z
    .union([z.coerce.number().min(50).max(260), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  targetWeightKg: z
    .union([z.coerce.number().positive().max(500), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
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
        : "注册失败，请检查账号和密码。账号只能使用字母、数字和下划线。";

    return NextResponse.json({ message }, { status: 400 });
  }
}
