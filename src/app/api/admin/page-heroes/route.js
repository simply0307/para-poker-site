import { NextResponse } from "next/server";
import { readPageHeroSettings, writePageHeroSettings } from "@/lib/newsroom/pageHeroSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await readPageHeroSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const settings = await writePageHeroSettings(payload?.settings || payload || {});
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not save page hero settings." }, { status: 400 });
  }
}
