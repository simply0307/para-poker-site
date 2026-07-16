import { stripPlayerHandlesFromText } from "@/lib/playerNames";

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function arrayValue(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [value];
}

function unique(values = []) {
  return [...new Set(values.map((value) => text(value).trim()).filter(Boolean))];
}

function actionRowsFor(hand = {}) {
  return [
    ...(Array.isArray(hand.actionRows) ? hand.actionRows : []),
    ...(Array.isArray(hand.action_rows) ? hand.action_rows : []),
    ...(Array.isArray(hand.actions_log) ? hand.actions_log : []),
    ...(Array.isArray(hand.actionLog?.actions) ? hand.actionLog.actions : []),
  ];
}

export function handArchiveItem(hand = {}, index = 0, fallbackSession = "") {
  const actions = actionRowsFor(hand);
  const positions = unique([
    hand.position,
    ...actions.map((action) => action.position),
  ]);
  const actionTypes = unique(actions.map((action) => action.action));
  const players = unique([
    hand.winner_name,
    hand.player_name,
    ...arrayValue(hand.players_involved),
    ...arrayValue(hand.player_names),
    ...arrayValue(hand.involved_players),
    ...actions.map((action) => action.player_name),
  ]).map((name) => stripPlayerHandlesFromText(name));
  const session = text(hand.sessionCode || hand.session_code || hand.session_id || fallbackSession, "Session pending");
  const winner = stripPlayerHandlesFromText(text(hand.winner_name || hand.player_name));
  const potBb = numberValue(hand.pot_bb, null);
  const potChips = numberValue(hand.pot_collected, null);
  const handNo = numberValue(hand.hand_no, index + 1);
  const searchText = [
    session,
    `hand ${handNo}`,
    winner,
    hand.board,
    hand.winning_hand,
    hand.raw_result,
    hand.summary,
    hand.typeLabel,
    ...players,
    ...positions,
    ...actionTypes,
  ].map((value) => stripPlayerHandlesFromText(text(value))).join(" ").toLowerCase();

  return {
    id: text(hand.id || hand.hand_id || `${session}-${handNo}-${index}`),
    index,
    label: handNo ? `Hand #${handNo}` : "Recorded hand",
    handNo,
    session,
    winner,
    potBb,
    potChips,
    potSort: potBb || potChips || 0,
    positions,
    actionTypes,
    players,
    showdown: Boolean(hand.showdown || hand.board || hand.winning_hand),
    hasAction: Boolean(hand.hasChronologicalAction || hand.actionLog?.kind === "action_log" || actions.length),
    searchText,
  };
}
