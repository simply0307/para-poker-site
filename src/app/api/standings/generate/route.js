import { NextResponse } from "next/server";
import { buildStandingsInputPacket } from "@/lib/newsroom/contextPackets";
import { callNewsroomAiJson } from "@/lib/newsroom/aiClient";
import { logGeneration, saveNewsroomDraft } from "@/lib/newsroom/drafts";
import { articleDraftSchema, validateDraftShape } from "@/lib/newsroom/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const input = await buildStandingsInputPacket(body.seasonCode || "S0", body.editorialNotes || "", {
      variation: body.variation || body.variationKey || "",
      promptConfig: body.promptConfig || {},
    });
    const aiResult = await callNewsroomAiJson({ scope: "season", schema: articleDraftSchema, packet: input.packet });
    const shapeErrors = validateDraftShape(aiResult.draft, ["headline", "subheadline", "article_body", "key_takeaways", "confidence_notes", "missing_data_warnings"]);
    if (shapeErrors.length) return NextResponse.json({ error: "AI response failed validation.", details: shapeErrors }, { status: 502 });

    const draft = await saveNewsroomDraft({
      table: "standings_drafts",
      scope: "season",
      seasonCode: body.seasonCode || "S0",
      articleRequest: { seasonCode: body.seasonCode || "S0", editorialNotes: body.editorialNotes || "", variation: body.variation || body.variationKey || "", promptConfig: body.promptConfig || {} },
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
    const message = error instanceof Error ? error.message : "Could not generate standings draft.";
    await logGeneration({ scope: "season", generationError: message, fallbackTrace: error?.fallbackTrace || [] });
    const status = /quota|rate limit/i.test(message) ? 429 : /missing .*api_key/i.test(message) ? 503 : 500;
    return NextResponse.json({ error: message, fallbackTrace: error?.fallbackTrace || [] }, { status });
  }
}
