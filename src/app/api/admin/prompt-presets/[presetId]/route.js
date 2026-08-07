import { NextResponse } from "next/server";
import { requireOperator } from "@/lib/auth/operatorAuthorization";
import { deletePromptPreset } from "@/lib/newsroom/promptPresetStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_request, { params }) {
  const authorization = await requireOperator(_request);
  if (!authorization.ok) return authorization.response;
  const { presetId } = await params;
  const settings = await deletePromptPreset(presetId);
  return NextResponse.json(settings);
}
