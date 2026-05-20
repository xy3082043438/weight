import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, updateCurrentUserProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

const profileSchema = z.object({
  heightCm: z
    .union([z.coerce.number().min(50).max(260), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  targetWeightKg: z
    .union([z.coerce.number().positive().max(500), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  password: z
    .string()
    .max(100)
    .optional()
    .transform((value) => value?.trim() || undefined)
    .refine((value) => value === undefined || value.length >= 6, {
      message: "密码至少 6 位。",
    }),
});

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "请先登录。" }, { status: 401 });
    }

    const input = profileSchema.parse(await request.json());
    const updatedUser = await updateCurrentUserProfile({
      userId: user.id,
      ...input,
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error: unknown) {
    console.error(error);
    const message =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
        ? "这个账号已经被使用。"
        : "资料保存失败，请检查身高、目标体重和密码。";

    return NextResponse.json({ message }, { status: 400 });
  }
}
