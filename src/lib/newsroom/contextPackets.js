import { NEWSROOM_PROMPT_VERSION, paraLeagueVoiceRules } from "./voiceRules";
import { getContentAssignment, getSelectedVariation, getVariationOptions } from "./contentAssignments";
import { loadNewsroomEditorialDocs, loadSessionRecapMagicGuide, loadTaskGuide } from "./editorialDocs";
import {
  buildSessionStoryPlan,
  getSelectedSessionRecapVariation,
  getSessionRecapVariationOptions,
  sessionRecapAssignment,
} from "./sessionRecapAssignment";
import {
  cleanName,
  formatNumber,
  getMomentNewsroomData,
  getPlayerByIdOrSlug,
  getPlayerNewsroomData,
  getSessionNewsroomData,
  getStandingsRows,
  text,
} from "./data";

const SOURCE_DATA_VERSION = "v2-newsroom";

const TASK_GUIDES = {
  player_profile: {
    filename: "10-player-profile-guide.md",
    id: "player-profile-guide",
    title: "Player Profile Guide",
  },
  player_session_recap: {
    filename: "11-player-session-recap-guide.md",
    id: "player-session-recap-guide",
    title: "Player Session Recap Guide",
  },
  standings_summary: {
    filename: "12-standings-summary-guide.md",
    id: "standings-summary-guide",
    title: "Standings Summary Guide",
  },
  moment_blurb: {
    filename: "13-moment-blurb-guide.md",
    id: "moment-blurb-guide",
    title: "Moment Blurb Guide",
  },
  league_article: {
    filename: "14-league-article-guide.md",
    id: "league-article-guide",
    title: "League Article Guide",
  },
};

async function buildTaskContext(type, requestedVariation = "") {
  const guide = TASK_GUIDES[type];
  const taskGuide = guide ? await loadTaskGuide(guide.filename, guide.id, guide.title) : null;

  return {
    task_assignment: getContentAssignment(type),
    task_guide: taskGuide,
    variation_options: getVariationOptions(type).map(({ key, label, instruction }) => ({
      key,
      label,
      instruction,
    })),
    selected_variation: getSelectedVariation(type, requestedVariation),
  };
}

function publicHandMoment(moment) {
  return {
    hand_no: text(moment.hand_no),
    winner_name: cleanName(moment.winner_name, ""),
    pot_collected: moment.pot_collected ? Number(moment.pot_collected) : null,
    pot_text: moment.pot_collected ? `${formatNumber(moment.pot_collected)} chips` : "",
    board: text(moment.board),
    winning_hand: text(moment.winning_hand),
    tags: Array.isArray(moment.tags) ? moment.tags.map(String) : [],
  };
}

export async function buildSessionRecapInputPacket(sessionIdOrCode, options = {}) {
  const sessionData = await getSessionNewsroomData(sessionIdOrCode);
  if (!sessionData) throw new Error("Session not found.");

  const editorialDocs = await loadNewsroomEditorialDocs();
  const sessionMagicGuide = await loadSessionRecapMagicGuide();
  const storyPlan = buildSessionStoryPlan({
    session: sessionData.session,
    sessionResults: sessionData.sessionResults,
    playerSessionStats: sessionData.playerSessionStats,
    notableHands: sessionData.notableHands,
    hands: sessionData.hands,
  });
  const hardGuardrails = [
    "Use only the supplied session/player/hand/standing data for factual claims.",
    "Do not invent cards, stacks, winners, finishes, standings movement, rivalries, player intent, emotions, or table talk.",
    "The recap_body must be public article prose, not an audit, source summary, product explanation, or database summary.",
    "Use missing_data_warnings and confidence_notes only for admin notes.",
  ];

  return {
    scope: "session",
    sourceSessionId: sessionData.session.id,
    sourceDataVersion: SOURCE_DATA_VERSION,
    promptVersion: NEWSROOM_PROMPT_VERSION,
    packet: {
      packet_type: "session_recap",
      prompt_version: NEWSROOM_PROMPT_VERSION,
      source_data_version: SOURCE_DATA_VERSION,
      prompt_hierarchy: [
        "A. session_recap_assignment",
        "B. hard_factual_guardrails",
        "C. selected_variation",
        "D. session_recap_magic_guide",
        "E. story_plan",
        "F. session/player data",
        "G. broad editorial docs/examples",
        "H. output schema",
      ],
      session_recap_assignment: sessionRecapAssignment,
      hard_factual_guardrails: hardGuardrails,
      variation_options: getSessionRecapVariationOptions().map(({ key, label, instruction }) => ({
        key,
        label,
        instruction,
      })),
      selected_variation: getSelectedSessionRecapVariation(options.variation || options.variationKey),
      session_recap_magic_guide: sessionMagicGuide,
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
      standings_snapshot: sessionData.standings,
      moment_source_facts: (sessionData.notableHands || []).slice(0, 8).map((moment) => ({
        note: "Use these as source facts only, not as style examples.",
        ...publicHandMoment(moment),
      })),
      biggest_pots: (sessionData.hands?.length ? sessionData.hands : sessionData.notableHands || []).slice(0, 8).map(publicHandMoment),
      source_facts_summary: [
        `Session: ${sessionData.session.session_code || sessionData.session.id}`,
        `Hands: ${sessionData.session.hands_count || "-"}`,
        `Approved results: ${sessionData.sessionResults.filter((result) => result.approved).length}`,
        `Notable hands: ${sessionData.notableHands.length}`,
      ].join("; "),
      constraints: hardGuardrails,
      warnings: ["Standings changes before/after this session are not present unless supplied in standings_snapshot."],
    },
  };
}

export async function buildPlayerRecapInputPacket(playerIdOrSlug, options = {}) {
  const playerData = await getPlayerNewsroomData(playerIdOrSlug);
  if (!playerData) throw new Error("Player not found.");
  const { player } = playerData;
  const editorialDocs = await loadNewsroomEditorialDocs();
  const taskContext = await buildTaskContext("player_profile", options.variation || options.variationKey);

  return {
    scope: "player",
    sourcePlayerId: player.id || null,
    sourceDataVersion: SOURCE_DATA_VERSION,
    promptVersion: NEWSROOM_PROMPT_VERSION,
    packet: {
      packet_type: "player_profile",
      prompt_version: NEWSROOM_PROMPT_VERSION,
      source_data_version: SOURCE_DATA_VERSION,
      prompt_hierarchy: [
        "A. task_assignment",
        "B. hard_factual_guardrails",
        "C. selected_variation",
        "D. task_guide",
        "E. player/session/moment data",
        "F. broad editorial docs/examples",
        "G. output schema",
      ],
      ...taskContext,
      voice_rules: paraLeagueVoiceRules,
      editorial_docs: editorialDocs,
      editorial_notes: options.editorialNotes || "",
      player: {
        id: player.id,
        slug: player.slug,
        name: cleanName(player.display_name || player.pokernow_name),
      },
      standings: playerData.standings,
      recent_session_stats: playerData.sessionStats,
      recent_results: playerData.sessionResults,
      moment_source_facts: playerData.moments.map((moment) => ({
        note: "Use these as source facts only, not style examples.",
        hand_no: text(moment.hand_no),
        winner_name: cleanName(moment.winner_name, ""),
        pot_text: moment.pot_collected ? `${formatNumber(moment.pot_collected)} chips` : "",
        board: text(moment.board),
        winning_hand: text(moment.winning_hand),
      })),
      constraints: [
        "Write a player-facing public profile draft from supplied data only.",
        "Do not invent style, motive, rivalry, or private scouting claims.",
      ],
    },
  };
}

export async function buildMomentBlurbInputPacket(momentId = "", editorialNotes = "", options = {}) {
  const editorialDocs = await loadNewsroomEditorialDocs();
  const momentData = await getMomentNewsroomData(momentId);
  if (!momentData) throw new Error("Moment not found.");
  const taskContext = await buildTaskContext("moment_blurb", options.variation || options.variationKey);

  return {
    scope: "moment",
    momentId: momentData.moment.id || null,
    sourceDataVersion: SOURCE_DATA_VERSION,
    promptVersion: NEWSROOM_PROMPT_VERSION,
    packet: {
      packet_type: "moment_blurb",
      prompt_version: NEWSROOM_PROMPT_VERSION,
      source_data_version: SOURCE_DATA_VERSION,
      prompt_hierarchy: [
        "A. task_assignment",
        "B. hard_factual_guardrails",
        "C. selected_variation",
        "D. task_guide",
        "E. moment/session data",
        "F. broad editorial docs/examples",
        "G. output schema",
      ],
      ...taskContext,
      voice_rules: paraLeagueVoiceRules,
      editorial_docs: editorialDocs,
      editorial_notes: editorialNotes,
      moment_source_facts: {
        note: "Use this as grounded hand/moment data only. Do not invent action or emotion.",
        ...publicHandMoment(momentData.moment),
        session_code: momentData.session?.session_code || "",
      },
      constraints: [
        "Write a short public moment blurb from supplied data only.",
        "Explain why the moment matters without inventing motive, emotion, rivalry, or unsupported action.",
      ],
    },
  };
}

export async function buildStandingsInputPacket(seasonCode = "S0", editorialNotes = "", options = {}) {
  const editorialDocs = await loadNewsroomEditorialDocs();
  const standings = await getStandingsRows(seasonCode);
  const taskContext = await buildTaskContext("standings_summary", options.variation || options.variationKey);

  return {
    scope: "season",
    seasonCode,
    sourceDataVersion: SOURCE_DATA_VERSION,
    promptVersion: NEWSROOM_PROMPT_VERSION,
    packet: {
      packet_type: "standings_summary",
      prompt_version: NEWSROOM_PROMPT_VERSION,
      source_data_version: SOURCE_DATA_VERSION,
      prompt_hierarchy: [
        "A. task_assignment",
        "B. hard_factual_guardrails",
        "C. selected_variation",
        "D. task_guide",
        "E. standings data",
        "F. broad editorial docs/examples",
        "G. output schema",
      ],
      ...taskContext,
      voice_rules: paraLeagueVoiceRules,
      editorial_docs: editorialDocs,
      editorial_notes: editorialNotes,
      standings_snapshot: standings,
      constraints: [
        "Write a public standings summary from supplied standings only.",
        "Do not invent standings movement unless before/after standings are supplied.",
      ],
    },
  };
}

export async function buildPlayerSessionRecapInputPacket({ playerId, sessionId, editorialNotes = "", variation = "", variationKey = "" }) {
  const editorialDocs = await loadNewsroomEditorialDocs();
  const playerData = await getPlayerNewsroomData(playerId);
  const sessionData = await getSessionNewsroomData(sessionId);
  const taskContext = await buildTaskContext("player_session_recap", variation || variationKey);

  if (!playerData) throw new Error("Player not found.");
  if (!sessionData) throw new Error("Session not found.");

  const playerName = cleanName(playerData.player.display_name || playerData.player.pokernow_name);
  const playerSessionStats = sessionData.playerSessionStats.find((row) => String(row.player_id) === String(playerData.player.id)) || null;
  const result = sessionData.sessionResults.find((row) => String(row.player_id) === String(playerData.player.id)) || null;

  return {
    scope: "player_session",
    sourcePlayerId: playerData.player.id,
    sourceSessionId: sessionData.session.id,
    sourceDataVersion: SOURCE_DATA_VERSION,
    promptVersion: NEWSROOM_PROMPT_VERSION,
    packet: {
      packet_type: "player_session_recap",
      prompt_version: NEWSROOM_PROMPT_VERSION,
      source_data_version: SOURCE_DATA_VERSION,
      prompt_hierarchy: [
        "A. task_assignment",
        "B. hard_factual_guardrails",
        "C. selected_variation",
        "D. task_guide",
        "E. player/session/moment data",
        "F. broad editorial docs/examples",
        "G. output schema",
      ],
      ...taskContext,
      voice_rules: paraLeagueVoiceRules,
      editorial_docs: editorialDocs,
      editorial_notes: editorialNotes,
      player: {
        id: playerData.player.id,
        slug: playerData.player.slug,
        name: playerName,
      },
      session: {
        id: sessionData.session.id,
        session_code: sessionData.session.session_code,
        hands_count: sessionData.session.hands_count,
        played_at: sessionData.session.played_at,
      },
      player_session_stats: playerSessionStats,
      session_result: result,
      moment_source_facts: sessionData.notableHands
        .filter((moment) => cleanName(moment.winner_name, "").toLowerCase() === playerName.toLowerCase())
        .slice(0, 8)
        .map(publicHandMoment),
      constraints: [
        "Write a player-facing recap of this player's session from supplied data only.",
        "Do not invent private scouting, emotion, motive, rivalry, or unsupported hand action.",
      ],
    },
  };
}

export async function buildArticleInputPacket(articleRequest = {}) {
  const editorialDocs = await loadNewsroomEditorialDocs();
  const standings = await getStandingsRows(articleRequest.seasonCode || "S0");
  const taskContext = await buildTaskContext("league_article", articleRequest.variation || articleRequest.variationKey);
  const finalityRules = [
    "Do not say the season is over unless articleRequest.seasonStatus is complete.",
    "Do not say a player has clinched, secured, finished the season, closed the campaign, or ended the race unless supplied data explicitly says so.",
    "Use provisional language: currently, so far, through the available sessions, early board, opening marker, current standings line.",
    "Do not write final-season conclusions from a standings snapshot.",
  ];
  const seasonContext = {
    season_code: articleRequest.seasonCode || "S0",
    season_phase: articleRequest.seasonPhase || "preseason",
    season_status: articleRequest.seasonStatus || "in_progress",
    lifecycle_note:
      articleRequest.lifecycleNote ||
      "This season is ongoing. Treat standings and results as current markers, not final outcomes.",
    finality_rules: finalityRules,
  };

  return {
    scope: "article",
    sourceDataVersion: SOURCE_DATA_VERSION,
    promptVersion: NEWSROOM_PROMPT_VERSION,
    packet: {
      packet_type: "league_article",
      prompt_version: NEWSROOM_PROMPT_VERSION,
      source_data_version: SOURCE_DATA_VERSION,
      prompt_hierarchy: [
        "A. task_assignment",
        "B. hard_factual_guardrails",
        "C. selected_variation",
        "D. task_guide",
        "E. article request/standings data",
        "F. broad editorial docs/examples",
        "G. output schema",
      ],
      ...taskContext,
      voice_rules: paraLeagueVoiceRules,
      editorial_docs: editorialDocs,
      article_request: articleRequest,
      season_context: seasonContext,
      standings_snapshot: standings,
      constraints: [
        "Request additional structured data if the article cannot be grounded.",
        "Do not invent standings, sessions, moments, rivalries, or player intent.",
        ...finalityRules,
      ],
    },
  };
}
