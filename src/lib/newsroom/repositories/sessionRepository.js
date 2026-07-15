import { supabase } from "@/lib/supabase";
import { attachActionsToHands, normalizeHandRow } from "@/lib/poker/handHistory";
import { stripPlayerHandle } from "@/lib/playerNames";

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function cleanName(value, fallback = "Unknown Player") {
  return stripPlayerHandle(value, fallback);
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

export async function getSessionsIndex(seasonCode = "") {
  let query = supabase
    .from("sessions")
    .select("id, session_code, season_code, session_number, played_at, table_name, format, status, hands_count")
    .order("session_number", { ascending: false });
  if (seasonCode) query = query.eq("season_code", seasonCode);
  return safeQuery(query, []);
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

export async function getSessionActionRows(sessionId) {
  return safeQuery(
    supabase.from("actions").select("*").eq("session_id", sessionId).order("log_order", { ascending: true }).limit(5000),
    []
  );
}

export async function getSessionHandHistory(sessionIdOrCode) {
  const session = await getSessionByIdOrCode(sessionIdOrCode);
  if (!session) return [];

  const [hands, actions] = await Promise.all([
    safeQuery(
      supabase.from("hands").select("*").eq("session_id", session.id).order("hand_no", { ascending: true }).limit(300),
      []
    ),
    getSessionActionRows(session.id),
  ]);

  return attachActionsToHands(hands || [], actions || []).map(normalizeHandRow);
}

export async function getSessionNewsroomData(sessionIdOrCode) {
  const session = await getSessionByIdOrCode(sessionIdOrCode);
  if (!session) return null;

  const [sessionResults, playerSessionStats, notableHands, hands, actions, standings, players] = await Promise.all([
    safeQuery(supabase.from("session_results").select("*").eq("session_id", session.id).order("finish", { ascending: true }), []),
    safeQuery(supabase.from("player_session_stats").select("*").eq("session_id", session.id).order("player_name", { ascending: true }), []),
    safeQuery(supabase.from("notable_hands").select("*").eq("session_id", session.id).order("pot_collected", { ascending: false }).limit(25), []),
    safeQuery(supabase.from("hands").select("*").eq("session_id", session.id).order("hand_no", { ascending: true }).limit(200), []),
    getSessionActionRows(session.id),
    getStandingsRows(text(session.season_code, "S0")),
    safeQuery(supabase.from("players").select("*").order("display_name", { ascending: true }), []),
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
