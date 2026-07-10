import { supabase } from "@/lib/supabase";

export function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

export function cleanName(value, fallback = "Unknown Player") {
  return text(value, fallback).replace(/\s+@\s+\S+\s*$/u, "").trim();
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

  const [standings, sessionStats, sessionResults, moments] = await Promise.all([
    safeQuery(
      supabase
        .from("standings")
        .select("*")
        .or(`player_id.eq.${player.id},player_name.ilike.${playerName}`)
        .limit(5),
      []
    ),
    safeQuery(
      supabase
        .from("player_session_stats")
        .select("*")
        .eq("player_id", player.id)
        .order("created_at", { ascending: false })
        .limit(8),
      []
    ),
    safeQuery(
      supabase
        .from("session_results")
        .select("*")
        .eq("player_id", player.id)
        .order("created_at", { ascending: false })
        .limit(8),
      []
    ),
    safeQuery(
      supabase
        .from("notable_hands")
        .select("*")
        .or(`winner_player_id.eq.${player.id},player_id.eq.${player.id},winner_name.ilike.${playerName}`)
        .order("pot_collected", { ascending: false })
        .limit(8),
      []
    ),
  ]);

  return {
    player,
    standings: standings || [],
    sessionStats: sessionStats || [],
    sessionResults: sessionResults || [],
    moments: moments || [],
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

  const [sessionResults, playerSessionStats, notableHands, hands, standings, players] = await Promise.all([
    safeQuery(supabase.from("session_results").select("*").eq("session_id", session.id).order("finish", { ascending: true }), []),
    safeQuery(supabase.from("player_session_stats").select("*").eq("session_id", session.id).order("player_name", { ascending: true }), []),
    safeQuery(supabase.from("notable_hands").select("*").eq("session_id", session.id).order("pot_collected", { ascending: false }).limit(25), []),
    safeQuery(supabase.from("hands").select("*").eq("session_id", session.id).order("pot_collected", { ascending: false }).limit(25), []),
    getStandingsRows(text(session.season_code, "S0")),
    getPlayersIndex(),
  ]);

  const playersById = new Map((players || []).map((player) => [String(player.id), player]));

  return {
    session,
    sessionResults: sessionResults || [],
    playerSessionStats: playerSessionStats || [],
    notableHands: notableHands || [],
    hands: hands || [],
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

export async function getPublishedArticlesIndex() {
  return safeQuery(
    supabase
      .from("published_articles")
      .select("*")
      .is("unpublished_at", null)
      .order("published_at", { ascending: false }),
    []
  );
}

export async function getPublishedArticle(articleIdOrSlug) {
  const key = text(articleIdOrSlug).trim();
  if (!key) return null;

  return (
    (await safeQuery(
      supabase
        .from("published_articles")
        .select("*")
        .eq("id", key)
        .is("unpublished_at", null)
        .maybeSingle()
    )) ||
    (await safeQuery(
      supabase
        .from("published_articles")
        .select("*")
        .eq("slug", key)
        .is("unpublished_at", null)
        .maybeSingle()
    ))
  );
}
