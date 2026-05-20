import { NextResponse } from "next/server";
import { z } from "zod";
import { loginUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  account: z.string().trim().min(1).max(40),
  password: z.string().min(1).max(100),
});

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const user = await loginUser(input);
    if (!user) {
      return NextResponse.json(
        { message: "账号或密码不正确。" },
        { status: 401 },
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "登录失败。" }, { status: 400 });
  }
}
