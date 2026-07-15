import { NextResponse } from "next/server";
import { readLeagueRules } from "@/lib/league/rulesRepository";
import { getSessionResultReview, saveConfirmedSessionResults } from "@/lib/stats/statRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  try {
    const { sessionId } = await params;
    const review = await getSessionResultReview(sessionId);
    const rules = await readLeagueRules(review.session.season_code || "S0");
    return NextResponse.json({ ...review, rules: rules.rules, rulesWarning: rules.warning });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not load session result review." }, { status: 400 });
  }
}

export async function POST(request, { params }) {
  try {
    const { sessionId } = await params;
    const body = await request.json().catch(() => ({}));
    const review = await getSessionResultReview(sessionId);
    const rules = await readLeagueRules(review.session.season_code || "S0");
    const result = await saveConfirmedSessionResults(sessionId, body.results || [], { rules: rules.rules });
    return NextResponse.json({ ...result, rules: rules.rules });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not approve session results." }, { status: 400 });
  }
}
