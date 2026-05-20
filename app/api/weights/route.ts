import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteWeightEntry,
  getWeightStats,
  listWeightEntries,
  upsertWeightEntry,
} from "@/lib/weight";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const entrySchema = z.object({
  measuredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weightKg: z.coerce.number().positive().max(500),
  note: z
    .string()
    .max(500)
    .optional()
    .transform((value) => value?.trim() || null),
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
      { message: "记录保存失败，请确认日期和体重格式。" },
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
