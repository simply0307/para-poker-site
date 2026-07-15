import { NextResponse } from "next/server";
import { readLeagueRules } from "@/lib/league/rulesRepository";
import {
  backfillSessionPotNormalization,
  getSessionResultReview,
  recalculateCareerStats,
  recalculatePlayerSessionStats,
  recalculateSeasonStats,
  saveConfirmedSessionResults,
} from "@/lib/stats/statRepository";

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

export async function PUT(request, { params }) {
  try {
    const { sessionId } = await params;
    const body = await request.json().catch(() => ({}));
    const review = await getSessionResultReview(sessionId);
    const action = body.action || "recalculate_session";

    if (action === "recalculate_session") {
      const result = await recalculatePlayerSessionStats(sessionId);
      return NextResponse.json({
        action,
        session: result.session,
        summary: result.summary,
        stats: result.stats,
      });
    }

    if (action === "recalculate_season") {
      const sessionStats = await recalculatePlayerSessionStats(sessionId);
      const seasonStats = await recalculateSeasonStats(review.session.season_code || "S0");
      const careerStats = await recalculateCareerStats();
      return NextResponse.json({
        action,
        session: sessionStats.session,
        sessionSummary: sessionStats.summary,
        seasonSummary: { seasonCode: review.session.season_code || "S0", players: seasonStats.length },
        careerSummary: { players: careerStats.length },
      });
    }

    if (action === "backfill_bb") {
      const result = await backfillSessionPotNormalization(sessionId);
      return NextResponse.json({
        action,
        session: result.session,
        summary: result.summary,
        warning: result.summary.warning || "",
      });
    }

    return NextResponse.json({ error: "Unknown recalculation action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not recalculate stats." }, { status: 400 });
  }
}
