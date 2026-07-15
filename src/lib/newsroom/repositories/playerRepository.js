import { supabase } from "@/lib/supabase";
import { attachActionsToHands, normalizeHandRow } from "@/lib/poker/handHistory";
import { normalizePlayerNameForMatch, stripPlayerHandle } from "@/lib/playerNames";
import { getSessionsIndex, safeQuery } from "./sessionRepository";

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

export function cleanName(value, fallback = "Unknown Player") {
  return stripPlayerHandle(value, fallback);
}

export function normalizePlayerName(name) {
  return normalizePlayerNameForMatch(name);
}

function playerNameCandidates(player = {}) {
  return [
    player.id,
    player.display_name,
    player.pokernow_name,
    player.slug,
  ].map(normalizePlayerName).filter(Boolean);
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

export async function getPlayerByIdOrSlug(playerIdOrSlug) {
  const key = text(playerIdOrSlug).trim();
  if (!key) return null;

  return (
    (await safeQuery(supabase.from("players").select("*").eq("id", key).maybeSingle())) ||
    (await safeQuery(supabase.from("players").select("*").ilike("slug", key).maybeSingle()))
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

export async function getPlayerNewsroomData(playerIdOrSlug, seasonCode = "S0") {
  const player = await getPlayerByIdOrSlug(playerIdOrSlug);
  if (!player) return null;
  const playerName = cleanName(player.display_name || player.pokernow_name);
  const normalized = normalizePlayerName(playerName);

  const [standingsRows, seasonStatsRows, careerStatsRows, sessionStatsRows, sessionResultsRows, momentsRows, players] = await Promise.all([
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
        .from("player_season_stats")
        .select("*")
        .eq("season_code", seasonCode || "S0")
        .order("total_points", { ascending: false })
        .limit(500),
      []
    ),
    safeQuery(
      supabase
        .from("player_career_stats")
        .select("*")
        .order("total_points", { ascending: false })
        .limit(500),
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

  const momentSessionIds = [...new Set((momentsRows || []).map((row) => row.session_id).filter(Boolean).map(String))];
  const actionRows = momentSessionIds.length
    ? await safeQuery(
        supabase
          .from("actions")
          .select("*")
          .in("session_id", momentSessionIds)
          .order("log_order", { ascending: true })
          .limit(5000),
        []
      )
    : [];

  const momentsWithActions = attachActionsToHands(momentsRows || [], actionRows || []);
  const standings = (standingsRows || []).filter((row) => rowMentionsPlayer(row, player) || normalizePlayerName(row.player_name) === normalized);
  const seasonStats = (seasonStatsRows || []).filter((row) => rowMentionsPlayer(row, player) || normalizePlayerName(row.player_name) === normalized);
  const careerStats = (careerStatsRows || []).filter((row) => rowMentionsPlayer(row, player) || normalizePlayerName(row.player_name) === normalized);
  const sessionStats = (sessionStatsRows || []).filter((row) => rowMentionsPlayer(row, player) || normalizePlayerName(row.player_name) === normalized);
  const sessionResults = (sessionResultsRows || []).filter((row) => rowMentionsPlayer(row, player) || normalizePlayerName(row.player_name) === normalized);
  const wonMoments = (momentsWithActions || []).filter((row) => rowWinnerMatchesPlayer(row, player));
  const contestedMoments = (momentsWithActions || []).filter((row) => rowInvolvesPlayer(row, player) && !rowWinnerMatchesPlayer(row, player));

  return {
    player,
    players: players || [],
    standings: standings || [],
    seasonStats: seasonStats || [],
    careerStats: careerStats || [],
    sessionStats: sessionStats || [],
    sessionResults: sessionResults || [],
    moments: (wonMoments || []).map((row) => ({ ...normalizeHandRow(row), player_moment_role: "winner" })),
    contestedMoments: (contestedMoments || []).map((row) => ({ ...normalizeHandRow(row), player_moment_role: "contested" })),
    involvedMoments: [...wonMoments, ...contestedMoments].map(normalizeHandRow),
  };
}

export async function getPlayerSessionMap() {
  const sessions = await getSessionsIndex();
  return new Map((sessions || []).map((session) => [String(session.id), session]));
}
