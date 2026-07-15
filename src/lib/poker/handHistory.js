import { stripPlayerHandle, stripPlayerHandlesFromText } from "@/lib/playerNames";
import { enrichHandWithPotUnits } from "@/lib/poker/potUnits";

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function present(value) {
  return value !== null && value !== undefined && value !== "";
}

function cleanName(value, fallback = "Unknown Player") {
  return stripPlayerHandle(value, fallback);
}

function formatNumber(value, fallback = "-") {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString("en-US") : text(value, fallback);
}

function valueToLogText(value) {
  if (!present(value)) return "";
  if (Array.isArray(value)) return value.map(valueToLogText).filter(Boolean).join("\n");
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return stripPlayerHandlesFromText(value);
}

function streetValue(hand, keys) {
  return keys.map((key) => valueToLogText(hand?.[key])).find(Boolean) || "";
}

function extractBoardCards(value) {
  const normalized = valueToLogText(value);
  if (!normalized) return [];
  const compact = normalized.replace(/10/gu, "T");
  return [...compact.matchAll(/\b([2-9TJQKA][♣♦♥♠cdhs])/giu)]
    .map((match) => match[1].replace(/^T/iu, "10").replace(/[cdhs]$/u, (suit) => ({
      c: "♣",
      d: "♦",
      h: "♥",
      s: "♠",
    }[suit.toLowerCase()] || suit)));
}

function boardCardsForStreet(street, boardCards = []) {
  const key = text(street).toLowerCase();
  if (!boardCards.length) return [];
  if (key === "flop") return boardCards.slice(0, 3);
  if (key === "turn") return boardCards.slice(0, 4);
  if (key === "river" || key === "showdown" || key === "result") return boardCards.slice(0, 5);
  return [];
}

function addBoardToStreet(street, boardCards = []) {
  const cards = boardCardsForStreet(street.street, boardCards);
  return {
    ...street,
    boardCards: cards,
    boardText: cards.join(" "),
  };
}

function actionAmountText(action) {
  if (!present(action?.amount)) return "";
  const parsed = Number(action.amount);
  return Number.isFinite(parsed) ? formatNumber(parsed) : text(action.amount);
}

function actionPlayerName(action) {
  return cleanName(action?.player_name || action?.player || action?.name, "");
}

function actionText(action) {
  if (present(action?.raw_entry)) return stripPlayerHandlesFromText(action.raw_entry);
  return [
    actionPlayerName(action),
    text(action?.action),
    actionAmountText(action),
    action?.all_in ? "all in" : "",
  ].filter(Boolean).join(" ");
}

export function normalizeActionRow(action = {}) {
  return {
    id: action.id || null,
    hand_id: action.hand_id || null,
    hand_no: action.hand_no || null,
    order: action.log_order ?? action.action_order ?? action.order ?? action.id ?? null,
    street: text(action.street || "action").toLowerCase(),
    player_id: action.player_id || null,
    player_name: actionPlayerName(action),
    position: text(action.position),
    action: text(action.action),
    amount: action.amount ?? null,
    amount_text: actionAmountText(action),
    all_in: Boolean(action.all_in),
    raw_entry: stripPlayerHandlesFromText(action.raw_entry),
    line: actionText(action),
  };
}

function groupActionRowsByStreet(actionRows = []) {
  const normalized = actionRows
    .map(normalizeActionRow)
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
  const streetOrder = ["preflop", "flop", "turn", "river", "showdown", "result", "action"];
  const groups = new Map();

  for (const action of normalized) {
    const key = action.street || "action";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(action);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => {
      const leftIndex = streetOrder.indexOf(left);
      const rightIndex = streetOrder.indexOf(right);
      return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
    })
    .map(([street, actions]) => ({
      street: street.charAt(0).toUpperCase() + street.slice(1),
      actions,
      body: actions.map((action) => action.line).join("\n"),
    }));
}

function handKeyCandidates(hand = {}) {
  return [
    hand.session_id && hand.hand_id ? `session:${hand.session_id}:hand_id:${hand.hand_id}` : "",
    hand.session_id && hand.id ? `session:${hand.session_id}:id:${hand.id}` : "",
    hand.session_id && hand.hand_no ? `session:${hand.session_id}:hand_no:${hand.hand_no}` : "",
    hand.hand_id,
    hand.id,
    hand.hand_no ? `hand_no:${hand.hand_no}` : "",
  ].map((value) => text(value)).filter(Boolean);
}

function actionKeyCandidates(action = {}) {
  return [
    action.session_id && action.hand_id ? `session:${action.session_id}:hand_id:${action.hand_id}` : "",
    action.session_id && action.id ? `session:${action.session_id}:id:${action.id}` : "",
    action.session_id && action.hand_no ? `session:${action.session_id}:hand_no:${action.hand_no}` : "",
    action.hand_id,
    action.hand_no ? `hand_no:${action.hand_no}` : "",
  ].map((value) => text(value)).filter(Boolean);
}

export function attachActionsToHands(hands = [], actions = []) {
  const actionsByKey = new Map();
  for (const action of actions || []) {
    for (const key of actionKeyCandidates(action)) {
      if (!actionsByKey.has(key)) actionsByKey.set(key, []);
      actionsByKey.get(key).push(action);
    }
  }

  return (hands || []).map((hand) => {
    const actionRows = handKeyCandidates(hand).flatMap((key) => actionsByKey.get(key) || []);
    const deduped = [...new Map(actionRows.map((action) => [String(action.id || action.log_order || JSON.stringify(action)), action])).values()];
    return {
      ...enrichHandWithPotUnits(hand, deduped),
      actionRows: deduped.sort((left, right) => Number(left.log_order || left.id || 0) - Number(right.log_order || right.id || 0)),
    };
  });
}

export function normalizeHandActionLog(hand = {}) {
  const actionStreets = groupActionRowsByStreet(hand.actionRows || hand.action_rows || hand.actions_log || []);
  const boardCards = extractBoardCards(hand.board || hand.community_cards || hand.board_cards);
  const explicitRawAction = [
    hand.raw_hand_history,
    hand.raw_text,
    hand.hand_text,
    hand.hand_history,
    hand.hand_history_raw,
    hand.action_text,
    hand.action_log,
    hand.raw,
  ].map(valueToLogText).find(Boolean);

  const parsed = actionStreets.length ? "" : valueToLogText(hand.parsed_actions || hand.actions || hand.streets || hand.street_actions);
  const streets = [
    ["Blinds/Antes", streetValue(hand, ["blinds", "antes"])],
    ["Preflop", streetValue(hand, ["preflop", "preflop_actions"])],
    ["Flop", streetValue(hand, ["flop", "flop_actions"])],
    ["Turn", streetValue(hand, ["turn", "turn_actions"])],
    ["River", streetValue(hand, ["river", "river_actions"])],
    ["Showdown", streetValue(hand, ["showdown", "showdown_actions"])],
    ["Result", streetValue(hand, ["summary", "result", "details", "metadata"])],
  ]
    .filter(([, body]) => present(body))
    .map(([street, body]) => ({ street, body }));

  const displayStreets = (actionStreets.length ? actionStreets : streets).map((street) => addBoardToStreet(street, boardCards));
  const streetActionCount = displayStreets.filter((street) => !["Showdown", "Result"].includes(street.street)).length;
  const hasChronologicalAction = Boolean(actionStreets.length || explicitRawAction || parsed || streetActionCount);
  const summaryFacts = [
    ["Result", valueToLogText(hand.raw_result || hand.summary || hand.result)],
    ["Board", valueToLogText(hand.board)],
    ["Showdown", present(hand.showdown) ? (hand.showdown ? "Showdown reached" : "No showdown recorded") : ""],
    ["Winning hand", valueToLogText(hand.winning_hand)],
  ]
    .filter(([, body]) => present(body))
    .map(([label, body]) => ({ label, body }));

  return {
    raw: explicitRawAction,
    parsed,
    streets: displayStreets,
    actions: actionStreets.flatMap((street) => street.actions || []),
    boardCards,
    summaryFacts,
    resultLine: valueToLogText(hand.raw_result),
    hasAction: hasChronologicalAction,
    hasSummary: Boolean(summaryFacts.length),
    kind: hasChronologicalAction ? "action_log" : "summary",
    unavailableReason: hasChronologicalAction ? "" : "Action log not available for this hand.",
  };
}

export const extractHandActionLog = normalizeHandActionLog;

export function normalizeHandRow(hand = {}) {
  const enriched = enrichHandWithPotUnits(hand, hand.actionRows || []);
  const actionLog = normalizeHandActionLog(hand);
  return {
    ...enriched,
    actionLog,
    displayLabel: actionLog.kind === "action_log" ? "Hand History" : "Hand Summary",
    hasChronologicalAction: actionLog.kind === "action_log",
  };
}
