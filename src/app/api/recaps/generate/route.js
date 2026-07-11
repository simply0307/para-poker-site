import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { buildSessionRecapInputPacket } from "@/lib/newsroom/contextPackets";
import { callNewsroomAiJson, getNewsroomAiDiagnostics } from "@/lib/newsroom/aiClient";
import { logGeneration, saveRecapDraft } from "@/lib/newsroom/drafts";
import { editorialDocIds } from "@/lib/newsroom/editorialDocs";
import { sessionRecapDraftSchema, validateDraftShape } from "@/lib/newsroom/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    console.info("[api/recaps/generate] env diagnostics", getNewsroomAiDiagnostics());

    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    }

    const input = await buildSessionRecapInputPacket(sessionId, {
      variation: body.variation || body.variationKey || "",
      promptConfig: body.promptConfig || {},
    });
    console.info("[api/recaps/generate] editorial docs included", {
      ids: editorialDocIds(input.packet.editorial_docs),
      sessionMagicGuide: input.packet.session_recap_magic_guide?.included
        ? input.packet.session_recap_magic_guide.id
        : "missing",
    });
    const aiResult = await callNewsroomAiJson({
      scope: "session",
      schema: sessionRecapDraftSchema,
      packet: input.packet,
    });
    const shapeErrors = validateDraftShape(aiResult.draft, [
      "headline",
      "subheadline",
      "recap_body",
      "key_moments",
      "player_blurbs",
      "confidence_notes",
      "missing_data_warnings",
    ]);

    if (shapeErrors.length) {
      return NextResponse.json({ error: "AI response failed validation.", details: shapeErrors }, { status: 502 });
    }

    const draft = await saveRecapDraft({
      scope: input.scope,
      sourceSessionId: input.sourceSessionId,
      contextPacket: input.packet,
      draft: aiResult.draft,
      provider: aiResult.provider,
      modelUsed: aiResult.model,
      fallbackTrace: aiResult.fallbackTrace || [],
      promptVersion: input.promptVersion,
      sourceDataVersion: input.sourceDataVersion,
    });

    revalidatePath(`/admin/sessions/${encodeURIComponent(sessionId)}`);

    return NextResponse.json({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate recap draft.";
    await logGeneration({ scope: "session", generationError: message, fallbackTrace: error?.fallbackTrace || [] });
    const status = /quota|rate limit/i.test(message) ? 429 : /missing .*api_key/i.test(message) ? 503 : 500;
    return NextResponse.json({ error: message, fallbackTrace: error?.fallbackTrace || [] }, { status });
  }
}
