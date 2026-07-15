import { supabase } from "@/lib/supabase";
import {
  aggregatePlayerStats,
  derivePlayerSessionStatsFromRows,
  deriveSessionResultSuggestionsFromRows,
} from "@/lib/stats/calculators";
import { DEFAULT_LEAGUE_RULES } from "@/lib/league/rulesConstants";

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function missingTable(error) {
  const value = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return value.includes("pgrst205") || value.includes("42p01") || value.includes("does not exist") || value.includes("schema cache");
}

export async function safeQuery(query, fallback = null) {
  const { data, error } = await query;
  if (error) return fallback;
  return data;
}

async function getSession(sessionIdOrCode) {
  const key = text(sessionIdOrCode).trim();
  if (!key) return null;
  return (
    (await safeQuery(supabase.from("sessions").select("*").eq("id", key).maybeSingle(), null)) ||
    (await safeQuery(supabase.from("sessions").select("*").ilike("session_code", key).maybeSingle(), null))
  );
}

export async function derivePlayerSessionStats(sessionIdOrCode) {
  const session = await getSession(sessionIdOrCode);
  if (!session) throw new Error("Session not found.");

  const [hands, actions] = await Promise.all([
    safeQuery(supabase.from("hands").select("*").eq("session_id", session.id).order("hand_no", { ascending: true }).limit(10000), []),
    safeQuery(supabase.from("actions").select("*").eq("session_id", session.id).order("log_order", { ascending: true }).limit(50000), []),
  ]);

  return {
    session,
    hands: hands || [],
    actions: actions || [],
    stats: derivePlayerSessionStatsFromRows({ session, hands: hands || [], actions: actions || [] }),
  };
}

export async function recalculatePlayerSessionStats(sessionIdOrCode) {
  const result = await derivePlayerSessionStats(sessionIdOrCode);
  await supabase.from("player_session_stats").delete().eq("session_id", result.session.id);
  if (result.stats.length) {
    const { error } = await supabase.from("player_session_stats").insert(result.stats);
    if (error) throw new Error(`Could not save player session stats: ${error.message}`);
  }
  await logStatRun({
    scope: "session",
    seasonCode: result.session.season_code,
    sessionId: result.session.id,
    summary: { players: result.stats.length, hands: result.hands.length, actions: result.actions.length },
  });
  return result;
}

export async function getSessionResultReview(sessionIdOrCode) {
  const derived = await derivePlayerSessionStats(sessionIdOrCode);
  const existingResults = await safeQuery(
    supabase.from("session_results").select("*").eq("session_id", derived.session.id).order("finish", { ascending: true }),
    []
  );
  const stats = await safeQuery(
    supabase.from("player_session_stats").select("*").eq("session_id", derived.session.id).order("player_name", { ascending: true }),
    []
  );
  const storedStats = stats?.length ? stats : derived.stats;
  return {
    session: derived.session,
    stats: storedStats,
    existingResults: existingResults || [],
    suggestions: deriveSessionResultSuggestionsFromRows({
      session: derived.session,
      sessionStats: storedStats,
      actions: derived.actions,
    }),
  };
}

function pointsForFinish(rules, finish) {
  const base = Number(rules?.pointsByFinish?.[String(finish)] ?? DEFAULT_LEAGUE_RULES.pointsByFinish[String(finish)] ?? 0);
  return base + Number(rules?.participationPoints || 0);
}

export function normalizeConfirmedResults(results = [], { sessionId, rules = DEFAULT_LEAGUE_RULES } = {}) {
  return (results || [])
    .map((row) => {
      const finish = Number(row.finish || 0);
      if (!finish || !row.player_name) return null;
      return {
        session_id: sessionId,
        player_id: row.player_id || null,
        player_name: text(row.player_name),
        finish,
        league_points: Number(row.league_points ?? row.points ?? pointsForFinish(rules, finish)),
        final_stack: Number(row.final_stack || 0),
        confidence: text(row.confidence, "admin_confirmed"),
        notes: text(row.notes),
        approved: true,
      };
    })
    .filter(Boolean)
    .sort((left, right) => Number(left.finish) - Number(right.finish));
}

export async function saveConfirmedSessionResults(sessionIdOrCode, results = [], { rules = DEFAULT_LEAGUE_RULES } = {}) {
  const session = await getSession(sessionIdOrCode);
  if (!session) throw new Error("Session not found.");
  const rows = normalizeConfirmedResults(results, { sessionId: session.id, rules });
  if (!rows.length) throw new Error("At least one confirmed result is required.");

  await supabase.from("session_results").delete().eq("session_id", session.id);
  const { data, error } = await supabase.from("session_results").insert(rows).select("*");
  if (error) throw new Error(`Could not save confirmed session results: ${error.message}`);

  await recalculateSeasonStats(session.season_code || "S0");
  await recalculateCareerStats();

  return {
    session,
    results: data || rows,
  };
}

export async function readPlayerSeasonStats(seasonCode = "S0") {
  return safeQuery(
    supabase
      .from("player_season_stats")
      .select("*")
      .eq("season_code", seasonCode)
      .order("total_points", { ascending: false }),
    []
  );
}

export async function readPlayerCareerStats() {
  return safeQuery(
    supabase
      .from("player_career_stats")
      .select("*")
      .order("total_points", { ascending: false }),
    []
  );
}

async function fetchSeasonInputs(seasonCode = "S0") {
  const sessions = await safeQuery(supabase.from("sessions").select("*").eq("season_code", seasonCode).limit(10000), []);
  const sessionIds = (sessions || []).map((session) => session.id);
  if (!sessionIds.length) return { sessions: [], sessionStats: [], sessionResults: [] };

  const [sessionStats, sessionResults] = await Promise.all([
    safeQuery(supabase.from("player_session_stats").select("*").in("session_id", sessionIds).limit(10000), []),
    safeQuery(supabase.from("session_results").select("*").in("session_id", sessionIds).eq("approved", true).limit(10000), []),
  ]);

  return {
    sessions: sessions || [],
    sessionStats: sessionStats || [],
    sessionResults: sessionResults || [],
  };
}

export async function recalculateSeasonStats(seasonCode = "S0") {
  const inputs = await fetchSeasonInputs(seasonCode);
  const rows = aggregatePlayerStats({ seasonCode, ...inputs });
  await maybeDelete("player_season_stats", "season_code", seasonCode);
  if (rows.length) await maybeInsert("player_season_stats", rows.map((row) => ({ ...row, updated_at: new Date().toISOString() })));
  await rebuildStandingsFromSeasonStats(seasonCode, rows);
  await logStatRun({ scope: "season", seasonCode, summary: { players: rows.length, sessions: inputs.sessions.length } });
  return rows;
}

export async function recalculateCareerStats() {
  const seasons = await safeQuery(supabase.from("player_season_stats").select("*").limit(10000), []);
  if (!seasons?.length) return [];

  const byPlayer = new Map();
  for (const row of seasons) {
    const key = text(row.player_id || row.player_name);
    if (!key) continue;
    if (!byPlayer.has(key)) {
      byPlayer.set(key, {
        player_id: row.player_id || null,
        player_name: row.player_name,
        seasons_played: 0,
        sessions_played: 0,
        hands: 0,
        hands_won: 0,
        total_collected: 0,
        biggest_pot_won: 0,
        all_ins: 0,
        folds: 0,
        wins: 0,
        top_3s: 0,
        top_4s: 0,
        total_points: 0,
        finishes: [],
        vpipNumerator: 0,
        pfrNumerator: 0,
      });
    }
    const next = byPlayer.get(key);
    next.seasons_played += 1;
    next.sessions_played += Number(row.sessions_played || 0);
    next.hands += Number(row.hands || 0);
    next.hands_won += Number(row.hands_won || 0);
    next.total_collected += Number(row.total_collected || 0);
    next.biggest_pot_won = Math.max(next.biggest_pot_won, Number(row.biggest_pot_won || 0));
    next.all_ins += Number(row.all_ins || 0);
    next.folds += Number(row.folds || 0);
    next.wins += Number(row.wins || 0);
    next.top_3s += Number(row.top_3s || 0);
    next.top_4s += Number(row.top_4s || 0);
    next.total_points += Number(row.total_points || 0);
    if (row.best_finish) next.finishes.push(Number(row.best_finish));
    if (row.vpip_pct !== null && row.vpip_pct !== undefined) next.vpipNumerator += Number(row.vpip_pct || 0) * Number(row.hands || 0);
    if (row.pfr_pct !== null && row.pfr_pct !== undefined) next.pfrNumerator += Number(row.pfr_pct || 0) * Number(row.hands || 0);
  }

  const rows = [...byPlayer.values()].map((row) => {
    const vpip_pct = row.hands ? Number((row.vpipNumerator / row.hands).toFixed(1)) : null;
    const pfr_pct = row.hands ? Number((row.pfrNumerator / row.hands).toFixed(1)) : null;
    const { finishes, vpipNumerator, pfrNumerator, ...clean } = row;
    return {
      ...clean,
      hand_win_pct: row.hands ? Number(((row.hands_won / row.hands) * 100).toFixed(1)) : 0,
      fold_pct: row.hands ? Number(((row.folds / row.hands) * 100).toFixed(1)) : 0,
      vpip_pct,
      pfr_pct,
      vpip_pfr_gap: vpip_pct !== null && pfr_pct !== null ? Number((vpip_pct - pfr_pct).toFixed(1)) : null,
      best_finish: finishes.length ? Math.min(...finishes) : null,
      avg_finish: null,
      updated_at: new Date().toISOString(),
    };
  });

  await maybeDeleteAll("player_career_stats");
  if (rows.length) await maybeInsert("player_career_stats", rows);
  await logStatRun({ scope: "career", summary: { players: rows.length } });
  return rows;
}

async function rebuildStandingsFromSeasonStats(seasonCode, seasonRows = []) {
  const standings = [...seasonRows]
    .sort((left, right) =>
      Number(right.total_points || 0) - Number(left.total_points || 0) ||
      Number(right.wins || 0) - Number(left.wins || 0) ||
      Number(left.best_finish || 999) - Number(right.best_finish || 999)
    )
    .map((row, index) => ({
      season_code: seasonCode,
      player_id: row.player_id,
      player_name: row.player_name,
      sessions_played: row.sessions_played,
      total_points: row.total_points,
      wins: row.wins,
      top_3s: row.top_3s,
      top_4s: row.top_4s,
      best_finish: row.best_finish,
      avg_finish: row.avg_finish,
      latest_session_code: row.latest_session_code,
      rank: index + 1,
      updated_at: new Date().toISOString(),
    }));

  await supabase.from("standings").delete().eq("season_code", seasonCode);
  if (standings.length) {
    const { error } = await supabase.from("standings").insert(standings);
    if (error) throw new Error(`Could not rebuild standings: ${error.message}`);
  }
  return standings;
}

async function maybeInsert(table, rows) {
  const { error } = await supabase.from(table).insert(rows);
  if (error && !missingTable(error)) throw new Error(`Could not insert ${table}: ${error.message}`);
}

async function maybeDelete(table, column, value) {
  const { error } = await supabase.from(table).delete().eq(column, value);
  if (error && !missingTable(error)) throw new Error(`Could not clear ${table}: ${error.message}`);
}

async function maybeDeleteAll(table) {
  const { error } = await supabase.from(table).delete().not("id", "is", null);
  if (error && !missingTable(error)) throw new Error(`Could not clear ${table}: ${error.message}`);
}

async function logStatRun({ scope, seasonCode = null, sessionId = null, source = "admin", status = "completed", summary = {} }) {
  const { error } = await supabase.from("stat_recalculation_runs").insert({
    scope,
    season_code: seasonCode,
    session_id: sessionId,
    source,
    status,
    summary,
  });
  if (error && !missingTable(error)) console.warn("[stats] recalculation log failed", error.message);
}
