import { normalizeHandRow } from "@/lib/poker/handHistory";
import { formatPotWithBb } from "@/lib/poker/potUnits";
import { applyOverridesToEntity, applyOverridesToList, readActiveDataOverrides } from "@/lib/newsroom/applyDataOverrides";
import { getPublishedDraft } from "@/lib/newsroom/repositories/draftRepository";
import { getSessionNewsroomData } from "@/lib/newsroom/repositories/sessionRepository";

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function buildSessionViewModel(sessionIdOrCode) {
  const data = await getSessionNewsroomData(sessionIdOrCode);
  if (!data) return null;

  const overrides = await readActiveDataOverrides();
  const sessionOverride = applyOverridesToEntity(data.session, "session", overrides);
  const participantsOverride = applyOverridesToList(data.participants || [], "player", overrides);
  const resultsOverride = applyOverridesToList(data.sessionResults || [], "player", overrides);
  const statsOverride = applyOverridesToList(data.playerSessionStats || [], "player", overrides);
  const handOverride = applyOverridesToList(data.hands || [], "hand", overrides);
  const momentOverride = applyOverridesToList(data.notableHands || [], "moment", overrides);

  const session = sessionOverride.value;
  const participants = participantsOverride.value;
  const sessionResults = resultsOverride.value;
  const playerSessionStats = statsOverride.value;
  const handHistory = (handOverride.value || []).map(normalizeHandRow);
  const notableHands = (momentOverride.value || []).map(normalizeHandRow);
  const appliedOverrides = [
    ...sessionOverride.appliedOverrides,
    ...participantsOverride.appliedOverrides,
    ...resultsOverride.appliedOverrides,
    ...statsOverride.appliedOverrides,
    ...handOverride.appliedOverrides,
    ...momentOverride.appliedOverrides,
  ];
  const biggestPot = [...handHistory, ...notableHands]
    .filter((hand) => hand?.pot_collected)
    .sort((left, right) => numberValue(right.pot_bb || right.pot_collected) - numberValue(left.pot_bb || left.pot_collected))[0] || null;
  const publishedDraft = await getPublishedDraft({ scope: "session", sourceSessionId: data.session.id });
  const keyMoments = Array.isArray(publishedDraft?.draft?.key_moments) ? publishedDraft.draft.key_moments.slice(0, 4) : [];
  const hasFullActionLogs = handHistory.some((hand) => hand?.actionLog?.kind === "action_log" || hand?.hasChronologicalAction);

  return {
    session,
    rawSession: data.session,
    publishedDraft,
    keyMoments,
    participants,
    results: sessionResults,
    sessionResults,
    participantStats: playerSessionStats,
    playerSessionStats,
    notableHands,
    handHistory,
    hands: handHistory,
    standings: data.standings,
    biggestPot,
    hasFullActionLogs,
    appliedOverrides,
    keyNumbers: {
      players: participants.length || playerSessionStats.length || sessionResults.length,
      hands: session.hands_count || handHistory.length,
      moments: notableHands.length,
      biggestPot: biggestPot?.pot_collected || null,
      biggestPotText: biggestPot ? formatPotWithBb({ pot: biggestPot.pot_collected, potBb: biggestPot.pot_bb, bigBlind: biggestPot.big_blind }) : null,
    },
  };
}
