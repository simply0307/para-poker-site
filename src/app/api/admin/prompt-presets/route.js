import { NextResponse } from "next/server";
import { requireOperator } from "@/lib/auth/operatorAuthorization";
import { readPromptPresetSettings, savePromptPreset } from "@/lib/newsroom/promptPresetStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const authorization = await requireOperator(request);
  if (!authorization.ok) return authorization.response;
  const settings = await readPromptPresetSettings();
  return NextResponse.json(settings);
}

export async function POST(request) {
  const authorization = await requireOperator(request);
  if (!authorization.ok) return authorization.response;
  try {
    const payload = await request.json();
    const settings = await savePromptPreset(payload || {});
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not save prompt preset." }, { status: 400 });
  }
}
