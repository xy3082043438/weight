import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { parseWeightCsv } from "@/lib/csv";
import { getWeightStats, listWeightEntries, upsertWeightEntry } from "@/lib/weight";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "请先登录。" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ message: "请上传 CSV 文件。" }, { status: 400 });
    }

    const parsedEntries = parseWeightCsv(await file.text());
    for (const entry of parsedEntries) {
      await upsertWeightEntry({
        userId: user.id,
        measuredAt: entry.measuredAt,
        weightKg: entry.weightKg,
        note: entry.note,
      });
    }

    const entries = await listWeightEntries(user.id);
    return NextResponse.json({
      imported: parsedEntries.length,
      entries,
      stats: getWeightStats(entries),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "CSV 导入失败。" },
      { status: 400 },
    );
  }
}
