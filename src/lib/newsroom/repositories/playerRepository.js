import { supabase } from "@/lib/supabase";
import { normalizeHandRow } from "@/lib/poker/handHistory";
import { getSessionsIndex, safeQuery } from "./sessionRepository";

function text(value, fallback = "") {
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
    moments: (moments || []).map(normalizeHandRow),
  };
}

export async function getPlayerSessionMap() {
  const sessions = await getSessionsIndex();
  return new Map((sessions || []).map((session) => [String(session.id), session]));
}
