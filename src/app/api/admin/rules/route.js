import { NextResponse } from "next/server";
import { applyLeagueRules, previewStandingsFromRules, readLeagueRules, saveLeagueRules } from "@/lib/league/rulesRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const seasonCode = searchParams.get("seasonCode") || "S0";
  const result = await readLeagueRules(seasonCode);
  const standings = await previewStandingsFromRules(result.rules);
  return NextResponse.json({ ...result, standings });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body.action === "preview") {
      const standings = await previewStandingsFromRules(body.rules || body);
      return NextResponse.json({ standings });
    }
    if (body.action === "apply") {
      const result = await applyLeagueRules(body.rules || body);
      return NextResponse.json(result);
    }
    const result = await saveLeagueRules(body.rules || body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not update league rules." }, { status: 400 });
  }
}
