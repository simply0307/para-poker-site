import { supabase } from "@/lib/supabase";
import {
  attachActionsToHands as attachPokerActionsToHands,
  extractHandActionLog as extractPokerHandActionLog,
  normalizeHandActionLog as normalizePokerHandActionLog,
  normalizeHandRow as normalizePokerHandRow,
} from "@/lib/poker/handHistory";
import { buildPlayerViewModel as buildCanonicalPlayerViewModel } from "@/lib/newsroom/viewModels/player";
import { buildSessionViewModel as buildCanonicalSessionViewModel } from "@/lib/newsroom/viewModels/session";
import {
  getPublishedArticle as getPublishedArticleFromRepository,
  getPublishedArticlesIndex as getPublishedArticlesIndexFromRepository,
  getPublishedDraft as getPublishedDraftFromRepository,
} from "@/lib/newsroom/repositories/draftRepository";
import { normalizePlayerNameForMatch, stripPlayerHandle } from "@/lib/playerNames";

export { supabase };

export function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

export function cleanName(value, fallback = "Unknown Player") {
  return stripPlayerHandle(value, fallback);
}

export function normalizePlayerName(name) {
  return normalizePlayerNameForMatch(name);
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

export async function safeQueryAll(query, fallback = [], { pageSize = 1000 } = {}) {
  try {
    const rows = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await query.range(from, from + pageSize - 1);
      if (error) return fallback;
      rows.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
    return rows;
  } catch {
    return fallback;
  }
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

export async function getSessionsIndex(seasonCode = "") {
  let query = supabase
    .from("sessions")
    .select("id, session_code, season_code, session_number, played_at, table_name, format, status, hands_count")
    .order("session_number", { ascending: false });
  if (seasonCode) query = query.eq("season_code", seasonCode);
  return safeQuery(query, []);
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
  ].map(normalizePlayerName).filter(Boolean);

  const directMatch = players.find((player) => {
    const candidates = playerNameCandidates(player);
    return rowNames.some((rowName) => candidates.includes(rowName));
  });
  if (directMatch) return directMatch;

  const involvedNames = [
    ...(Array.isArray(row.involved_players) ? row.involved_players : []),
    ...(Array.isArray(row.player_names) ? row.player_names : []),
  ].map(normalizePlayerName).filter(Boolean);

  return players.find((player) => {
    const candidates = playerNameCandidates(player);
    return involvedNames.some((rowName) => candidates.includes(rowName));
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

function rowWinnerMatchesPlayer(row = {}, player = {}) {
  if (!player) return false;
  if (row.winner_player_id && String(row.winner_player_id) === String(player.id)) return true;
  const candidates = playerNameCandidates(player);
  const winnerNames = [
    row.winner_name,
    row.player_name,
  ].map(normalizePlayerName).filter(Boolean);
  return winnerNames.some((name) => candidates.includes(name));
}

function rowInvolvesPlayer(row = {}, player = {}) {
  if (rowWinnerMatchesPlayer(row, player)) return true;
  const candidates = playerNameCandidates(player);
  const involvedNames = [
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

  return involvedNames.some((name) => candidates.includes(name)) || rawText.some((value) => candidates.some((candidate) => value.includes(candidate)));
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
  const rows = await safeQueryAll(supabase.from("notable_hands").select("*"), []);
  return [...(rows || [])].sort((left, right) => {
    const leftDate = Date.parse(left.created_at || left.updated_at || "");
    const rightDate = Date.parse(right.created_at || right.updated_at || "");
    if (Number.isFinite(leftDate) && Number.isFinite(rightDate) && leftDate !== rightDate) return rightDate - leftDate;
    return Number(right.pot_bb || right.pot_collected || 0) - Number(left.pot_bb || left.pot_collected || 0) ||
      Number(right.hand_no || 0) - Number(left.hand_no || 0);
  });
}

export async function getPlayerNewsroomData(playerIdOrSlug, seasonCode = "S0") {
  const player = await getPlayerByIdOrSlug(playerIdOrSlug);
  if (!player) return null;
  const playerName = cleanName(player.display_name || player.pokernow_name);
  const normalized = normalizePlayerName(playerName);

  const [standingsRows, sessionStatsRows, sessionResultsRows, momentsRows, players] = await Promise.all([
    safeQuery(
      supabase
        .from("standings")
        .select("*")
        .eq("season_code", seasonCode || "S0")
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
  const wonMoments = (momentsRows || []).filter((row) => rowWinnerMatchesPlayer(row, player));
  const contestedMoments = (momentsRows || []).filter((row) => rowInvolvesPlayer(row, player) && !rowWinnerMatchesPlayer(row, player));

  return {
    player,
    players: players || [],
    standings: standings || [],
    sessionStats: sessionStats || [],
    sessionResults: sessionResults || [],
    moments: (wonMoments || []).map((row) => ({ ...row, player_moment_role: "winner" })),
    contestedMoments: (contestedMoments || []).map((row) => ({ ...row, player_moment_role: "contested" })),
    involvedMoments: [...wonMoments, ...contestedMoments],
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
  return attachPokerActionsToHands(hands, actions);
}

export function normalizeHandActionLog(hand = {}) {
  return normalizePokerHandActionLog(hand);
}

export const extractHandActionLog = extractPokerHandActionLog;

export function normalizeHandRow(hand = {}) {
  return normalizePokerHandRow(hand);
}

export async function getSessionHandHistory(sessionIdOrCode) {
  const session = await getSessionByIdOrCode(sessionIdOrCode);
  if (!session) return [];

  const [hands, actions] = await Promise.all([
    safeQueryAll(supabase.from("hands").select("*").eq("session_id", session.id).order("hand_no", { ascending: true }), []),
    safeQueryAll(supabase.from("actions").select("*").eq("session_id", session.id).order("log_order", { ascending: true }), []),
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
  return buildCanonicalSessionViewModel(sessionIdOrCode);
}

export async function buildPlayerViewModel(playerIdOrSlug) {
  return buildCanonicalPlayerViewModel(playerIdOrSlug);
}

export async function getMomentNewsroomData(momentId = "") {
  const key = text(momentId).trim();
  const moment = key
    ? (await safeQuery(supabase.from("notable_hands").select("*").eq("id", key).maybeSingle(), null)) ||
      (await safeQuery(supabase.from("notable_hands").select("*").eq("hand_id", key).maybeSingle(), null))
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
    safeQueryAll(supabase.from("hands").select("*").eq("session_id", session.id).order("hand_no", { ascending: true }), []),
    safeQueryAll(supabase.from("actions").select("*").eq("session_id", session.id).order("log_order", { ascending: true }), []),
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
  return getPublishedDraftFromRepository({ scope, sourceSessionId, sourcePlayerId });
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

export async function getPublishedArticlesIndex() {
  return getPublishedArticlesIndexFromRepository();
}

export async function getPublishedArticle(articleIdOrSlug) {
  return getPublishedArticleFromRepository(articleIdOrSlug);
}
