import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteWeightEntry,
  getWeightStats,
  listWeightEntries,
  upsertWeightEntry,
} from "@/lib/weight";

export const dynamic = "force-dynamic";

const entrySchema = z.object({
  measuredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weightKg: z.coerce.number().positive().max(500),
  bodyFat: z
    .union([z.coerce.number().min(0).max(100), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  note: z
    .string()
    .max(500)
    .optional()
    .transform((value) => value?.trim() || null),
});

export async function GET() {
  try {
    const entries = await listWeightEntries();
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
    const parsed = entrySchema.parse(await request.json());
    const entry = await upsertWeightEntry(parsed);
    const entries = await listWeightEntries();

    return NextResponse.json({
      entry,
      entries,
      stats: getWeightStats(entries),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "记录保存失败，请确认日期、体重和体脂格式。" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "缺少有效的记录 ID。" }, { status: 400 });
    }

    await deleteWeightEntry(id);
    const entries = await listWeightEntries();
    return NextResponse.json({
      entries,
      stats: getWeightStats(entries),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "删除失败。" }, { status: 500 });
  }
}
