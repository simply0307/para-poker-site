import { NextResponse } from "next/server";
import { readPromptPresetSettings, savePromptPreset } from "@/lib/newsroom/promptPresetStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await readPromptPresetSettings();
  return NextResponse.json(settings);
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const settings = await savePromptPreset(payload || {});
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not save prompt preset." }, { status: 400 });
  }
}
