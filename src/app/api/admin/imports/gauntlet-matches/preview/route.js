import { NextResponse } from "next/server";
import { persistGauntletMatchPreview } from "@/lib/imports/gauntletMatchImportRepository";
import { requireOperator } from "@/lib/auth/operatorAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mappings(value) {
  if (!value) return {};
  const parsed = JSON.parse(String(value));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new TypeError("Participant mappings must be a JSON object.");
  return Object.fromEntries(Object.entries(parsed).map(([sourcePlayerId, leaguePlayerId]) => [String(sourcePlayerId), String(leaguePlayerId)]));
}

export async function POST(request) {
  const authorization = await requireOperator(request);
  if (!authorization.ok) return authorization.response;
  try {
    const form = await request.formData();
    const uploaded = form.get("file");
    if (!uploaded || typeof uploaded.arrayBuffer !== "function" || uploaded.size <= 0) {
      return NextResponse.json({ error: "Choose a gauntlet.para-match.v2 JSON file." }, { status: 400 });
    }
    const preview = await persistGauntletMatchPreview({
      sourceBytes: new Uint8Array(await uploaded.arrayBuffer()),
      source: { filename: uploaded.name, mediaType: uploaded.type || "application/json" },
      participantMappings: mappings(form.get("participantMappings")),
      metadata: {
        sessionCode: form.get("sessionCode"),
        seasonCode: form.get("seasonCode"),
        sessionNumber: form.get("sessionNumber"),
        tableName: form.get("tableName"),
        playedAt: form.get("playedAt"),
        format: form.get("format"),
        replaceExisting: form.get("replaceExisting") === "true",
      },
    });
    return NextResponse.json({ preview });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not preview the Gauntlet match." }, { status: error.status || 400 });
  }
}
