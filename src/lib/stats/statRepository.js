import { supabase } from "@/lib/supabase";
import {
  enrichHandWithPotUnits,
  formatBb,
  formatPotWithBb,
} from "@/lib/poker/potUnits";
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
  return value.includes("pgrst205") || value.includes("42p01") || (value.includes("does not exist") && value.includes("table"));
}

function missingSchemaColumn(error) {
  const value = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  if (!value.includes("pgrst204") && !value.includes("schema cache")) return "";
  const match = String(error?.message || "").match(/'([^']+)'\s+column/i);
  return match?.[1] || "";
}

export async function safeQuery(query, fallback = null) {
  const { data, error } = await query;
  if (error) return fallback;
  return data;
}

async function fetchAllRows(query, { pageSize = 1000 } = {}) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function getSession(sessionIdOrCode) {
  const key = text(sessionIdOrCode).trim();
  if (!key) return null;
  return (
    (await safeQuery(supabase.from("sessions").select("*").eq("id", key).maybeSingle(), null)) ||
    (await safeQuery(supabase.from("sessions").select("*").ilike("session_code", key).maybeSingle(), null))
  );
}

function rowKeyCandidates(row = {}) {
  return [
    row.id,
    row.hand_id,
    row.hand_no ? `hand_no:${row.hand_no}` : "",
  ].map((value) => text(value).trim()).filter(Boolean);
}

function groupActionsByHand(actions = []) {
  const byKey = new Map();
  for (const action of actions || []) {
    for (const key of rowKeyCandidates(action)) {
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(action);
    }
  }
  return byKey;
}

function actionsForHand(hand = {}, actionsByHand = new Map()) {
  const seen = new Set();
  const rows = [];
  for (const key of rowKeyCandidates(hand)) {
    for (const action of actionsByHand.get(key) || []) {
      const actionKey = action.id || `${action.hand_id || action.hand_no}-${action.log_order || action.raw_entry}`;
      if (seen.has(actionKey)) continue;
      seen.add(actionKey);
      rows.push(action);
    }
  }
  return rows.sort((left, right) => Number(left.log_order || left.action_order || left.order || 0) - Number(right.log_order || right.action_order || right.order || 0));
}

function potUnitPayload(hand = {}) {
  return {
    small_blind: hand.small_blind || null,
    big_blind: hand.big_blind || null,
    pot_bb: hand.pot_bb || null,
  };
}

async function updatePotUnitRow(table, row, payload) {
  if (!row?.id) return { updated: false };
  const { error } = await supabase.from(table).update(payload).eq("id", row.id);
  if (!error) return { updated: true };
  const column = missingSchemaColumn(error);
  if (column) {
    return {
      updated: false,
      warning: `The ${table}.${column} column is not available through the Supabase schema cache. Run the BB normalization migration and reload the schema before storing normalized pots.`,
    };
  }
  if (missingTable(error)) return { updated: false, warning: `${table} is unavailable.` };
  throw new Error(`Could not update ${table} pot units: ${error.message}`);
}

function normalizationSummary(hands = []) {
  const withBb = hands.filter((hand) => Number(hand.pot_bb || 0) > 0).length;
  const blindLevels = [...new Set(hands.map((hand) => Number(hand.big_blind || 0)).filter(Boolean))].sort((left, right) => left - right);
  const biggest = hands
    .filter((hand) => Number(hand.pot_bb || 0) > 0)
    .sort((left, right) => Number(right.pot_bb || 0) - Number(left.pot_bb || 0))[0] || null;
  return {
    hands: hands.length,
    handsWithBb: withBb,
    coveragePct: hands.length ? Math.round((withBb / hands.length) * 100) : 0,
    blindLevels,
    biggestPotText: biggest ? formatPotWithBb({ pot: biggest.pot_collected, potBb: biggest.pot_bb, bigBlind: biggest.big_blind }) : "",
  };
}

export async function derivePlayerSessionStats(sessionIdOrCode) {
  const session = await getSession(sessionIdOrCode);
  if (!session) throw new Error("Session not found.");

  const [hands, actions] = await Promise.all([
    fetchAllRows(supabase.from("hands").select("*").eq("session_id", session.id).order("hand_no", { ascending: true })),
    fetchAllRows(supabase.from("actions").select("*").eq("session_id", session.id).order("log_order", { ascending: true })),
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
  const summary = { players: result.stats.length, hands: result.hands.length, actions: result.actions.length };
  await supabase.from("player_session_stats").delete().eq("session_id", result.session.id);
  if (result.stats.length) {
    await maybeInsert("player_session_stats", result.stats);
  }
  await logStatRun({
    scope: "session",
    seasonCode: result.session.season_code,
    sessionId: result.session.id,
    summary,
  });
  return { ...result, summary };
}

export async function backfillSessionPotNormalization(sessionIdOrCode) {
  const session = await getSession(sessionIdOrCode);
  if (!session) throw new Error("Session not found.");

  const [hands, notableHands, actions] = await Promise.all([
    fetchAllRows(supabase.from("hands").select("*").eq("session_id", session.id).order("hand_no", { ascending: true })),
    fetchAllRows(supabase.from("notable_hands").select("*").eq("session_id", session.id).order("hand_no", { ascending: true })),
    fetchAllRows(supabase.from("actions").select("*").eq("session_id", session.id).order("log_order", { ascending: true })),
  ]);
  const actionsByHand = groupActionsByHand(actions || []);
  const enrichedHands = (hands || []).map((hand) => enrichHandWithPotUnits(hand, actionsForHand(hand, actionsByHand)));
  const enrichedNotables = (notableHands || []).map((hand) => enrichHandWithPotUnits(hand, actionsForHand(hand, actionsByHand)));

  let storedHands = 0;
  let storedNotables = 0;
  let warning = "";

  for (const hand of enrichedHands) {
    const result = await updatePotUnitRow("hands", hand, potUnitPayload(hand));
    if (result.warning) {
      warning = result.warning;
      break;
    }
    if (result.updated) storedHands += 1;
  }

  if (!warning) {
    for (const hand of enrichedNotables) {
      const result = await updatePotUnitRow("notable_hands", hand, potUnitPayload(hand));
      if (result.warning) {
        warning = result.warning;
        break;
      }
      if (result.updated) storedNotables += 1;
    }
  }

  const sessionStats = await recalculatePlayerSessionStats(session.id);
  const seasonStats = await recalculateSeasonStats(session.season_code || "S0");
  const careerStats = await recalculateCareerStats();
  const summary = {
    ...normalizationSummary(enrichedHands),
    sessionCode: session.session_code || session.id,
    storedHands,
    storedNotables,
    statsPlayers: sessionStats.stats.length,
    seasonPlayers: seasonStats.length,
    careerPlayers: careerStats.length,
    biggestPotBbText: enrichedHands.length
      ? formatBb(Math.max(0, ...enrichedHands.map((hand) => Number(hand.pot_bb || 0))), "")
      : "",
    warning,
  };

  await logStatRun({
    scope: "session",
    seasonCode: session.season_code,
    sessionId: session.id,
    source: "admin_bb_backfill",
    status: warning ? "completed_with_warning" : "completed",
    summary,
  });

  return { session, summary };
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
  const ordered = await safeQuery(
    supabase
      .from("player_season_stats")
      .select("*")
      .eq("season_code", seasonCode)
      .order("total_points", { ascending: false }),
    null
  );
  if (ordered) return ordered;
  return safeQuery(supabase.from("player_season_stats").select("*").eq("season_code", seasonCode), []);
}

export async function readPlayerCareerStats() {
  const ordered = await safeQuery(
    supabase
      .from("player_career_stats")
      .select("*")
      .order("total_points", { ascending: false }),
    null
  );
  if (ordered) return ordered;
  return safeQuery(supabase.from("player_career_stats").select("*"), []);
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
        total_collected_bb: 0,
        biggest_pot_won: 0,
        biggest_pot_won_bb: 0,
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
    next.total_collected_bb += Number(row.total_collected_bb || 0);
    next.biggest_pot_won = Math.max(next.biggest_pot_won, Number(row.biggest_pot_won || 0));
    next.biggest_pot_won_bb = Math.max(next.biggest_pot_won_bb, Number(row.biggest_pot_won_bb || 0));
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
  let payload = rows.map((row) => ({ ...row }));
  const removedColumns = [];

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const { error } = await supabase.from(table).insert(payload);
    if (!error) {
      if (removedColumns.length) {
        console.warn("[stats] aggregate insert dropped missing columns", { table, removedColumns });
      }
      return;
    }
    if (missingTable(error)) return;
    const column = missingSchemaColumn(error);
    if (column && payload.some((row) => column in row)) {
      removedColumns.push(column);
      payload = payload.map((row) => {
        const next = { ...row };
        delete next[column];
        return next;
      });
      continue;
    }
    throw new Error(`Could not insert ${table}: ${error.message}`);
  }

  throw new Error(`Could not insert ${table}: schema cache kept rejecting aggregate columns.`);
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
