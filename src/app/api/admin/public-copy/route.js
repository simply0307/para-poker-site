import { NextResponse } from "next/server";
import { readPublicCopySettings, writePublicCopySettings } from "@/lib/newsroom/publicCopySettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await readPublicCopySettings();
  return NextResponse.json({ settings });
}

export async function PUT(request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const settings = await writePublicCopySettings(payload?.settings || payload || {});
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not save public copy settings." }, { status: 400 });
  }
}
