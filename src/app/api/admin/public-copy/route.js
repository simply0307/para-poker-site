import { NextResponse } from "next/server";
import { requireOperator } from "@/lib/auth/operatorAuthorization";
import { readPublicCopySettings, writePublicCopySettings } from "@/lib/newsroom/publicCopySettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const authorization = await requireOperator(request);
  if (!authorization.ok) return authorization.response;
  const settings = await readPublicCopySettings();
  return NextResponse.json({ settings });
}

export async function PUT(request) {
  const authorization = await requireOperator(request);
  if (!authorization.ok) return authorization.response;
  try {
    const payload = await request.json().catch(() => ({}));
    const settings = await writePublicCopySettings(payload?.settings || payload || {});
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not save public copy settings." }, { status: 400 });
  }
}
