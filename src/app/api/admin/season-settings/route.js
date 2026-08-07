import { NextResponse } from "next/server";
import { requireOperator } from "@/lib/auth/operatorAuthorization";
import { readSeasonSettings, writeSeasonSettings } from "@/lib/newsroom/seasonSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const authorization = await requireOperator(request);
  if (!authorization.ok) return authorization.response;
  const settings = await readSeasonSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request) {
  const authorization = await requireOperator(request);
  if (!authorization.ok) return authorization.response;
  try {
    const payload = await request.json().catch(() => ({}));
    const settings = await writeSeasonSettings(payload?.settings || payload || {});
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not save season settings." }, { status: 400 });
  }
}
