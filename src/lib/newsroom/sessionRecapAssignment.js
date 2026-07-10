export const sessionRecapAssignment = {
  id: "para-session-recap-assignment-v1",
  title: "Official Public Session Recap Assignment",
  priority:
    "This assignment controls the session recap task. Broad docs are reference material; this assignment is the active brief.",
  role:
    "You are writing the official public session recap for Para League. This is a league article, not a database summary.",
  publicWritingRules: [
    "Lead with the competitive story: who won, how the session turned, and what the result means in plain league terms.",
    "Use stakes, sequence, contrast, pressure, consequence, and player movement to create drama.",
    "Make the winner feel earned using verified result lines and hand sequence.",
    "Make the strongest non-winner feel worthy when the facts support it.",
    "Add drama through verified sequence and consequence, not fabricated emotion.",
    "Keep confidence notes and missing data warnings out of the public prose.",
  ],
  factualBoundaries: [
    "Do not invent facts, motives, emotions, rivalries, table talk, hand action, or standings impact.",
    "Do not say a player was nervous, tilted, fearless, hunting, angry, heroic, or outclassed unless that is explicitly supplied.",
    "Do not overstate one session as a final identity, dynasty, rivalry, or season trend.",
  ],
  bannedLanguage: [
    "source facts",
    "context packet",
    "verified data shows",
    "public read",
    "archive is tracking",
    "profile marker",
    "clean reference point",
    "X Secures Victory",
    "X Dominates",
    "A Night of",
    "Battle for",
    "Clash of",
    "In a thrilling session",
    "The stage was set",
  ],
  recommendedShape: [
    "Headline: specific, result-forward, not generic.",
    "Subheadline: one sentence with winner, pressure point, and session consequence.",
    "Recap body: 3-6 paragraphs, article-like, with no audit language.",
    "Key moments: 3-4 distinct moments with different narrative roles.",
    "Player blurbs: short, dignified notes on each relevant player.",
  ],
  defaultVariation: "turning_point_led",
  variations: [
    {
      key: "turning_point_led",
      label: "Turning point led",
      instruction:
        "Open from the hand or sequence that changed the session picture, then land the result and consequences.",
    },
    {
      key: "winner_story",
      label: "Winner story",
      instruction:
        "Lead with how the winner earned the night, using verified result lines and the strongest supplied hand evidence.",
    },
    {
      key: "resistance_story",
      label: "Resistance story",
      instruction:
        "Give the winner the result while making the strongest non-winner's verified resistance part of the article shape.",
    },
    {
      key: "standings_marker",
      label: "Standings marker",
      instruction:
        "Frame the session around what the first board or current standings line now says. Do not invent movement or stakes.",
    },
  ],
};

export function getSessionRecapVariationOptions() {
  return sessionRecapAssignment.variations;
}

export function getSelectedSessionRecapVariation(requestedKey = "") {
  const requested = String(requestedKey || "").trim();
  return (
    sessionRecapAssignment.variations.find((variation) => variation.key === requested) ||
    sessionRecapAssignment.variations.find((variation) => variation.key === sessionRecapAssignment.defaultVariation) ||
    sessionRecapAssignment.variations[0]
  );
}

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function cleanName(value, fallback = "Unknown Player") {
  return text(value, fallback).replace(/\s+@\s+\S+\s*$/u, "").trim();
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value, fallback = "") {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString("en-US") : text(value, fallback);
}

function handLabel(hand) {
  return hand?.hand_no ? `Hand #${hand.hand_no}` : "a recorded hand";
}

function potText(hand) {
  return hand?.pot_collected ? `${formatNumber(hand.pot_collected)} chips` : "an unlisted pot";
}

export function buildSessionStoryPlan({ session, sessionResults = [], playerSessionStats = [], notableHands = [], hands = [] }) {
  const approvedResults = sessionResults
    .filter((result) => result.approved)
    .sort((left, right) => numberValue(left.finish, 99) - numberValue(right.finish, 99));
  const winner = approvedResults[0] || null;
  const strongestNonWinner = approvedResults.find((result) => String(result.player_id || result.player_name) !== String(winner?.player_id || winner?.player_name)) || null;
  const allHands = [...(hands || []), ...(notableHands || [])]
    .filter((hand) => hand?.hand_no || hand?.pot_collected)
    .sort((left, right) => numberValue(left.hand_no, 9999) - numberValue(right.hand_no, 9999));
  const biggestPot = [...allHands]
    .filter((hand) => hand.pot_collected)
    .sort((left, right) => numberValue(right.pot_collected) - numberValue(left.pot_collected))[0] || null;
  const lateHand = [...allHands]
    .filter((hand) => hand.hand_no && numberValue(hand.hand_no) >= Math.max(1, numberValue(session?.hands_count) - 10))
    .sort((left, right) => numberValue(right.pot_collected) - numberValue(left.pot_collected))[0] || null;
  const winnerName = cleanName(winner?.player_name, "");
  const nonWinnerName = cleanName(strongestNonWinner?.player_name, "");
  const sessionCode = text(session?.session_code, "the session");

  return {
    primary_result: winner
      ? `${winnerName} finished first in ${sessionCode} with ${text(winner.league_points, "0")} league points.`
      : `${sessionCode} has no approved winner in the supplied results.`,
    main_character: winnerName || "No approved winner supplied",
    strongest_non_winner_note: strongestNonWinner
      ? `${nonWinnerName} finished #${text(strongestNonWinner.finish, "-")} with ${text(strongestNonWinner.league_points, "0")} league points.`
      : "No approved non-winner result is available.",
    turning_point: biggestPot
      ? `${handLabel(biggestPot)} is the leading turning-point candidate: ${cleanName(biggestPot.winner_name)} won ${potText(biggestPot)}.`
      : "No biggest-pot hand is available.",
    session_texture: [
      session?.hands_count ? `${session.hands_count} tracked hands` : "",
      playerSessionStats.length ? `${playerSessionStats.length} players with session stats` : "",
      notableHands.length ? `${notableHands.length} notable hands available` : "",
    ].filter(Boolean).join("; ") || "Limited session texture is available.",
    pressure_sequence: allHands.slice(0, 5).map((hand) => ({
      hand_no: text(hand.hand_no),
      winner_name: cleanName(hand.winner_name, ""),
      pot_text: potText(hand),
      role: hand === biggestPot ? "largest recorded pot" : hand === lateHand ? "late-session answer candidate" : "supporting hand fact",
    })),
    what_changed: winner
      ? `${winnerName} took the first-place line; ${biggestPot ? `${handLabel(biggestPot)} supplied the largest chip swing in the available hand data.` : "the hand-level turning point is not fully supplied."}`
      : "The result can be described only as logged, not decided, until approved results are present.",
    what_not_to_overstate: [
      "Do not claim season-long momentum from one session.",
      "Do not claim standings movement unless before/after standings are supplied.",
      "Do not turn notable hand summaries into proof of emotion, intent, rivalry, or private strategy.",
    ],
    missing_context: [
      allHands.length ? "" : "No hand-level detail is available.",
      biggestPot ? "" : "No largest-pot candidate is available.",
      approvedResults.length ? "" : "No approved public results are available.",
    ].filter(Boolean),
    recommended_angle: winner && biggestPot
      ? `${winnerName}'s win should be framed through the result line and ${handLabel(biggestPot)}, the largest available pot.`
      : winner
        ? `${winnerName}'s win should be framed through the approved result while acknowledging limited hand context.`
        : "Keep the recap cautious until approved results are present.",
  };
}
