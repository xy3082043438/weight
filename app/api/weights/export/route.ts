import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { exportWeightEntriesToCsv } from "@/lib/csv";
import { listWeightEntries } from "@/lib/weight";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "请先登录。" }, { status: 401 });
    }

    const entries = await listWeightEntries(user.id);
    const csv = exportWeightEntriesToCsv(entries);

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="my_weight_data.csv"',
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "CSV 导出失败。" }, { status: 500 });
  }
}
