import { NextResponse } from "next/server";
import { readSeasonSettings, writeSeasonSettings } from "@/lib/newsroom/seasonSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await readSeasonSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const settings = await writeSeasonSettings(payload?.settings || payload || {});
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not save season settings." }, { status: 400 });
  }
}
