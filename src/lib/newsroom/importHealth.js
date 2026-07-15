import { cleanName, formatDate, safeQuery, safeQueryAll, supabase, text } from "@/lib/newsroom/data";

function groupCount(rows = [], keyName = "session_id") {
  const counts = new Map();
  for (const row of rows || []) {
    const key = text(row?.[keyName]);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function actionHands(actions = []) {
  const groups = new Map();
  for (const action of actions || []) {
    const sessionId = text(action.session_id);
    const handKey = action.hand_no ? `hand_no:${action.hand_no}` : text(action.hand_id);
    if (!sessionId || !handKey) continue;
    if (!groups.has(sessionId)) groups.set(sessionId, new Set());
    groups.get(sessionId).add(handKey);
  }
  return groups;
}

function percent(covered, total) {
  const parsedTotal = Number(total);
  const parsedCovered = Number(covered);
  if (!parsedTotal || !Number.isFinite(parsedTotal)) return null;
  return Math.round((parsedCovered / parsedTotal) * 100);
}

function sessionStatus(coverage) {
  if (!coverage.handsImported) return "Needs hands";
  if (!coverage.actionRows) return "Needs actions";
  if (!coverage.resultRows) return "Needs results";
  if (coverage.actionCoverage !== null && coverage.actionCoverage < 100) return "Partial actions";
  return "Ready";
}

function sessionIssues(coverage) {
  const issues = [];
  if (!coverage.handsImported) issues.push("No hands imported");
  if (!coverage.actionRows) issues.push("No action rows");
  if (!coverage.resultRows) issues.push("No result rows");
  if (!coverage.statRows) issues.push("No player stat rows");
  if (!coverage.notableHands) issues.push("No notable hands selected");
  if (coverage.declaredHands && coverage.handsImported && coverage.handsImported < coverage.declaredHands) {
    issues.push(`${coverage.declaredHands - coverage.handsImported} hands missing from imported hands table`);
  }
  if (coverage.actionCoverage !== null && coverage.actionCoverage < 100) {
    issues.push(`${coverage.actionCoverage}% of imported hands have action coverage`);
  }
  return issues;
}

export async function buildImportHealthViewModel() {
  const [sessions, hands, actions, notableHands, sessionResults, playerSessionStats] = await Promise.all([
    safeQuery(
      supabase
        .from("sessions")
        .select("id, session_code, season_code, session_number, played_at, table_name, format, status, hands_count, players_count")
        .order("session_number", { ascending: false }),
      []
    ),
    safeQueryAll(supabase.from("hands").select("*"), []),
    safeQueryAll(supabase.from("actions").select("*"), []),
    safeQueryAll(supabase.from("notable_hands").select("*"), []),
    safeQueryAll(supabase.from("session_results").select("*"), []),
    safeQueryAll(supabase.from("player_session_stats").select("*"), []),
  ]);

  const handsBySession = groupCount(hands);
  const actionsBySession = groupCount(actions);
  const actionHandsBySession = actionHands(actions);
  const notableBySession = groupCount(notableHands);
  const resultsBySession = groupCount(sessionResults);
  const statsBySession = groupCount(playerSessionStats);

  const sessionCoverage = (sessions || []).map((session) => {
    const sessionId = text(session.id);
    const declaredHands = Number(session.hands_count || 0);
    const handsImported = handsBySession.get(sessionId) || 0;
    const handsWithActions = actionHandsBySession.get(sessionId)?.size || 0;
    const coverage = {
      id: sessionId,
      sessionCode: text(session.session_code || session.id, "Session"),
      seasonCode: text(session.season_code, "S0"),
      sessionNumber: session.session_number,
      playedAt: session.played_at,
      playedAtLabel: formatDate(session.played_at),
      tableName: text(session.table_name, "Table pending"),
      format: text(session.format, "Imported hand history"),
      status: text(session.status, "unknown"),
      playersCount: session.players_count,
      declaredHands,
      handsImported,
      handsWithActions,
      actionRows: actionsBySession.get(sessionId) || 0,
      notableHands: notableBySession.get(sessionId) || 0,
      resultRows: resultsBySession.get(sessionId) || 0,
      statRows: statsBySession.get(sessionId) || 0,
      actionCoverage: percent(handsWithActions, handsImported || declaredHands),
    };

    return {
      ...coverage,
      importStatus: sessionStatus(coverage),
      issues: sessionIssues(coverage),
    };
  });

  const totals = {
    sessions: sessions?.length || 0,
    hands: hands?.length || 0,
    actions: actions?.length || 0,
    notableHands: notableHands?.length || 0,
    results: sessionResults?.length || 0,
    playerStats: playerSessionStats?.length || 0,
    readySessions: sessionCoverage.filter((session) => session.importStatus === "Ready").length,
    sessionsNeedingAttention: sessionCoverage.filter((session) => session.importStatus !== "Ready").length,
  };

  const topActionPlayers = Object.entries(
    [...(sessionResults || []), ...(playerSessionStats || [])].reduce((acc, row) => {
      const name = cleanName(row.player_name, "");
      if (!name) return acc;
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {})
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));

  return {
    totals,
    sessions: sessionCoverage,
    playersSeen: topActionPlayers,
    generatedAt: new Date().toISOString(),
  };
}
