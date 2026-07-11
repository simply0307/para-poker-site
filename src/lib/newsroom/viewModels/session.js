import { normalizeHandRow } from "@/lib/poker/handHistory";
import { getPublishedDraft } from "@/lib/newsroom/repositories/draftRepository";
import { getSessionNewsroomData } from "@/lib/newsroom/repositories/sessionRepository";

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function buildSessionViewModel(sessionIdOrCode) {
  const data = await getSessionNewsroomData(sessionIdOrCode);
  if (!data) return null;

  const handHistory = (data.hands || []).map(normalizeHandRow);
  const notableHands = (data.notableHands || []).map(normalizeHandRow);
  const biggestPot = [...handHistory, ...notableHands]
    .filter((hand) => hand?.pot_collected)
    .sort((left, right) => numberValue(right.pot_collected) - numberValue(left.pot_collected))[0] || null;
  const publishedDraft = await getPublishedDraft({ scope: "session", sourceSessionId: data.session.id });
  const keyMoments = Array.isArray(publishedDraft?.draft?.key_moments) ? publishedDraft.draft.key_moments.slice(0, 4) : [];
  const hasFullActionLogs = handHistory.some((hand) => hand?.actionLog?.kind === "action_log" || hand?.hasChronologicalAction);

  return {
    session: data.session,
    publishedDraft,
    keyMoments,
    participants: data.participants,
    results: data.sessionResults,
    sessionResults: data.sessionResults,
    participantStats: data.playerSessionStats,
    playerSessionStats: data.playerSessionStats,
    notableHands,
    handHistory,
    hands: handHistory,
    standings: data.standings,
    biggestPot,
    hasFullActionLogs,
    keyNumbers: {
      players: data.participants.length || data.playerSessionStats.length || data.sessionResults.length,
      hands: data.session.hands_count || handHistory.length,
      moments: notableHands.length,
      biggestPot: biggestPot?.pot_collected || null,
    },
  };
}
