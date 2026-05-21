import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteWeightEntry,
  getWeightStats,
  listWeightEntries,
  upsertWeightEntry,
} from "@/lib/weight";
import { getCurrentUser } from "@/lib/auth";
import {
  findPreviousEntry,
  getAbnormalWeightWarning,
  getImplausibleBmiWarning,
  maxWeightKg,
  minWeightKg,
} from "@/lib/weight-validation";

export const dynamic = "force-dynamic";

const entrySchema = z.object({
  measuredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weightKg: z.coerce.number().min(minWeightKg).max(maxWeightKg),
  note: z
    .string()
    .max(500)
    .optional()
    .transform((value) => value?.trim() || null),
  confirmAbnormal: z.boolean().optional(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "请先登录。" }, { status: 401 });
    }

    const entries = await listWeightEntries(user.id);
    return NextResponse.json({
      entries,
      stats: getWeightStats(entries),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "无法读取体重记录，请检查 PGHOST、PG_PASSWORD 和数据库 weight。" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "请先登录。" }, { status: 401 });
    }

    const parsed = entrySchema.parse(await request.json());
    const existingEntries = await listWeightEntries(user.id);
    const warning = getAbnormalWeightWarning({
      entries: existingEntries,
      measuredAt: parsed.measuredAt,
      weightKg: parsed.weightKg,
    });
    // 仅当没有更早记录可比对时，才用身高 BMI 兜底，避免对体重本就偏高的老用户重复打扰。
    const bmiWarning =
      warning || findPreviousEntry(existingEntries, parsed.measuredAt)
        ? null
        : getImplausibleBmiWarning({
            weightKg: parsed.weightKg,
            heightCm: user.heightCm,
          });
    if ((warning || bmiWarning) && !parsed.confirmAbnormal) {
      return NextResponse.json(
        {
          code: warning ? "ABNORMAL_WEIGHT_DELTA" : "IMPLAUSIBLE_BMI",
          message: warning
            ? `本次体重比上次记录变化 ${Math.abs(warning.delta).toFixed(1)} kg，请确认输入无误。`
            : `当前体重对应 BMI 约 ${bmiWarning!.bmi}，明显偏离正常范围，请确认输入无误。`,
          warning: warning ?? bmiWarning,
        },
        { status: 409 },
      );
    }

    const entry = await upsertWeightEntry({ ...parsed, userId: user.id });
    const entries = await listWeightEntries(user.id);

    return NextResponse.json({
      entry,
      entries,
      stats: getWeightStats(entries),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: `记录保存失败，体重需在 ${minWeightKg}-${maxWeightKg} kg 之间。` },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "请先登录。" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "缺少有效的记录 ID。" }, { status: 400 });
    }

    await deleteWeightEntry(id, user.id);
    const entries = await listWeightEntries(user.id);
    return NextResponse.json({
      entries,
      stats: getWeightStats(entries),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "删除失败。" }, { status: 500 });
  }
}
