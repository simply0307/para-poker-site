function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function numberValue(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function actionKind(action = {}) {
  return text(action.action).toLowerCase();
}

export function roundBb(value) {
  const parsed = numberValue(value);
  if (parsed === null) return null;
  return Number(parsed.toFixed(parsed >= 10 ? 1 : 2));
}

export function detectBigBlindFromActions(actions = []) {
  const bigBlindAction = (actions || []).find((action) => actionKind(action).includes("big blind"));
  const bigBlind = numberValue(bigBlindAction?.amount);
  if (bigBlind && bigBlind > 0) return bigBlind;

  const smallBlindAction = (actions || []).find((action) => actionKind(action).includes("small blind"));
  const smallBlind = numberValue(smallBlindAction?.amount);
  return smallBlind && smallBlind > 0 ? smallBlind * 2 : null;
}

export function potBb(potCollected, bigBlind) {
  const pot = numberValue(potCollected);
  const blind = numberValue(bigBlind);
  if (!pot || !blind || blind <= 0) return null;
  return roundBb(pot / blind);
}

export function enrichHandWithPotUnits(hand = {}, actions = []) {
  const bigBlind = numberValue(hand.big_blind) || detectBigBlindFromActions(actions || hand.actionRows || []);
  const smallBlind = numberValue(hand.small_blind) || (bigBlind ? bigBlind / 2 : null);
  const normalizedPot = numberValue(hand.pot_bb) || potBb(hand.pot_collected, bigBlind);
  return {
    ...hand,
    small_blind: smallBlind,
    big_blind: bigBlind,
    pot_bb: normalizedPot,
  };
}

export function formatBb(value, fallback = "") {
  const parsed = numberValue(value);
  if (parsed === null) return fallback;
  return `${roundBb(parsed)} BB`;
}

export function formatPotWithBb({ pot, potBb: normalizedPot, bigBlind } = {}) {
  const chipValue = numberValue(pot);
  const bbValue = numberValue(normalizedPot) || potBb(pot, bigBlind);
  if (bbValue !== null && chipValue !== null) return `${formatBb(bbValue)} / ${chipValue.toLocaleString("en-US")} chips`;
  if (bbValue !== null) return formatBb(bbValue);
  if (chipValue !== null) return `${chipValue.toLocaleString("en-US")} chips`;
  return "";
}
