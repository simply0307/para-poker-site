import { cleanName, text } from "@/lib/newsroom/data";

function numberValue(value, fallback = 0) {
  const match = String(value || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!match) return fallback;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function quotedName(line = "") {
  const match = line.match(/"([^"]+)"/);
  return match?.[1] || "";
}

function normalizeStreet(line = "", currentStreet = "preflop") {
  if (/^\s*flop\b/i.test(line) || /dealing flop/i.test(line)) return "flop";
  if (/^\s*turn\b/i.test(line) || /dealing turn/i.test(line)) return "turn";
  if (/^\s*river\b/i.test(line) || /dealing river/i.test(line)) return "river";
  if (/showdown/i.test(line)) return "showdown";
  return currentStreet || "preflop";
}

function parseBoard(line = "") {
  if (!/(flop|turn|river|board)/i.test(line)) return "";
  const cards = line.match(/\[[^\]]+\]/g);
  return cards?.length ? `${line.split(":")[0].trim()}: ${cards.join(" ")}` : line.trim();
}

function actionKind(line = "") {
  const lower = line.toLowerCase();
  if (lower.includes("posts a small blind")) return "posts small blind";
  if (lower.includes("posts a big blind")) return "posts big blind";
  if (lower.includes("raises")) return "raises";
  if (lower.includes("bets")) return "bets";
  if (lower.includes("calls")) return "calls";
  if (lower.includes("checks")) return "checks";
  if (lower.includes("folds")) return "folds";
  if (lower.includes("collected")) return "collected";
  if (lower.includes("shows")) return "shows";
  if (lower.includes("mucks")) return "mucks";
  if (lower.includes("wins")) return "wins";
  return "";
}

function parseHandStart(line = "") {
  const handNoMatch =
    line.match(/hand\s*#?\s*(\d+)/i) ||
    line.match(/starting\s+hand\s*#?\s*(\d+)/i) ||
    line.match(/--\s*hand\s*#?\s*(\d+)/i);
  if (!handNoMatch) return null;
  const codeMatch = line.match(/\b([a-z0-9]{8,16})\b/i);
  return {
    hand_no: Number(handNoMatch[1]),
    hand_code: codeMatch?.[1] || `hand-${handNoMatch[1]}`,
    raw_start: line,
  };
}

function parseCsvRows(csvText = "") {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const input = String(csvText || "").replace(/^\uFEFF/u, "");

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => String(header || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  return rows.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, String(values[index] || "").trim()]))
  );
}

function csvToRawHistory(csvText = "") {
  const rows = parseCsvRows(csvText);
  if (!rows.length) return "";
  const rawColumn = ["raw_entry", "raw", "line", "log_entry", "entry"].find((key) => key in rows[0]);
  if (rawColumn) return rows.map((row) => row[rawColumn]).filter(Boolean).join("\n");

  const grouped = new Map();
  for (const row of rows) {
    const handNo = numberValue(row.hand_no || row.hand_number || row.hand || row.hand_id, 0);
    if (!handNo) continue;
    if (!grouped.has(handNo)) grouped.set(handNo, []);
    grouped.get(handNo).push(row);
  }

  const lines = [];
  for (const [handNo, handRows] of [...grouped.entries()].sort((left, right) => left[0] - right[0])) {
    const handCode = handRows[0].hand_code || handRows[0].hand_id || `hand-${handNo}`;
    lines.push(`Hand #${handNo} ${handCode}`);
    for (const row of handRows.sort((left, right) => numberValue(left.log_order || left.order || left.action_order, 0) - numberValue(right.log_order || right.order || right.action_order, 0))) {
      const explicitRaw = row.raw_entry || row.raw || row.line;
      if (explicitRaw) {
        lines.push(explicitRaw);
        continue;
      }
      const street = row.street ? `${row.street}: ` : "";
      const player = row.player_name || row.player || row.actor || "";
      const action = row.action || row.action_type || "";
      const amount = row.amount || row.chips || "";
      const board = row.board || "";
      if (board) lines.push(`${row.street || "Board"}: ${board}`);
      if (player || action) {
        const potSuffix = String(action).toLowerCase().includes("collected") && !String(action).toLowerCase().includes("pot")
          ? " from pot"
          : "";
        lines.push(`${street}"${player}" ${action}${amount ? ` ${amount}` : ""}${potSuffix}`);
      }
      if (row.winner_name || row.pot_collected) {
        lines.push(`"${row.winner_name || player}" collected ${row.pot_collected || amount || 0} from pot`);
      }
    }
  }
  return lines.join("\n");
}

function finalizeHand(hand) {
  if (!hand) return null;
  const winners = hand.actions.filter((action) => action.action === "collected" || action.action === "wins");
  const winner = winners[winners.length - 1] || null;
  const showdown = hand.actions.some((action) => action.action === "shows") || Boolean(hand.board);

  return {
    ...hand,
    winner_name: winner?.player_name || "",
    pot_collected: winner?.amount || 0,
    raw_result: winner?.raw_entry || "",
    showdown,
  };
}

export function parseRawHandHistory(rawText = "") {
  const lines = String(rawText || "").split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  const hands = [];
  const players = new Map();
  const warnings = [];
  let current = null;
  let street = "preflop";

  for (const [index, line] of lines.entries()) {
    const start = parseHandStart(line);
    if (start) {
      const completed = finalizeHand(current);
      if (completed) hands.push(completed);
      current = {
        hand_no: start.hand_no,
        hand_code: start.hand_code,
        raw_start: start.raw_start,
        board: "",
        winning_hand: "",
        actions: [],
      };
      street = "preflop";
      continue;
    }

    if (!current) continue;

    street = normalizeStreet(line, street);
    const board = parseBoard(line);
    if (board) current.board = [current.board, board].filter(Boolean).join(" / ");

    const kind = actionKind(line);
    if (!kind) continue;

    const playerName = quotedName(line);
    if (playerName) {
      const key = cleanName(playerName, playerName).toLowerCase();
      players.set(key, {
        raw_name: playerName,
        display_name: cleanName(playerName, playerName),
      });
    }

    current.actions.push({
      hand_no: current.hand_no,
      hand_code: current.hand_code,
      log_order: index + 1,
      street,
      player_name: playerName,
      action: kind,
      amount: numberValue(line, 0),
      all_in: /all[-\s]?in/i.test(line),
      raw_entry: line,
    });
  }

  const completed = finalizeHand(current);
  if (completed) hands.push(completed);

  if (!hands.length) warnings.push("No hand boundaries were detected. Use PokerNow-style text with Hand # markers.");
  for (const hand of hands) {
    if (!hand.actions.length) warnings.push(`Hand #${hand.hand_no} has no parsed action rows.`);
    if (!hand.winner_name) warnings.push(`Hand #${hand.hand_no} has no detected collected-pot winner.`);
  }

  const notableHands = [...hands]
    .filter((hand) => hand.pot_collected || hand.showdown)
    .sort((left, right) => Number(right.pot_collected || 0) - Number(left.pot_collected || 0))
    .slice(0, Math.min(25, hands.length))
    .map((hand) => ({
      hand_no: hand.hand_no,
      hand_code: hand.hand_code,
      tags: [hand.showdown ? "Showdown" : "", hand.pot_collected ? "Detected Pot" : ""].filter(Boolean),
      winner_name: hand.winner_name,
      pot_collected: hand.pot_collected,
      winning_hand: hand.winning_hand,
      board: hand.board,
      involved_players: [...new Set(hand.actions.map((action) => action.player_name).filter(Boolean))],
      summary: `Hand #${hand.hand_no}: ${text(hand.winner_name, "Winner pending")} won ${hand.pot_collected || 0} chips.`,
      raw_result: hand.raw_result,
    }));

  return {
    hands,
    actions: hands.flatMap((hand) => hand.actions),
    players: [...players.values()],
    notableHands,
    warnings: [...new Set(warnings)],
    totals: {
      hands: hands.length,
      actions: hands.reduce((sum, hand) => sum + hand.actions.length, 0),
      players: players.size,
      notableHands: notableHands.length,
    },
  };
}

export function parseHandHistoryInput({ rawText = "", csvText = "" } = {}) {
  const sourceText = String(csvText || "").trim() ? csvToRawHistory(csvText) : rawText;
  const parsed = parseRawHandHistory(sourceText);
  return {
    ...parsed,
    inputMode: String(csvText || "").trim() ? "csv" : "raw_text",
  };
}
