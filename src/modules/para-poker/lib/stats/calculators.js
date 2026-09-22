import { detectBigBlindFromActions, potBb } from "../poker/potUnits.js";

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pct(part, total) {
  const parsedTotal = numberValue(total);
  if (!parsedTotal) return null;
  return Number(((numberValue(part) / parsedTotal) * 100).toFixed(1));
}

function playerKey(row = {}) {
  return text(row.player_id || row.winner_player_id || row.player_name || row.winner_name).trim();
}

function actionKind(action = {}) {
  return text(action.action).toLowerCase();
}

function isPreflop(action = {}) {
  return text(action.street, "preflop").toLowerCase() === "preflop";
}

function isVoluntaryPreflop(action = {}) {
  if (!isPreflop(action)) return false;
  const kind = actionKind(action);
  if (!kind) return false;
  if (kind.includes("posts")) return false;
  if (kind.includes("fold")) return false;
  if (kind.includes("check")) return false;
  return kind.includes("call") || kind.includes("raise") || kind.includes("bet") || Boolean(action.all_in);
}

function isPreflopRaise(action = {}) {
  return isPreflop(action) && actionKind(action).includes("raise");
}

function isPreflopCall(action = {}) {
  return isPreflop(action) && actionKind(action).includes("call");
}

function isFold(action = {}) {
  return actionKind(action).includes("fold");
}

function isAllIn(action = {}) {
  return Boolean(action.all_in) || /all[-\s]?in/i.test(text(action.raw_entry));
}

function handKey(row = {}) {
  if (row.session_id && row.hand_no) return `session:${row.session_id}:hand_no:${row.hand_no}`;
  if (row.hand_no) return `hand_no:${row.hand_no}`;
  return text(row.hand_id || row.id).trim();
}

function addHand(set, hand) {
  const key = handKey(hand);
  if (key) set.add(key);
}

function emptySessionStat(row = {}) {
  return {
    session_id: row.session_id || null,
    player_id: row.player_id || row.winner_player_id || null,
    player_name: text(row.player_name || row.winner_name, "Player"),
    handsSet: new Set(),
    voluntaryHands: new Set(),
    pfrHands: new Set(),
    limpHands: new Set(),
    callVsRaiseHands: new Set(),
    openRaiseHands: new Set(),
    threeBetHands: new Set(),
    hands_won: 0,
    total_collected: 0,
    total_collected_bb: 0,
    biggest_pot_won: 0,
    biggest_pot_won_bb: 0,
    all_ins: 0,
    preflop_all_ins: 0,
    folds: 0,
    showdownHands: new Set(),
    wonShowdownHands: new Set(),
  };
}

function finalizeSessionStat(stat) {
  const hands = stat.handsSet.size;
  const vpip_pct = pct(stat.voluntaryHands.size, hands);
  const pfr_pct = pct(stat.pfrHands.size, hands);
  const fold_pct = pct(stat.folds, hands);
  const hand_win_pct = pct(stat.hands_won, hands) || 0;
  const wtsd_pct = pct(stat.showdownHands.size, hands);
  const wsd_pct = pct(stat.wonShowdownHands.size, stat.showdownHands.size);

  return {
    session_id: stat.session_id,
    player_id: stat.player_id,
    player_name: stat.player_name,
    hands,
    hands_won: stat.hands_won,
    hand_win_pct,
    total_collected: stat.total_collected,
    total_collected_bb: stat.total_collected_bb ? Number(stat.total_collected_bb.toFixed(2)) : null,
    biggest_pot_won: stat.biggest_pot_won,
    biggest_pot_won_bb: stat.biggest_pot_won_bb ? Number(stat.biggest_pot_won_bb.toFixed(2)) : null,
    all_ins: stat.all_ins,
    folds: stat.folds,
    fold_pct: fold_pct || 0,
    vpip_pct,
    pfr_pct,
    vpip_pfr_gap: vpip_pct !== null && pfr_pct !== null ? Number((vpip_pct - pfr_pct).toFixed(1)) : null,
    three_bet_pct: pct(stat.threeBetHands.size, hands),
    open_raise_pct: pct(stat.openRaiseHands.size, hands),
    limp_pct: pct(stat.limpHands.size, hands),
    call_pf_raise_pct: pct(stat.callVsRaiseHands.size, hands),
    preflop_all_ins: stat.preflop_all_ins,
    wtsd_pct,
    wsd_pct,
    wwsf_pct: hand_win_pct,
    primary_label: null,
    secondary_label: null,
  };
}

export function derivePlayerSessionStatsFromRows({ session, hands = [], actions = [] } = {}) {
  const byPlayer = new Map();
  const sessionId = session?.id || hands[0]?.session_id || actions[0]?.session_id || null;
  const actionsByHand = new Map();

  for (const action of actions || []) {
    const key = handKey(action);
    if (!key) continue;
    if (!actionsByHand.has(key)) actionsByHand.set(key, []);
    actionsByHand.get(key).push(action);
  }

  function statFor(row = {}) {
    const key = playerKey(row);
    if (!key) return null;
    if (!byPlayer.has(key)) {
      byPlayer.set(key, emptySessionStat({ ...row, session_id: sessionId }));
    }
    const stat = byPlayer.get(key);
    if (row.player_id && !stat.player_id) stat.player_id = row.player_id;
    if ((row.player_name || row.winner_name) && !stat.player_name) stat.player_name = text(row.player_name || row.winner_name);
    return stat;
  }

  for (const action of actions || []) {
    const stat = statFor(action);
    if (!stat) continue;
    addHand(stat.handsSet, action);
    if (isVoluntaryPreflop(action)) addHand(stat.voluntaryHands, action);
    if (isPreflopRaise(action)) addHand(stat.pfrHands, action);
    if (isPreflopCall(action)) addHand(stat.limpHands, action);
    if (action.is_call_vs_raise) addHand(stat.callVsRaiseHands, action);
    if (action.is_open_raise || isPreflopRaise(action)) addHand(stat.openRaiseHands, action);
    if (action.is_3bet) addHand(stat.threeBetHands, action);
    if (isFold(action)) stat.folds += 1;
    if (isAllIn(action)) {
      stat.all_ins += 1;
      if (isPreflop(action)) stat.preflop_all_ins += 1;
    }
  }

  for (const hand of hands || []) {
    const winnerStat = statFor({
      session_id: sessionId,
      player_id: hand.winner_player_id,
      player_name: hand.winner_name,
      winner_player_id: hand.winner_player_id,
      winner_name: hand.winner_name,
    });
    if (!winnerStat) continue;
    addHand(winnerStat.handsSet, hand);
    const handActions = actionsByHand.get(handKey(hand)) || [];
    const bigBlind = numberValue(hand.big_blind) || detectBigBlindFromActions(handActions);
    const normalizedPot = numberValue(hand.pot_bb) || potBb(hand.pot_collected, bigBlind);
    winnerStat.hands_won += 1;
    winnerStat.total_collected += numberValue(hand.pot_collected);
    winnerStat.biggest_pot_won = Math.max(winnerStat.biggest_pot_won, numberValue(hand.pot_collected));
    if (normalizedPot) {
      winnerStat.total_collected_bb += normalizedPot;
      winnerStat.biggest_pot_won_bb = Math.max(winnerStat.biggest_pot_won_bb, normalizedPot);
    }
    if (hand.showdown) {
      addHand(winnerStat.showdownHands, hand);
      addHand(winnerStat.wonShowdownHands, hand);
    }
  }

  return [...byPlayer.values()]
    .map(finalizeSessionStat)
    .filter((row) => row.player_name && row.hands > 0)
    .sort((left, right) => left.player_name.localeCompare(right.player_name));
}

export function deriveSessionResultSuggestionsFromRows({ session, sessionStats = [], actions = [] } = {}) {
  const matchWinner = [...(actions || [])].reverse().find((action) => /wins the match/i.test(text(action.raw_entry)));
  const winnerName = text(matchWinner?.player_name);
  const rows = [...(sessionStats || [])].sort((left, right) => {
    if (winnerName) {
      if (left.player_name === winnerName) return -1;
      if (right.player_name === winnerName) return 1;
    }
    return numberValue(right.total_collected) - numberValue(left.total_collected) ||
      numberValue(right.hands_won) - numberValue(left.hands_won) ||
      numberValue(right.biggest_pot_won) - numberValue(left.biggest_pot_won);
  });

  return rows.map((row, index) => ({
    session_id: session?.id || row.session_id,
    player_id: row.player_id || null,
    player_name: row.player_name,
    finish: index + 1,
    league_points: 0,
    final_stack: 0,
    confidence: winnerName ? "suggested_match_winner" : "suggested_from_session_stats",
    notes: winnerName
      ? "Suggested from imported match winner line; admin must confirm."
      : "Suggested from collected chips and hand wins; admin must confirm.",
    approved: false,
  }));
}

function aggregatePercent(numerator, denominator) {
  return denominator ? Number(((numerator / denominator) * 100).toFixed(1)) : null;
}

export function aggregatePlayerStats({ seasonCode = "S0", sessionStats = [], sessionResults = [], sessions = [] } = {}) {
  const byPlayer = new Map();
  const sessionById = new Map((sessions || []).map((session) => [String(session.id), session]));
  const resultsByPlayer = new Map();

  for (const result of sessionResults || []) {
    const key = playerKey(result);
    if (!key) continue;
    if (!resultsByPlayer.has(key)) resultsByPlayer.set(key, []);
    resultsByPlayer.get(key).push(result);
  }

  for (const stat of sessionStats || []) {
    const key = playerKey(stat);
    if (!key) continue;
    if (!byPlayer.has(key)) {
      byPlayer.set(key, {
        season_code: seasonCode,
        player_id: stat.player_id || null,
        player_name: text(stat.player_name, "Player"),
        sessions_played: 0,
        hands: 0,
        hands_won: 0,
        total_collected: 0,
        total_collected_bb: 0,
        biggest_pot_won: 0,
        biggest_pot_won_bb: 0,
        all_ins: 0,
        folds: 0,
        preflop_all_ins: 0,
        wins: 0,
        top_3s: 0,
        top_4s: 0,
        total_points: 0,
        finishes: [],
        latest_session_id: null,
        latest_session_code: "",
        vpipNumerator: 0,
        pfrNumerator: 0,
      });
    }
    const row = byPlayer.get(key);
    row.sessions_played += 1;
    row.hands += numberValue(stat.hands);
    row.hands_won += numberValue(stat.hands_won);
    row.total_collected += numberValue(stat.total_collected);
    row.total_collected_bb += numberValue(stat.total_collected_bb);
    row.biggest_pot_won = Math.max(row.biggest_pot_won, numberValue(stat.biggest_pot_won));
    row.biggest_pot_won_bb = Math.max(row.biggest_pot_won_bb, numberValue(stat.biggest_pot_won_bb));
    row.all_ins += numberValue(stat.all_ins);
    row.folds += numberValue(stat.folds);
    row.preflop_all_ins += numberValue(stat.preflop_all_ins);
    if (stat.vpip_pct !== null && stat.vpip_pct !== undefined) row.vpipNumerator += numberValue(stat.vpip_pct) * numberValue(stat.hands);
    if (stat.pfr_pct !== null && stat.pfr_pct !== undefined) row.pfrNumerator += numberValue(stat.pfr_pct) * numberValue(stat.hands);
    const session = sessionById.get(String(stat.session_id));
    if (session) {
      row.latest_session_id = session.id;
      row.latest_session_code = session.session_code || row.latest_session_code;
    }
  }

  for (const [key, results] of resultsByPlayer.entries()) {
    if (!byPlayer.has(key)) {
      const first = results[0] || {};
      byPlayer.set(key, {
        season_code: seasonCode,
        player_id: first.player_id || null,
        player_name: text(first.player_name, "Player"),
        sessions_played: 0,
        hands: 0,
        hands_won: 0,
        total_collected: 0,
        total_collected_bb: 0,
        biggest_pot_won: 0,
        biggest_pot_won_bb: 0,
        all_ins: 0,
        folds: 0,
        preflop_all_ins: 0,
        wins: 0,
        top_3s: 0,
        top_4s: 0,
        total_points: 0,
        finishes: [],
        latest_session_id: null,
        latest_session_code: "",
        vpipNumerator: 0,
        pfrNumerator: 0,
      });
    }
    const row = byPlayer.get(key);
    for (const result of results) {
      const finish = numberValue(result.finish);
      row.total_points += numberValue(result.league_points || result.points);
      if (finish) {
        row.finishes.push(finish);
        row.wins += finish === 1 ? 1 : 0;
        row.top_3s += finish <= 3 ? 1 : 0;
        row.top_4s += finish <= 4 ? 1 : 0;
      }
    }
  }

  return [...byPlayer.values()].map((row) => {
    const avg_finish = row.finishes.length ? Number((row.finishes.reduce((sum, finish) => sum + finish, 0) / row.finishes.length).toFixed(2)) : null;
    const best_finish = row.finishes.length ? Math.min(...row.finishes) : null;
    const vpip_pct = row.hands ? Number((row.vpipNumerator / row.hands).toFixed(1)) : null;
    const pfr_pct = row.hands ? Number((row.pfrNumerator / row.hands).toFixed(1)) : null;
    const { finishes, vpipNumerator, pfrNumerator, ...clean } = row;
    return {
      ...clean,
      hand_win_pct: aggregatePercent(clean.hands_won, clean.hands) || 0,
      fold_pct: aggregatePercent(clean.folds, clean.hands) || 0,
      vpip_pct,
      pfr_pct,
      vpip_pfr_gap: vpip_pct !== null && pfr_pct !== null ? Number((vpip_pct - pfr_pct).toFixed(1)) : null,
      best_finish,
      avg_finish,
    };
  });
}
