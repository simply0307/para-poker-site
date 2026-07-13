import { NextResponse } from "next/server";
import { readUpcomingEventsSettings, writeUpcomingEventsSettings } from "@/lib/newsroom/upcomingEvents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await readUpcomingEventsSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request) {
  try {
    const payload = await request.json();
    const settings = await writeUpcomingEventsSettings(payload?.settings || payload || {});
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not save upcoming events." }, { status: 400 });
  }
}
