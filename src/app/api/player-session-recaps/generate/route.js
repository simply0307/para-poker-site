import { NextResponse } from "next/server";
import { buildPlayerSessionRecapInputPacket } from "@/lib/newsroom/contextPackets";
import { callNewsroomAiJson } from "@/lib/newsroom/aiClient";
import { logGeneration, saveNewsroomDraft } from "@/lib/newsroom/drafts";
import { articleDraftSchema, validateDraftShape } from "@/lib/newsroom/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const input = await buildPlayerSessionRecapInputPacket({
      playerId: body.playerId || "",
      sessionId: body.sessionId || "",
      editorialNotes: body.editorialNotes || "",
      variation: body.variation || body.variationKey || "",
    });
    const aiResult = await callNewsroomAiJson({ scope: "player", schema: articleDraftSchema, packet: input.packet });
    const shapeErrors = validateDraftShape(aiResult.draft, ["headline", "subheadline", "article_body", "key_takeaways", "confidence_notes", "missing_data_warnings"]);
    if (shapeErrors.length) return NextResponse.json({ error: "AI response failed validation.", details: shapeErrors }, { status: 502 });

    const draft = await saveNewsroomDraft({
      table: "player_session_recap_drafts",
      scope: "player_session",
      sourcePlayerId: input.sourcePlayerId,
      sourceSessionId: input.sourceSessionId,
      articleRequest: { playerId: body.playerId || "", sessionId: body.sessionId || "", editorialNotes: body.editorialNotes || "", variation: body.variation || body.variationKey || "" },
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
    const message = error instanceof Error ? error.message : "Could not generate player-session draft.";
    await logGeneration({ scope: "player_session", generationError: message, fallbackTrace: error?.fallbackTrace || [] });
    const status = /quota|rate limit/i.test(message) ? 429 : /missing .*api_key/i.test(message) ? 503 : 500;
    return NextResponse.json({ error: message, fallbackTrace: error?.fallbackTrace || [] }, { status });
  }
}
