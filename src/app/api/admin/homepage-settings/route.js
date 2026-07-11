import { NextResponse } from "next/server";
import { readHomepageSettings, writeHomepageSettings } from "@/lib/newsroom/homepageSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await readHomepageSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request) {
  try {
    const payload = await request.json();
    const settings = await writeHomepageSettings(payload?.settings || payload || {});
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not save homepage settings." }, { status: 400 });
  }
}
