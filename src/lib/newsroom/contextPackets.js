import { supabase } from "@/lib/supabase";
import {
  buildPlayerRecapInput,
  buildSessionRecapInput,
  formatRecapSourceFacts,
  getSessionRecapData,
} from "@/lib/recapData";
import { getPlayerProfileData } from "@/lib/playerProfileData";
import { NEWSROOM_PROMPT_VERSION, paraLeagueVoiceRules } from "./voiceRules";
import { loadNewsroomEditorialDocs } from "./editorialDocs";
import { buildSessionStoryPlan, sessionRecapAssignment } from "./sessionRecapAssignment";

const SOURCE_DATA_VERSION = "v1";

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function cleanName(value, fallback = "Unknown Player") {
  return text(value, fallback).replace(/\s+@\s+\S+\s*$/u, "").trim();
}

function formatNumber(value, fallback = "") {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString("en-US") : text(value, fallback);
}

function publicHandMoment(moment) {
  return {
    hand_no: text(moment.hand_no || moment.handNo),
    title: text(moment.title || moment.displayTitle),
    winner_name: cleanName(moment.winner_name || moment.winner),
    pot_collected: moment.pot_collected ? Number(moment.pot_collected) : null,
    pot_text: moment.pot_collected ? `${formatNumber(moment.pot_collected)} chips` : text(moment.potText),
    board: text(moment.board),
    winning_hand: text(moment.winning_hand || moment.winningHand),
    tags: Array.isArray(moment.tags) ? moment.tags.map(String) : [],
  };
}

export async function buildSessionRecapInputPacket(sessionIdOrCode) {
  const sessionData = await getSessionRecapData(sessionIdOrCode);
  if (!sessionData) {
    throw new Error("Session not found.");
  }
  const editorialDocs = await loadNewsroomEditorialDocs();

  const recapInput = buildSessionRecapInput({
    session: sessionData.session,
    sessionResults: sessionData.results,
    playerSessionStats: sessionData.stats,
    notableHands: sessionData.notableHands,
    hands: sessionData.biggestPots,
  });
  const storyPlan = buildSessionStoryPlan({
    session: sessionData.session,
    sessionResults: sessionData.results,
    playerSessionStats: sessionData.stats,
    notableHands: sessionData.notableHands,
    hands: sessionData.biggestPots,
  });

  const standingsResult = sessionData.session?.season_code
    ? await supabase
        .from("standings")
        .select("player_id, player_name, rank, points, wins, top_finishes, season_code")
        .eq("season_code", sessionData.session.season_code)
        .order("rank", { ascending: true })
        .limit(20)
    : { data: [], error: null };

  const packet = {
    packet_type: "session_recap",
    prompt_version: NEWSROOM_PROMPT_VERSION,
    source_data_version: SOURCE_DATA_VERSION,
    prompt_hierarchy: [
      "A. session_recap_assignment",
      "B. hard_factual_guardrails",
      "C. story_plan",
      "D. session/player data",
      "E. editorial docs/examples",
      "F. output schema",
    ],
    session_recap_assignment: sessionRecapAssignment,
    hard_factual_guardrails: recapInput.guardrails,
    story_plan: storyPlan,
    voice_rules: paraLeagueVoiceRules,
    editorial_docs: editorialDocs,
    session: {
      id: sessionData.session.id,
      session_code: sessionData.session.session_code,
      season_code: sessionData.session.season_code,
      played_at: sessionData.session.played_at,
      table_name: sessionData.session.table_name,
      format: sessionData.session.format,
      hands_count: sessionData.session.hands_count,
      status: sessionData.session.status,
    },
    participants: sessionData.participants.map((player) => ({
      player_id: player.id,
      name: player.name,
      slug: player.slug,
      hands: player.hands,
      biggest_pot: player.biggestPot,
      finish: player.result?.finish || null,
      league_points: player.result?.league_points || null,
      approved_result: Boolean(player.result?.approved),
    })),
    standings_snapshot: standingsResult.error ? [] : standingsResult.data || [],
    moment_source_facts: (sessionData.recaps?.moments || []).slice(0, 8).map((moment) => ({
      note: "Use these as source facts only, not as style examples.",
      title: moment.title,
      role: moment.tags?.[0] || "",
      hand_no: moment.handNo,
      winner_name: moment.relatedPlayerName || moment.handHistory?.winnerName || "",
      pot_text: moment.handHistory?.potText || "",
      result_summary_fact: moment.summary,
      consequence_fact: moment.sessionImpact,
    })),
    biggest_pots: (sessionData.biggestPots || []).slice(0, 8).map(publicHandMoment),
    source_facts_summary: formatRecapSourceFacts(recapInput.sourceFacts),
    constraints: [
      ...recapInput.guardrails,
      "The recap_body must be public article prose, not an audit, source summary, product explanation, or database summary.",
      "Use missing_data_warnings and confidence_notes only for admin notes.",
    ],
    warnings: [
      standingsResult.error ? `Standings snapshot unavailable: ${standingsResult.error.message}` : "",
      "Standings changes before/after this session are not present unless supplied in standings_snapshot.",
    ].filter(Boolean),
  };

  return {
    scope: "session",
    sourceSessionId: sessionData.session.id,
    sourceDataVersion: SOURCE_DATA_VERSION,
    promptVersion: NEWSROOM_PROMPT_VERSION,
    packet,
  };
}

export async function buildPlayerRecapInputPacket(playerSlugOrId) {
  const profileData = await getPlayerProfileData(playerSlugOrId);
  if (!profileData) {
    throw new Error("Player not found.");
  }
  const editorialDocs = await loadNewsroomEditorialDocs();

  const recapInput = buildPlayerRecapInput(profileData);

  return {
    scope: "player",
    sourcePlayerId: profileData.playerId || null,
    sourceDataVersion: SOURCE_DATA_VERSION,
    promptVersion: NEWSROOM_PROMPT_VERSION,
    packet: {
      packet_type: "player_profile",
      prompt_version: NEWSROOM_PROMPT_VERSION,
      source_data_version: SOURCE_DATA_VERSION,
      voice_rules: paraLeagueVoiceRules,
      editorial_docs: editorialDocs,
      player: {
        id: profileData.playerId || null,
        slug: profileData.slug,
        name: profileData.playerName,
        season_status: profileData.seasonStatus,
        public_hud: profileData.publicHud,
      },
      recent_sessions: profileData.recentSessions || [],
      selected_moments: (profileData.moments || []).slice(0, 6),
      source_facts_summary: formatRecapSourceFacts(recapInput.sourceFacts),
      constraints: recapInput.guardrails,
    },
  };
}

export async function buildArticleInputPacket(articleRequest = {}) {
  const editorialDocs = await loadNewsroomEditorialDocs();

  return {
    scope: "article",
    sourceDataVersion: SOURCE_DATA_VERSION,
    promptVersion: NEWSROOM_PROMPT_VERSION,
    packet: {
      packet_type: "league_article",
      prompt_version: NEWSROOM_PROMPT_VERSION,
      source_data_version: SOURCE_DATA_VERSION,
      voice_rules: paraLeagueVoiceRules,
      editorial_docs: editorialDocs,
      article_request: articleRequest,
      constraints: [
        "Request additional structured data if the article cannot be grounded.",
        "Do not invent standings, sessions, moments, rivalries, or player intent.",
      ],
    },
  };
}
