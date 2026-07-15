import { safeQuery, supabase, text } from "@/lib/newsroom/data";
import { DEFAULT_LEAGUE_RULES } from "@/lib/league/rulesConstants";
import { recalculateCareerStats, recalculateSeasonStats } from "@/lib/stats/statRepository";

export { DEFAULT_LEAGUE_RULES };

function normalizeRules(input = {}) {
  const source = input.rules || input;
  const pointsByFinish = Object.fromEntries(
    Object.entries(source.pointsByFinish || source.points_by_finish || DEFAULT_LEAGUE_RULES.pointsByFinish)
      .map(([finish, points]) => [String(Number(finish)), Number(points || 0)])
      .filter(([finish]) => Number.isFinite(Number(finish)) && Number(finish) > 0)
  );

  return {
    seasonCode: text(source.seasonCode || source.season_code, DEFAULT_LEAGUE_RULES.seasonCode),
    name: text(source.name, DEFAULT_LEAGUE_RULES.name),
    pointsByFinish,
    participationPoints: Number(source.participationPoints ?? source.participation_points ?? DEFAULT_LEAGUE_RULES.participationPoints) || 0,
    minimumHandsForPoints: Number(source.minimumHandsForPoints ?? source.minimum_hands_for_points ?? DEFAULT_LEAGUE_RULES.minimumHandsForPoints) || 0,
    tiebreakers: Array.isArray(source.tiebreakers) ? source.tiebreakers.map(String) : DEFAULT_LEAGUE_RULES.tiebreakers,
    importRules: {
      ...DEFAULT_LEAGUE_RULES.importRules,
      ...(source.importRules || source.import_rules || {}),
    },
  };
}

function missingRulesTable(error) {
  const value = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return value.includes("pgrst205") || value.includes("league_rules") || value.includes("does not exist");
}

async function getSeasonSessions(seasonCode = "S0") {
  return safeQuery(supabase.from("sessions").select("id, session_code, season_code").eq("season_code", seasonCode).limit(10000), []);
}

async function getApprovedSeasonResults(seasonCode = "S0") {
  const sessions = await getSeasonSessions(seasonCode);
  const sessionIds = new Set((sessions || []).map((session) => String(session.id)));
  const sessionCodeById = new Map((sessions || []).map((session) => [String(session.id), session.session_code]));
  const results = await safeQuery(supabase.from("session_results").select("*").eq("approved", true).limit(10000), []);

  return {
    sessions,
    sessionCodeById,
    results: (results || []).filter((result) => sessionIds.has(String(result.session_id))),
  };
}

function deriveRulesFromResults(results = [], seasonCode = "S0") {
  const pointsByFinish = {};
  for (const result of results) {
    const finish = Number(result.finish || 0);
    if (!finish) continue;
    const points = Number(result.league_points || result.points || 0);
    if (!pointsByFinish[String(finish)] || points > pointsByFinish[String(finish)]) {
      pointsByFinish[String(finish)] = points;
    }
  }

  return normalizeRules({
    ...DEFAULT_LEAGUE_RULES,
    seasonCode,
    name: `${seasonCode} points from session_results`,
    pointsByFinish: Object.keys(pointsByFinish).length ? pointsByFinish : DEFAULT_LEAGUE_RULES.pointsByFinish,
  });
}

async function readLeagueRulesRecord(seasonCode = "S0") {
  const { data, error } = await supabase
    .from("league_rules")
    .select("*")
    .eq("season_code", seasonCode)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (missingRulesTable(error)) return { row: null, tableMissing: true };
    throw new Error(error.message);
  }

  return { row: data || null, tableMissing: false };
}

async function saveLeagueRulesRecord(rules, { applied = false } = {}) {
  const payload = {
    season_code: rules.seasonCode,
    name: rules.name,
    status: "active",
    scoring_rules: {
      pointsByFinish: rules.pointsByFinish,
      participationPoints: rules.participationPoints,
      minimumHandsForPoints: rules.minimumHandsForPoints,
      tiebreakers: rules.tiebreakers,
    },
    import_rules: rules.importRules || DEFAULT_LEAGUE_RULES.importRules,
    updated_at: new Date().toISOString(),
    ...(applied ? { applied_at: new Date().toISOString() } : {}),
  };

  const existing = await readLeagueRulesRecord(rules.seasonCode);
  if (existing.tableMissing) return { storage: "session_results", warning: "league_rules table is not available yet; scoring changes were applied to session_results only." };

  const { data, error } = existing.row?.id
    ? await supabase.from("league_rules").update(payload).eq("id", existing.row.id).select("*").single()
    : await supabase.from("league_rules").insert(payload).select("*").single();

  if (error) throw new Error(`Could not save league_rules record: ${error.message}`);
  return { storage: "league_rules + session_results", warning: "", row: data };
}

export async function readLeagueRules(seasonCode = "S0") {
  const record = await readLeagueRulesRecord(seasonCode);
  if (record.row) {
    return {
      rules: normalizeRules({
        ...(record.row.scoring_rules || {}),
        seasonCode: record.row.season_code,
        name: record.row.name,
        importRules: record.row.import_rules,
      }),
      storage: "league_rules",
      warning: "",
    };
  }

  const { results } = await getApprovedSeasonResults(seasonCode);
  const rules = deriveRulesFromResults(results, seasonCode);
  return {
    rules,
    storage: "session_results",
    warning: record.tableMissing
      ? "league_rules table is not available yet, so scoring is being derived from approved session_results."
      : results.length
        ? ""
        : "No active league_rules row or approved session_results rows were found for this season yet, so default point values are shown until results exist.",
  };
}

export async function saveLeagueRules(input = {}) {
  const rules = normalizeRules(input);
  const { results } = await getApprovedSeasonResults(rules.seasonCode);

  if (!results.length) {
    throw new Error("No approved session_results rows exist for this season, so there are no league point rows to update yet.");
  }

  for (const [finish, points] of Object.entries(rules.pointsByFinish || {})) {
    const finalPoints = Number(points || 0) + Number(rules.participationPoints || 0);
    const { error } = await supabase
      .from("session_results")
      .update({ league_points: finalPoints })
      .eq("finish", Number(finish))
      .eq("approved", true)
      .in("session_id", results.map((result) => result.session_id));

    if (error) throw new Error(`Could not update session_results for finish ${finish}: ${error.message}`);
  }

  const stored = await saveLeagueRulesRecord(rules);
  return {
    rules,
    storage: stored.storage,
    warning: stored.warning || "Updated approved session_results.league_points for this season. Recalculate standings to refresh the public board.",
  };
}

function pointsForFinish(rules, finish) {
  const base = Number(rules.pointsByFinish?.[String(finish)] || 0);
  return base + Number(rules.participationPoints || 0);
}

export async function previewStandingsFromRules(rulesInput = {}) {
  const rules = normalizeRules(rulesInput);
  const { results, sessionCodeById } = await getApprovedSeasonResults(rules.seasonCode);
  const byPlayer = new Map();

  for (const result of results || []) {
    const playerKey = text(result.player_id || result.player_name);
    if (!playerKey) continue;
    if (!byPlayer.has(playerKey)) {
      byPlayer.set(playerKey, {
        season_code: rules.seasonCode,
        player_id: result.player_id,
        player_name: result.player_name,
        sessions_played: 0,
        total_points: 0,
        wins: 0,
        top_3s: 0,
        top_4s: 0,
        best_finish: null,
        finishes: [],
        latest_session_code: "",
      });
    }
    const row = byPlayer.get(playerKey);
    const finish = Number(result.finish || 0);
    row.sessions_played += 1;
    row.total_points += pointsForFinish(rules, finish);
    row.wins += finish === 1 ? 1 : 0;
    row.top_3s += finish > 0 && finish <= 3 ? 1 : 0;
    row.top_4s += finish > 0 && finish <= 4 ? 1 : 0;
    row.best_finish = row.best_finish ? Math.min(row.best_finish, finish) : finish || null;
    if (finish) row.finishes.push(finish);
    row.latest_session_code = sessionCodeById.get(String(result.session_id)) || row.latest_session_code;
  }

  return [...byPlayer.values()]
    .map((row) => ({
      ...row,
      avg_finish: row.finishes.length ? Number((row.finishes.reduce((sum, finish) => sum + finish, 0) / row.finishes.length).toFixed(2)) : null,
    }))
    .sort((left, right) =>
      Number(right.total_points || 0) - Number(left.total_points || 0) ||
      Number(right.wins || 0) - Number(left.wins || 0) ||
      Number(left.best_finish || 999) - Number(right.best_finish || 999)
    )
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
}

export async function applyLeagueRules(input = {}) {
  const saved = await saveLeagueRules(input);
  await recalculateSeasonStats(saved.rules.seasonCode);
  await recalculateCareerStats();
  const standings = await previewStandingsFromRules(saved.rules);
  const stored = await saveLeagueRulesRecord(saved.rules, { applied: true });
  return {
    ...saved,
    storage: stored.storage,
    warning: stored.warning || "",
    standings,
  };
}
