import { NextResponse } from "next/server";
import { buildPlayerRecapInputPacket } from "@/lib/newsroom/contextPackets";
import { callNewsroomAiJson } from "@/lib/newsroom/aiClient";
import { saveRecapDraft } from "@/lib/newsroom/drafts";
import { profileDraftSchema, validateDraftShape } from "@/lib/newsroom/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const playerId = typeof body.playerId === "string" ? body.playerId.trim() : "";

    if (!playerId) {
      return NextResponse.json({ error: "playerId is required." }, { status: 400 });
    }

    const input = await buildPlayerRecapInputPacket(playerId);
    const aiResult = await callNewsroomAiJson({
      scope: "player",
      schema: profileDraftSchema,
      packet: input.packet,
    });
    const shapeErrors = validateDraftShape(aiResult.draft, [
      "headline",
      "subheadline",
      "profile_body",
      "player_blurbs",
      "confidence_notes",
      "missing_data_warnings",
    ]);

    if (shapeErrors.length) {
      return NextResponse.json({ error: "AI response failed validation.", details: shapeErrors }, { status: 502 });
    }

    const draft = await saveRecapDraft({
      scope: input.scope,
      sourcePlayerId: input.sourcePlayerId,
      contextPacket: input.packet,
      draft: aiResult.draft,
      provider: aiResult.provider,
      modelUsed: aiResult.model,
      fallbackTrace: aiResult.fallbackTrace || [],
      promptVersion: input.promptVersion,
      sourceDataVersion: input.sourceDataVersion,
    });

    return NextResponse.json({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate profile draft.";
    const status = /quota|rate limit/i.test(message) ? 429 : /missing .*api_key/i.test(message) ? 503 : 500;
    return NextResponse.json({ error: message, fallbackTrace: error?.fallbackTrace || [] }, { status });
  }
}
