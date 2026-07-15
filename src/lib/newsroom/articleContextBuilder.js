import { normalizeArticleContextSelection, summarizeArticleContextSelection } from "@/lib/newsroom/articleContextSelection";
import {
  cleanName,
  formatNumber,
  getMomentNewsroomData,
  getMomentsIndex,
  getPlayerNewsroomData,
  getSessionNewsroomData,
  getSessionsIndex,
  getStandingsRows,
  text,
} from "@/lib/newsroom/data";

function unique(values = []) {
  return [...new Set(values.map((value) => text(value).trim()).filter(Boolean))];
}

function publicHandMoment(moment = {}) {
  return {
    moment_id: text(moment.id || moment.momentId || moment.hand_id),
    hand_no: text(moment.hand_no),
    winner_name: cleanName(moment.winner_name, ""),
    pot_collected: moment.pot_collected ? Number(moment.pot_collected) : null,
    pot_text: moment.pot_collected ? `${formatNumber(moment.pot_collected)} chips` : "",
    board: text(moment.board),
    winning_hand: text(moment.winning_hand),
    session_id: text(moment.session_id),
    tags: Array.isArray(moment.tags) ? moment.tags.map(String) : [],
  };
}

function compactSession(sessionData = {}) {
  const session = sessionData.session || {};
  const hands = sessionData.hands || [];
  const notableHands = sessionData.notableHands || [];

  return {
    id: session.id,
    session_code: session.session_code,
    season_code: session.season_code,
    played_at: session.played_at,
    table_name: session.table_name,
    status: session.status,
    hands_count: session.hands_count,
    participants: (sessionData.participants || []).map((player) => ({
      player_id: player.id,
      name: cleanName(player.name),
      slug: player.slug,
      hands: player.hands,
      finish: player.result?.finish || null,
      points: player.result?.league_points || null,
    })),
    results: (sessionData.sessionResults || []).map((row) => ({
      player_id: row.player_id,
      player_name: cleanName(row.player_name),
      finish: row.finish,
      points: row.league_points,
      approved: Boolean(row.approved),
    })),
    participant_stats: (sessionData.playerSessionStats || []).map((row) => ({
      player_id: row.player_id,
      player_name: cleanName(row.player_name),
      hands: row.hands,
      biggest_pot_won: row.biggest_pot_won,
      vpip: row.vpip,
      pfr: row.pfr,
    })),
    biggest_pots: hands
      .filter((hand) => hand?.pot_collected)
      .sort((left, right) => Number(right.pot_collected || 0) - Number(left.pot_collected || 0))
      .slice(0, 6)
      .map(publicHandMoment),
    notable_moments: notableHands.slice(0, 8).map(publicHandMoment),
  };
}

function compactPlayer(playerData = {}) {
  const player = playerData.player || {};

  return {
    id: player.id,
    slug: player.slug,
    name: cleanName(player.display_name || player.pokernow_name),
    standings: (playerData.standings || []).map((row) => ({
      season_code: row.season_code,
      rank: row.rank,
      points: row.points,
      sessions_played: row.sessions_played,
      top_finishes: row.top_finishes,
      player_name: cleanName(row.player_name),
    })),
    recent_session_stats: (playerData.sessionStats || []).slice(0, 8).map((row) => ({
      session_id: row.session_id,
      player_name: cleanName(row.player_name),
      hands: row.hands,
      biggest_pot_won: row.biggest_pot_won,
      vpip: row.vpip,
      pfr: row.pfr,
    })),
    recent_results: (playerData.sessionResults || []).slice(0, 8).map((row) => ({
      session_id: row.session_id,
      player_name: cleanName(row.player_name),
      finish: row.finish,
      points: row.league_points,
      approved: Boolean(row.approved),
    })),
    notable_moments: (playerData.moments || []).slice(0, 8).map(publicHandMoment),
  };
}

function compactMoment(momentData = {}) {
  const moment = momentData.moment || {};
  const session = momentData.session || {};

  return {
    ...publicHandMoment(moment),
    session: {
      id: session.id,
      session_code: session.session_code,
      season_code: session.season_code,
      played_at: session.played_at,
    },
    source_note: "Selected by an editor as article evidence. Use as fact source, not as required article outline.",
  };
}

async function expandSelection(selection) {
  const expanded = { ...selection };
  const shouldIncludeRecent = selection.includeRecentSessions || selection.evidenceMode === "selected_plus_recent" || selection.evidenceMode === "broad";
  const shouldIncludeTopMoments = selection.includeTopMoments || selection.evidenceMode === "broad";

  if (shouldIncludeRecent) {
    const sessions = await getSessionsIndex();
    expanded.sessionIds = unique([
      ...selection.sessionIds,
      ...(sessions || []).slice(0, selection.evidenceMode === "broad" ? 5 : 2).map((session) => session.session_code || session.id),
    ]);
  }

  if (shouldIncludeTopMoments) {
    const moments = await getMomentsIndex();
    expanded.momentIds = unique([
      ...selection.momentIds,
      ...(moments || []).slice(0, selection.evidenceMode === "broad" ? 8 : 3).map((moment) => moment.id || moment.hand_id),
    ]);
  }

  return expanded;
}

export async function buildSelectedArticleContext(selectionInput = {}) {
  const selection = await expandSelection(normalizeArticleContextSelection(selectionInput));
  const warnings = [];
  const seasonCode = selectionInput.seasonCode || "S0";

  const [selectedSessions, selectedPlayers, selectedMoments, selectedStandings] = await Promise.all([
    Promise.all(
      unique(selection.sessionIds).map(async (sessionId) => {
        const data = await getSessionNewsroomData(sessionId);
        if (!data) warnings.push(`Selected session not found: ${sessionId}`);
        return data ? compactSession(data) : null;
      })
    ),
    Promise.all(
      unique(selection.playerIds).map(async (playerId) => {
        const data = await getPlayerNewsroomData(playerId, seasonCode);
        if (!data) warnings.push(`Selected player not found: ${playerId}`);
        return data ? compactPlayer(data) : null;
      })
    ),
    Promise.all(
      unique(selection.momentIds).map(async (momentId) => {
        const data = await getMomentNewsroomData(momentId);
        if (!data) warnings.push(`Selected moment not found: ${momentId}`);
        return data ? compactMoment(data) : null;
      })
    ),
    selection.includeStandings ? getStandingsRows(seasonCode) : Promise.resolve([]),
  ]);

  if (!selectedSessions.some(Boolean) && !selectedPlayers.some(Boolean) && !selectedMoments.some(Boolean) && !selection.includeStandings) {
    warnings.push("No article evidence was selected. The draft should ask for structured context or stay broad and provisional.");
  }

  return {
    selection_summary: summarizeArticleContextSelection(selection),
    selected_sessions: selectedSessions.filter(Boolean),
    selected_players: selectedPlayers.filter(Boolean),
    selected_moments: selectedMoments.filter(Boolean),
    selected_standings: (selectedStandings || []).map((row) => ({
      season_code: row.season_code,
      rank: row.rank,
      points: row.points,
      sessions_played: row.sessions_played,
      player_name: cleanName(row.player_name),
      player_id: row.player_id,
    })),
    selected_hand_refs: selection.handRefs,
    editor_notes: selection.editorNotes,
    angle: selection.angle,
    warnings,
  };
}
