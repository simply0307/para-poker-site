import { NextResponse } from "next/server";
import { readMomentCurationSettings, writeMomentCurationSettings } from "@/lib/newsroom/momentCurationSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await readMomentCurationSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const settings = await writeMomentCurationSettings(payload?.settings || payload || {});
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not save moment curation settings." }, { status: 400 });
  }
}
