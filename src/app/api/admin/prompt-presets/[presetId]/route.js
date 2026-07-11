import { NextResponse } from "next/server";
import { deletePromptPreset } from "@/lib/newsroom/promptPresetStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_request, { params }) {
  const { presetId } = await params;
  const settings = await deletePromptPreset(presetId);
  return NextResponse.json(settings);
}
