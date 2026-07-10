import { supabase } from "@/lib/supabase";

export { supabase };

export function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

export function cleanName(value, fallback = "Unknown Player") {
  return text(value, fallback).replace(/\s+@\s+\S+\s*$/u, "").trim();
}

export function normalizePlayerName(name) {
  return cleanName(name, "")
    .toLowerCase()
    .replace(/\s+@\s+\S+\s*$/u, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function formatDate(value) {
  if (!value) return "Date pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date pending";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatNumber(value, fallback = "-") {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString("en-US") : text(value, fallback);
}

export function formatPokerPercent(value) {
  if (!present(value)) return "";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return text(value);
  const percent = parsed <= 1 ? parsed * 100 : parsed;
  return `${percent.toFixed(percent % 1 === 0 ? 0 : 1)}%`;
}

export function present(value) {
  return value !== null && value !== undefined && value !== "";
}

export async function safeQuery(query, fallback = null) {
  const { data, error } = await query;
  if (error) return fallback;
  return data;
}

export async function getSessionByIdOrCode(sessionIdOrCode) {
  const key = text(sessionIdOrCode).trim();
  if (!key) return null;

  return (
    (await safeQuery(supabase.from("sessions").select("*").eq("id", key).maybeSingle())) ||
    (await safeQuery(supabase.from("sessions").select("*").ilike("session_code", key).maybeSingle()))
  );
}

export async function getPlayerByIdOrSlug(playerIdOrSlug) {
  const key = text(playerIdOrSlug).trim();
  if (!key) return null;

  return (
    (await safeQuery(supabase.from("players").select("*").eq("id", key).maybeSingle())) ||
    (await safeQuery(supabase.from("players").select("*").ilike("slug", key).maybeSingle()))
  );
}

export async function getSessionsIndex() {
  return safeQuery(
    supabase
      .from("sessions")
      .select("id, session_code, season_code, session_number, played_at, table_name, format, status, hands_count")
      .order("session_number", { ascending: false }),
    []
  );
}

export async function getPlayersIndex() {
  return safeQuery(
    supabase
      .from("players")
      .select("id, slug, display_name, pokernow_name, created_at")
      .order("display_name", { ascending: true }),
    []
  );
}

function playerNameCandidates(player = {}) {
  return [
    player.id,
    player.display_name,
    player.pokernow_name,
    player.slug,
  ].map(normalizePlayerName).filter(Boolean);
}

export function resolvePlayerIdentity(row = {}, players = []) {
  const rowPlayerId = text(row.player_id || row.winner_player_id || row.id);
  if (rowPlayerId) {
    const byId = players.find((player) => String(player.id) === String(rowPlayerId));
    if (byId) return byId;
  }

  const rowNames = [
    row.player_name,
    row.winner_name,
    row.display_name,
    row.pokernow_name,
    ...(Array.isArray(row.involved_players) ? row.involved_players : []),
    ...(Array.isArray(row.player_names) ? row.player_names : []),
  ].map(normalizePlayerName).filter(Boolean);

  return players.find((player) => {
    const candidates = playerNameCandidates(player);
    return rowNames.some((rowName) => candidates.includes(rowName));
  }) || null;
}

function rowMentionsPlayer(row = {}, player = {}) {
  if (!player) return false;
  if (row.player_id && String(row.player_id) === String(player.id)) return true;
  if (row.winner_player_id && String(row.winner_player_id) === String(player.id)) return true;

  const candidates = playerNameCandidates(player);
  const rowNames = [
    row.player_name,
    row.winner_name,
    row.display_name,
    row.pokernow_name,
    ...(Array.isArray(row.involved_players) ? row.involved_players : []),
    ...(Array.isArray(row.player_names) ? row.player_names : []),
    ...(Array.isArray(row.players_involved) ? row.players_involved : []),
  ].map(normalizePlayerName).filter(Boolean);

  const rawText = [
    row.involved_players,
    row.players_involved,
    row.player_names,
    row.raw_result,
    row.summary,
  ].map((value) => (typeof value === "string" ? normalizePlayerName(value) : "")).filter(Boolean);

  return rowNames.some((name) => candidates.includes(name)) || rawText.some((value) => candidates.some((candidate) => value.includes(candidate)));
}


export async function getStandingsRows(seasonCode = "S0") {
  return safeQuery(
    supabase
      .from("standings")
      .select("*")
      .eq("season_code", seasonCode)
      .order("rank", { ascending: true }),
    []
  );
}

export async function getMomentsIndex() {
  return safeQuery(
    supabase
      .from("notable_hands")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40),
    []
  );
}

export async function getPlayerNewsroomData(playerIdOrSlug) {
  const player = await getPlayerByIdOrSlug(playerIdOrSlug);
  if (!player) return null;
  const playerName = cleanName(player.display_name || player.pokernow_name);
  const normalized = normalizePlayerName(playerName);

  const [standingsRows, sessionStatsRows, sessionResultsRows, momentsRows, players] = await Promise.all([
    safeQuery(
      supabase
        .from("standings")
        .select("*")
        .eq("season_code", "S0")
        .order("rank", { ascending: true })
        .limit(100),
      []
    ),
    safeQuery(
      supabase
        .from("player_session_stats")
        .select("*")
        .order("player_name", { ascending: true })
        .limit(200),
      []
    ),
    safeQuery(
      supabase
        .from("session_results")
        .select("*")
        .order("finish", { ascending: true })
        .limit(200),
      []
    ),
    safeQuery(
      supabase
        .from("notable_hands")
        .select("*")
        .order("pot_collected", { ascending: false })
        .limit(200),
      []
    ),
    getPlayersIndex(),
  ]);

  const standings = (standingsRows || []).filter((row) => rowMentionsPlayer(row, player) || normalizePlayerName(row.player_name) === normalized);
  const sessionStats = (sessionStatsRows || []).filter((row) => rowMentionsPlayer(row, player) || normalizePlayerName(row.player_name) === normalized);
  const sessionResults = (sessionResultsRows || []).filter((row) => rowMentionsPlayer(row, player) || normalizePlayerName(row.player_name) === normalized);
  const moments = (momentsRows || []).filter((row) => rowMentionsPlayer(row, player));

  return {
    player,
    players: players || [],
    standings: standings || [],
    sessionStats: sessionStats || [],
    sessionResults: sessionResults || [],
    moments: moments || [],
  };
}

function valueToLogText(value) {
  if (!present(value)) return "";
  if (Array.isArray(value)) return value.map(valueToLogText).filter(Boolean).join("\n");
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return text(value);
}

function streetValue(hand, keys) {
  return keys.map((key) => valueToLogText(hand?.[key])).find(Boolean) || "";
}

function actionAmountText(action) {
  if (!present(action?.amount)) return "";
  const parsed = Number(action.amount);
  return Number.isFinite(parsed) ? formatNumber(parsed) : text(action.amount);
}

function actionPlayerName(action) {
  return cleanName(action?.player_name || action?.player || action?.name, "");
}

function actionText(action) {
  if (present(action?.raw_entry)) return text(action.raw_entry);
  return [
    actionPlayerName(action),
    text(action?.action),
    actionAmountText(action),
    action?.all_in ? "all in" : "",
  ].filter(Boolean).join(" ");
}

function normalizeActionRow(action = {}) {
  return {
    id: action.id || null,
    hand_id: action.hand_id || null,
    hand_no: action.hand_no || null,
    order: action.log_order ?? action.action_order ?? action.order ?? action.id ?? null,
    street: text(action.street || "action").toLowerCase(),
    player_id: action.player_id || null,
    player_name: actionPlayerName(action),
    position: text(action.position),
    action: text(action.action),
    amount: action.amount ?? null,
    amount_text: actionAmountText(action),
    all_in: Boolean(action.all_in),
    raw_entry: text(action.raw_entry),
    line: actionText(action),
  };
}

function groupActionRowsByStreet(actionRows = []) {
  const normalized = actionRows
    .map(normalizeActionRow)
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
  const streetOrder = ["preflop", "flop", "turn", "river", "showdown", "result", "action"];
  const groups = new Map();

  for (const action of normalized) {
    const key = action.street || "action";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(action);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => {
      const leftIndex = streetOrder.indexOf(left);
      const rightIndex = streetOrder.indexOf(right);
      return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
    })
    .map(([street, actions]) => ({
      street: street.charAt(0).toUpperCase() + street.slice(1),
      actions,
      body: actions.map((action) => action.line).join("\n"),
    }));
}

function handKeyCandidates(hand = {}) {
  return [
    hand.hand_id,
    hand.id,
    hand.hand_no ? `hand_no:${hand.hand_no}` : "",
  ].map((value) => text(value)).filter(Boolean);
}

function actionKeyCandidates(action = {}) {
  return [
    action.hand_id,
    action.hand_no ? `hand_no:${action.hand_no}` : "",
  ].map((value) => text(value)).filter(Boolean);
}

function attachActionsToHands(hands = [], actions = []) {
  const actionsByKey = new Map();
  for (const action of actions || []) {
    for (const key of actionKeyCandidates(action)) {
      if (!actionsByKey.has(key)) actionsByKey.set(key, []);
      actionsByKey.get(key).push(action);
    }
  }

  return (hands || []).map((hand) => {
    const actionRows = handKeyCandidates(hand).flatMap((key) => actionsByKey.get(key) || []);
    const deduped = [...new Map(actionRows.map((action) => [String(action.id || action.log_order || JSON.stringify(action)), action])).values()];
    return {
      ...hand,
      actionRows: deduped.sort((left, right) => Number(left.log_order || left.id || 0) - Number(right.log_order || right.id || 0)),
    };
  });
}

export function normalizeHandActionLog(hand = {}) {
  const actionStreets = groupActionRowsByStreet(hand.actionRows || hand.action_rows || hand.actions_log || []);
  const explicitRawAction = [
    hand.raw_hand_history,
    hand.raw_text,
    hand.hand_text,
    hand.hand_history,
    hand.hand_history_raw,
    hand.action_text,
    hand.action_log,
    hand.raw,
  ].map(valueToLogText).find(Boolean);

  const parsed = actionStreets.length ? "" : valueToLogText(hand.parsed_actions || hand.actions || hand.streets || hand.street_actions);
  const streets = [
    ["Blinds/Antes", streetValue(hand, ["blinds", "antes"])],
    ["Preflop", streetValue(hand, ["preflop", "preflop_actions"])],
    ["Flop", streetValue(hand, ["flop", "flop_actions"])],
    ["Turn", streetValue(hand, ["turn", "turn_actions"])],
    ["River", streetValue(hand, ["river", "river_actions"])],
    ["Showdown", streetValue(hand, ["showdown", "showdown_actions"])],
    ["Result", streetValue(hand, ["summary", "result", "details", "metadata"])],
  ]
    .filter(([, body]) => present(body))
    .map(([street, body]) => ({ street, body }));

  const displayStreets = actionStreets.length ? actionStreets : streets;
  const streetActionCount = displayStreets.filter((street) => !["Showdown", "Result"].includes(street.street)).length;
  const hasChronologicalAction = Boolean(actionStreets.length || explicitRawAction || parsed || streetActionCount);
  const summaryFacts = [
    ["Result", valueToLogText(hand.raw_result || hand.summary || hand.result)],
    ["Board", valueToLogText(hand.board)],
    ["Showdown", present(hand.showdown) ? (hand.showdown ? "Showdown reached" : "No showdown recorded") : ""],
    ["Winning hand", valueToLogText(hand.winning_hand)],
  ]
    .filter(([, body]) => present(body))
    .map(([label, body]) => ({ label, body }));

  return {
    raw: explicitRawAction,
    parsed,
    streets: displayStreets,
    actions: actionStreets.flatMap((street) => street.actions || []),
    summaryFacts,
    resultLine: valueToLogText(hand.raw_result),
    hasAction: hasChronologicalAction,
    hasSummary: Boolean(summaryFacts.length),
    kind: hasChronologicalAction ? "action_log" : "summary",
    unavailableReason: hasChronologicalAction ? "" : "Action log not available for this hand.",
  };
}

export const extractHandActionLog = normalizeHandActionLog;

export function normalizeHandRow(hand = {}) {
  const actionLog = normalizeHandActionLog(hand);
  return {
    ...hand,
    actionLog,
    displayLabel: actionLog.kind === "action_log" ? "Hand History" : "Hand Summary",
    hasChronologicalAction: actionLog.kind === "action_log",
  };
}

export async function getSessionHandHistory(sessionIdOrCode) {
  const session = await getSessionByIdOrCode(sessionIdOrCode);
  if (!session) return [];

  const [hands, actions] = await Promise.all([
    safeQuery(
    supabase.from("hands").select("*").eq("session_id", session.id).order("hand_no", { ascending: true }).limit(300),
    []
    ),
    safeQuery(
      supabase.from("actions").select("*").eq("session_id", session.id).order("log_order", { ascending: true }).limit(5000),
      []
    ),
  ]);

  return attachActionsToHands(hands || [], actions || []).map(normalizeHandRow);
}

export function buildPlayerPokerStats(player, sessionStats = [], sessionResults = [], hands = [], notableHands = [], standings = null) {
  const stats = sessionStats || [];
  const results = sessionResults || [];
  const latestWithVpip = stats.find((row) => present(row.vpip_pct) || present(row.vpip));
  const latestWithPfr = stats.find((row) => present(row.pfr_pct) || present(row.pfr));
  const totalHands = stats.reduce((sum, row) => sum + Number(row.hands || row.hands_played || row.hand_count || 0), 0);
  const biggestPot = Math.max(
    0,
    ...stats.map((row) => Number(row.biggest_pot_won || row.biggest_pot || row.largest_pot || 0)),
    ...notableHands.map((row) => (rowMentionsPlayer(row, player) ? Number(row.pot_collected || 0) : 0))
  );
  const finishes = results.map((row) => Number(row.finish)).filter(Number.isFinite);

  return {
    hands: totalHands || null,
    vpip: latestWithVpip ? latestWithVpip.vpip_pct || latestWithVpip.vpip : null,
    pfr: latestWithPfr ? latestWithPfr.pfr_pct || latestWithPfr.pfr : null,
    vpipSource: latestWithVpip ? "stored" : "unavailable",
    pfrSource: latestWithPfr ? "stored" : "unavailable",
    sessions: standings?.sessions_played || results.length || stats.length || null,
    points: standings?.total_points || standings?.points || standings?.league_points || results.reduce((sum, row) => sum + Number(row.league_points || row.points || 0), 0) || null,
    bestFinish: standings?.best_finish || (finishes.length ? Math.min(...finishes) : null),
    biggestPot: biggestPot || null,
    wins: standings?.wins || null,
    topFinishes: standings?.top_3s || standings?.top_4s || null,
    source: {
      vpip: latestWithVpip ? "stored" : "missing",
      pfr: latestWithPfr ? "stored" : "missing",
    },
  };
}

export async function getPlayerPokerStats(playerIdOrSlug) {
  const playerData = await getPlayerNewsroomData(playerIdOrSlug);
  if (!playerData?.player) return null;
  return buildPlayerPokerStats(
    playerData.player,
    playerData.sessionStats,
    playerData.sessionResults,
    [],
    playerData.moments,
    playerData.standings?.[0] || null
  );
}

export async function buildSessionViewModel(sessionIdOrCode) {
  const data = await getSessionNewsroomData(sessionIdOrCode);
  if (!data) return null;
  const handHistory = (data.hands || []).map(normalizeHandRow);
  const notableHands = (data.notableHands || []).map(normalizeHandRow);
  const biggestPot = [...handHistory, ...notableHands]
    .filter((hand) => hand?.pot_collected)
    .sort((left, right) => Number(right.pot_collected || 0) - Number(left.pot_collected || 0))[0] || null;

  return {
    session: data.session,
    participants: data.participants,
    results: data.sessionResults,
    participantStats: data.playerSessionStats,
    notableHands,
    handHistory,
    standings: data.standings,
    biggestPot,
    keyNumbers: {
      players: data.participants.length || data.playerSessionStats.length || data.sessionResults.length,
      hands: data.session.hands_count || handHistory.length,
      moments: notableHands.length,
      biggestPot: biggestPot?.pot_collected || null,
    },
  };
}

export async function buildPlayerViewModel(playerIdOrSlug) {
  const playerData = await getPlayerNewsroomData(playerIdOrSlug);
  if (!playerData?.player) return null;
  const sessions = await getSessionsIndex();
  const sessionMap = new Map((sessions || []).map((session) => [String(session.id), session]));
  const standings = playerData.standings[0] || null;
  const pokerStats = buildPlayerPokerStats(
    playerData.player,
    playerData.sessionStats,
    playerData.sessionResults,
    [],
    playerData.moments,
    standings
  );
  const recentSessionRows = (playerData.sessionStats.length ? playerData.sessionStats : playerData.sessionResults)
    .map((row) => ({
      ...row,
      session: sessionMap.get(String(row.session_id)) || null,
      result: playerData.sessionResults.find((result) => String(result.session_id) === String(row.session_id)) || null,
    }))
    .slice(0, 8);

  return {
    player: playerData.player,
    displayName: cleanName(playerData.player.display_name || playerData.player.pokernow_name || playerData.player.slug),
    rank: standings?.rank || standings?.current_rank || null,
    points: standings?.total_points || standings?.points || standings?.league_points || pokerStats.points || null,
    sessionsPlayed: pokerStats.sessions,
    recentSessions: recentSessionRows,
    notableHands: playerData.moments.map(normalizeHandRow),
    pokerStats,
    biggestPot: pokerStats.biggestPot,
    bestFinish: pokerStats.bestFinish,
  };
}

export async function getMomentNewsroomData(momentId = "") {
  const key = text(momentId).trim();
  const moment = key
    ? await safeQuery(supabase.from("notable_hands").select("*").eq("id", key).maybeSingle(), null)
    : await safeQuery(
        supabase
          .from("notable_hands")
          .select("*")
          .order("pot_collected", { ascending: false })
          .limit(1)
          .maybeSingle(),
        null
      );

  if (!moment) return null;
  const session = moment.session_id ? await getSessionByIdOrCode(moment.session_id) : null;

  return { moment, session };
}

export async function getSessionNewsroomData(sessionIdOrCode) {
  const session = await getSessionByIdOrCode(sessionIdOrCode);
  if (!session) return null;

  const [sessionResults, playerSessionStats, notableHands, hands, actions, standings, players] = await Promise.all([
    safeQuery(supabase.from("session_results").select("*").eq("session_id", session.id).order("finish", { ascending: true }), []),
    safeQuery(supabase.from("player_session_stats").select("*").eq("session_id", session.id).order("player_name", { ascending: true }), []),
    safeQuery(supabase.from("notable_hands").select("*").eq("session_id", session.id).order("pot_collected", { ascending: false }).limit(25), []),
    safeQuery(supabase.from("hands").select("*").eq("session_id", session.id).order("hand_no", { ascending: true }).limit(200), []),
    safeQuery(supabase.from("actions").select("*").eq("session_id", session.id).order("log_order", { ascending: true }).limit(5000), []),
    getStandingsRows(text(session.season_code, "S0")),
    getPlayersIndex(),
  ]);

  const playersById = new Map((players || []).map((player) => [String(player.id), player]));

  return {
    session,
    sessionResults: sessionResults || [],
    playerSessionStats: playerSessionStats || [],
    notableHands: attachActionsToHands(notableHands || [], actions || []),
    hands: attachActionsToHands(hands || [], actions || []),
    actions: actions || [],
    standings: standings || [],
    participants: (playerSessionStats || []).map((row) => {
      const player = playersById.get(String(row.player_id)) || {};
      const result = (sessionResults || []).find((item) => String(item.player_id) === String(row.player_id)) || null;
      return {
        id: text(row.player_id),
        name: cleanName(player.display_name || row.player_name),
        slug: text(player.slug),
        hands: text(row.hands, "-"),
        biggestPot: text(row.biggest_pot_won, "0"),
        result,
      };
    }),
  };
}

export async function getPublishedDraft({ scope, sourceSessionId, sourcePlayerId }) {
  if (scope === "player" && sourcePlayerId) {
    const row = await safeQuery(
      supabase
        .from("profile_drafts")
        .select("*")
        .eq("player_id", sourcePlayerId)
        .eq("visibility", "published")
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      null
    );
    if (row) return { ...row, _draft_table: "profile_drafts" };
  }

  if (scope === "season") {
    const row = await safeQuery(
      supabase
        .from("standings_drafts")
        .select("*")
        .eq("visibility", "published")
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      null
    );
    if (row) return { ...row, _draft_table: "standings_drafts" };
  }

  if (scope === "moment") {
    const row = await safeQuery(
      supabase
        .from("moment_blurb_drafts")
        .select("*")
        .eq("visibility", "published")
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      null
    );
    if (row) return { ...row, _draft_table: "moment_blurb_drafts" };
  }

  let query = supabase
    .from("recap_drafts")
    .select("*")
    .eq("scope", scope)
    .eq("visibility", "published")
    .order("published_at", { ascending: false })
    .limit(1);

  if (sourceSessionId) query = query.eq("source_session_id", sourceSessionId);
  if (sourcePlayerId) query = query.eq("source_player_id", sourcePlayerId);

  const row = await safeQuery(query.maybeSingle(), null);
  return row ? { ...row, _draft_table: "recap_drafts" } : null;
}

export async function getLatestDraft({ scope, sourceSessionId, sourcePlayerId }) {
  let query = supabase
    .from("recap_drafts")
    .select("*")
    .eq("scope", scope)
    .order("generated_at", { ascending: false })
    .limit(1);

  if (sourceSessionId) query = query.eq("source_session_id", sourceSessionId);
  if (sourcePlayerId) query = query.eq("source_player_id", sourcePlayerId);

  const row = await safeQuery(query.maybeSingle(), null);
  return row ? { ...row, _draft_table: "recap_drafts" } : null;
}

function normalizedArticleDraft(row, source = "article_drafts") {
  if (!row) return null;
  const body = row.body || row.draft || {};
  const request = row.article_request || {};
  return {
    ...row,
    _published_source: source,
    body,
    title: row.title || body.headline || body.title || "Published Para League article",
    slug: row.slug || request.slug || row.id,
    scope: row.scope || "article",
    published_at: row.published_at || row.generated_at || row.created_at || null,
  };
}

export async function getPublishedArticlesIndex() {
  const draftRows = await safeQuery(
    supabase
      .from("article_drafts")
      .select("*")
      .eq("visibility", "published")
      .order("published_at", { ascending: false }),
    []
  );
  if (draftRows?.length) return draftRows.map((row) => normalizedArticleDraft(row, "article_drafts"));

  const bridgeRows = await safeQuery(
    supabase
      .from("published_articles")
      .select("*")
      .is("unpublished_at", null)
      .order("published_at", { ascending: false }),
    []
  );
  if (bridgeRows?.length) return bridgeRows.map((row) => normalizedArticleDraft(row, "published_articles"));

  const recapRows = await safeQuery(
    supabase
      .from("recap_drafts")
      .select("*")
      .eq("scope", "article")
      .eq("visibility", "published")
      .order("published_at", { ascending: false }),
    []
  );
  return (recapRows || []).map((row) => normalizedArticleDraft(row, "recap_drafts"));
}

export async function getPublishedArticle(articleIdOrSlug) {
  const key = text(articleIdOrSlug).trim();
  if (!key) return null;

  const articleDraftById = await safeQuery(
    supabase
      .from("article_drafts")
      .select("*")
      .eq("id", key)
      .eq("visibility", "published")
      .maybeSingle(),
    null
  );
  if (articleDraftById) return normalizedArticleDraft(articleDraftById, "article_drafts");

  const articleDraftBySlug = await safeQuery(
    supabase
      .from("article_drafts")
      .select("*")
      .eq("article_request->>slug", key)
      .eq("visibility", "published")
      .maybeSingle(),
    null
  );
  if (articleDraftBySlug) return normalizedArticleDraft(articleDraftBySlug, "article_drafts");

  const bridgeById = await safeQuery(
    supabase
      .from("published_articles")
      .select("*")
      .eq("id", key)
      .is("unpublished_at", null)
      .maybeSingle(),
    null
  );
  if (bridgeById) return normalizedArticleDraft(bridgeById, "published_articles");

  const bridgeBySlug = await safeQuery(
    supabase
      .from("published_articles")
      .select("*")
      .eq("slug", key)
      .is("unpublished_at", null)
      .maybeSingle(),
    null
  );
  if (bridgeBySlug) return normalizedArticleDraft(bridgeBySlug, "published_articles");

  const recapById = await safeQuery(
    supabase
      .from("recap_drafts")
      .select("*")
      .eq("id", key)
      .eq("scope", "article")
      .eq("visibility", "published")
      .maybeSingle(),
    null
  );
  if (recapById) return normalizedArticleDraft(recapById, "recap_drafts");

  const recapBySlug = await safeQuery(
    supabase
      .from("recap_drafts")
      .select("*")
      .eq("article_request->>slug", key)
      .eq("scope", "article")
      .eq("visibility", "published")
      .maybeSingle(),
    null
  );
  return normalizedArticleDraft(recapBySlug, "recap_drafts");
}
