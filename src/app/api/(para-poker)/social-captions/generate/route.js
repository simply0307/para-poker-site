import { requireOperator } from "@/modules/para-poker/lib/auth/operatorAuthorization";
import { NextResponse } from "next/server";
import { callNewsroomAiJson } from "@/modules/para-poker/lib/newsroom/aiClient";
import { buildSocialCaptionInputPacket } from "@/modules/para-poker/lib/newsroom/contextPackets";
import { logGeneration, saveNewsroomDraft } from "@/modules/para-poker/lib/newsroom/drafts";
import { socialCaptionDraftSchema, validateDraftShape } from "@/modules/para-poker/lib/newsroom/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const authorization = await requireOperator(request);
  if (!authorization.ok) return authorization.response;

  try {
    const body = await request.json().catch(() => ({}));
    const captionRequest = {
      sourceType: body.sourceType || body.source_type || "session",
      sessionId: body.sessionId || "S0-001",
      playerId: body.playerId || "",
      momentId: body.momentId || "",
      seasonCode: body.seasonCode || "S0",
      variation: body.variation || body.variationKey || "",
      editorialNotes: body.editorialNotes || "",
      promptConfig: body.promptConfig || {},
    };
    const input = await buildSocialCaptionInputPacket(captionRequest);
    const aiResult = await callNewsroomAiJson({
      scope: "social_caption",
      schema: socialCaptionDraftSchema,
      packet: input.packet,
    });
    const shapeErrors = validateDraftShape(aiResult.draft, [
      "headline",
      "subheadline",
      "caption",
      "alt_caption",
      "card_text",
      "platform_variants",
      "confidence_notes",
      "missing_data_warnings",
    ]);

    if (shapeErrors.length) {
      return NextResponse.json({ error: "AI response failed validation.", details: shapeErrors }, { status: 502 });
    }

    const draft = await saveNewsroomDraft({
      table: "social_caption_drafts",
      scope: input.scope,
      sourceSessionId: input.sourceSessionId,
      sourcePlayerId: input.sourcePlayerId,
      seasonCode: input.seasonCode,
      momentId: input.momentId,
      articleRequest: captionRequest,
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
    const message = error instanceof Error ? error.message : "Could not generate social caption draft.";
    await logGeneration({ scope: "social_caption", generationError: message, fallbackTrace: error?.fallbackTrace || [] });
    const status = /quota|rate limit/i.test(message) ? 429 : /missing .*api_key/i.test(message) ? 503 : 500;
    return NextResponse.json({ error: message, fallbackTrace: error?.fallbackTrace || [] }, { status });
  }
}
