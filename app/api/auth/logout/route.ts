import { NextResponse } from "next/server";
import { logoutUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  await logoutUser();
  return NextResponse.json({ ok: true });
}
