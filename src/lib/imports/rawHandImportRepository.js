import { parseHandHistoryInput } from "@/lib/imports/rawHandHistoryParser";
import { nextSessionNumber, positiveSessionNumber } from "@/lib/imports/sessionNumber";
import { cleanName, getSessionByIdOrCode, safeQuery, supabase, text } from "@/lib/newsroom/data";

function slugFor(name = "") {
  return cleanName(name, "player")
    .toLowerCase()
    .replace(/@/g, " at ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || `player-${Date.now()}`;
}

function isoDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

async function getOrCreatePlayers(playerRows = []) {
  const existing = await safeQuery(supabase.from("players").select("*").limit(10000), []);
  const byRawName = new Map();
  const byCleanName = new Map();

  for (const player of existing || []) {
    if (player.pokernow_name) byRawName.set(String(player.pokernow_name).toLowerCase(), player);
    if (player.display_name) byCleanName.set(String(cleanName(player.display_name)).toLowerCase(), player);
  }

  const resolved = new Map();
  for (const imported of playerRows) {
    const rawKey = String(imported.raw_name || "").toLowerCase();
    const cleanKey = String(imported.display_name || "").toLowerCase();
    let player = byRawName.get(rawKey) || byCleanName.get(cleanKey);

    if (!player) {
      const insert = {
        display_name: imported.display_name,
        pokernow_name: imported.raw_name,
        slug: slugFor(imported.raw_name || imported.display_name),
      };
      const { data, error } = await supabase.from("players").insert(insert).select("*").single();
      if (error) throw new Error(`Could not create player ${imported.display_name}: ${error.message}`);
      player = data;
      byRawName.set(rawKey, player);
      byCleanName.set(cleanKey, player);
    }

    resolved.set(imported.raw_name, player);
  }

  return resolved;
}

async function resolveSessionNumber(metadata = {}, existing = null) {
  const explicit = positiveSessionNumber(metadata.sessionNumber);
  if (explicit !== null) return explicit;

  const existingNumber = positiveSessionNumber(existing?.session_number);
  if (existingNumber !== null) return existingNumber;

  const seasonCode = text(metadata.seasonCode, "S0");
  const { data, error } = await supabase
    .from("sessions")
    .select("session_number")
    .eq("season_code", seasonCode)
    .order("session_number", { ascending: false })
    .limit(1);
  if (error) throw new Error(`Could not allocate a session number: ${error.message}`);
  return nextSessionNumber(data || []);
}

async function upsertSession(metadata = {}, parsed) {
  const sessionCode = text(metadata.sessionCode, `IMPORT-${Date.now()}`);
  const existing = await getSessionByIdOrCode(sessionCode);
  const sessionNumber = await resolveSessionNumber(metadata, existing);
  if (existing) {
    const { data, error } = await supabase
      .from("sessions")
      .update({
        season_code: text(metadata.seasonCode, existing.season_code || "S0"),
        session_number: sessionNumber,
        played_at: isoDate(metadata.playedAt || existing.played_at),
        table_name: text(metadata.tableName, existing.table_name || "Imported Table"),
        format: text(metadata.format, existing.format || "Imported hand history"),
        status: "processed",
        raw_log_rows: Number(metadata.rawLogRows || 0) || null,
        hands_count: parsed.totals.hands,
        players_count: parsed.totals.players,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      season_code: text(metadata.seasonCode, "S0"),
      session_number: sessionNumber,
      session_code: sessionCode,
      played_at: isoDate(metadata.playedAt),
      table_name: text(metadata.tableName, "Imported Table"),
      format: text(metadata.format, "Imported hand history"),
      status: "processed",
      raw_log_rows: Number(metadata.rawLogRows || 0) || null,
      hands_count: parsed.totals.hands,
      players_count: parsed.totals.players,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function clearImportedRows(sessionId) {
  await supabase.from("actions").delete().eq("session_id", sessionId);
  await supabase.from("notable_hands").delete().eq("session_id", sessionId);
  await supabase.from("hands").delete().eq("session_id", sessionId);
}

function actionFlags(action) {
  return {
    all_in: Boolean(action.all_in),
    faced_raise: false,
    faced_3bet: false,
    is_open_raise: action.action === "raises",
    is_3bet: false,
    is_limp: action.action === "calls" && Number(action.amount || 0) > 0,
    is_call_vs_raise: action.action === "calls",
  };
}

async function insertHandsAndActions(session, parsed, playersByRawName) {
  const handInserts = parsed.hands.map((hand) => {
    const winner = playersByRawName.get(hand.winner_name);
    return {
      session_id: session.id,
      hand_no: hand.hand_no,
      hand_id: hand.hand_code,
      start_time: session.played_at,
      board: hand.board,
      winner_player_id: winner?.id || null,
      winner_name: hand.winner_name,
      pot_collected: hand.pot_collected || 0,
      winning_hand: hand.winning_hand || "",
      showdown: Boolean(hand.showdown),
      raw_result: hand.raw_result || "",
    };
  });

  const { data: hands, error: handError } = await supabase.from("hands").insert(handInserts).select("*");
  if (handError) throw new Error(`Could not insert hands: ${handError.message}`);

  const handByNo = new Map((hands || []).map((hand) => [Number(hand.hand_no), hand]));
  const actionInserts = parsed.actions.map((action) => {
    const player = playersByRawName.get(action.player_name);
    const storedHand = handByNo.get(Number(action.hand_no));
    return {
      session_id: session.id,
      hand_id: storedHand?.id || null,
      hand_no: action.hand_no,
      log_order: action.log_order,
      street: action.street,
      player_id: player?.id || null,
      player_name: action.player_name,
      position: "",
      seat_index: null,
      dealer_name: "",
      preflop_action_order: action.street === "preflop" ? action.log_order : null,
      action: action.action,
      amount: action.amount || 0,
      ...actionFlags(action),
      raw_entry: action.raw_entry,
    };
  });

  if (actionInserts.length) {
    const { error } = await supabase.from("actions").insert(actionInserts);
    if (error) throw new Error(`Could not insert actions: ${error.message}`);
  }

  return hands || [];
}

async function insertNotableHands(session, parsed) {
  const rows = parsed.notableHands.map((moment) => ({
    session_id: session.id,
    hand_no: moment.hand_no,
    hand_code: moment.hand_code,
    tags: moment.tags,
    winner_name: moment.winner_name,
    pot_collected: moment.pot_collected || 0,
    winning_hand: moment.winning_hand || "",
    board: moment.board || "",
    involved_players: moment.involved_players || [],
    summary: moment.summary,
    raw_result: moment.raw_result || "",
  }));

  if (!rows.length) return [];
  const { data, error } = await supabase.from("notable_hands").insert(rows).select("*");
  if (error) throw new Error(`Could not insert notable hands: ${error.message}`);
  return data || [];
}

async function upsertBasicPlayerStats(session, parsed, playersByRawName) {
  const byPlayer = new Map();
  for (const hand of parsed.hands) {
    const involved = [...new Set(hand.actions.map((action) => action.player_name).filter(Boolean))];
    for (const playerName of involved) {
      if (!byPlayer.has(playerName)) {
        byPlayer.set(playerName, {
          hands: 0,
          hands_won: 0,
          total_collected: 0,
          biggest_pot_won: 0,
          all_ins: 0,
          folds: 0,
        });
      }
      const stats = byPlayer.get(playerName);
      stats.hands += 1;
      stats.all_ins += hand.actions.filter((action) => action.player_name === playerName && action.all_in).length;
      stats.folds += hand.actions.filter((action) => action.player_name === playerName && action.action === "folds").length;
    }
    if (hand.winner_name && byPlayer.has(hand.winner_name)) {
      const stats = byPlayer.get(hand.winner_name);
      stats.hands_won += 1;
      stats.total_collected += Number(hand.pot_collected || 0);
      stats.biggest_pot_won = Math.max(stats.biggest_pot_won, Number(hand.pot_collected || 0));
    }
  }

  const rows = [...byPlayer.entries()].map(([playerName, stats]) => {
    const player = playersByRawName.get(playerName);
    return {
      session_id: session.id,
      player_id: player?.id || null,
      player_name: playerName,
      hands: stats.hands,
      hands_won: stats.hands_won,
      hand_win_pct: stats.hands ? Number(((stats.hands_won / stats.hands) * 100).toFixed(1)) : 0,
      total_collected: stats.total_collected,
      biggest_pot_won: stats.biggest_pot_won,
      all_ins: stats.all_ins,
      folds: stats.folds,
      fold_pct: stats.hands ? Number(((stats.folds / stats.hands) * 100).toFixed(1)) : 0,
      notable_hands: parsed.notableHands.filter((moment) => moment.involved_players?.includes(playerName)).length,
    };
  });

  if (!rows.length) return [];
  await supabase.from("player_session_stats").delete().eq("session_id", session.id);
  const { data, error } = await supabase.from("player_session_stats").insert(rows).select("*");
  if (error) throw new Error(`Could not insert player session stats: ${error.message}`);
  return data || [];
}

export function previewRawHandImport(input = {}) {
  const parsed = parseHandHistoryInput({ rawText: input.rawText || "", csvText: input.csvText || "" });
  return {
    metadata: {
      sessionCode: text(input.sessionCode),
      seasonCode: text(input.seasonCode, "S0"),
      tableName: text(input.tableName, "Imported Table"),
      playedAt: input.playedAt || "",
      format: text(input.format, "Imported hand history"),
    },
    ...parsed,
    hands: parsed.hands.slice(0, 12),
    actions: parsed.actions.slice(0, 30),
    notableHands: parsed.notableHands.slice(0, 12),
  };
}

export async function commitRawHandImport(input = {}) {
  const rawText = text(input.rawText);
  const csvText = text(input.csvText);
  if (!rawText.trim() && !csvText.trim()) throw new Error("Raw hand history or CSV upload is required.");
  const parsed = parseHandHistoryInput({ rawText, csvText });
  if (!parsed.hands.length) throw new Error("No hands were parsed from this import.");
  const existingSession = await getSessionByIdOrCode(text(input.sessionCode));
  if (existingSession && !input.replaceExisting) {
    throw new Error("A session with this code already exists. Enable replace existing rows to re-import it.");
  }
  const metadata = {
    ...input,
    rawLogRows: (csvText || rawText).split(/\r?\n/u).filter(Boolean).length,
  };

  const session = await upsertSession(metadata, parsed);
  if (input.replaceExisting) await clearImportedRows(session.id);

  const playersByRawName = await getOrCreatePlayers(parsed.players);
  const hands = await insertHandsAndActions(session, parsed, playersByRawName);
  const notableHands = await insertNotableHands(session, parsed);
  const playerStats = await upsertBasicPlayerStats(session, parsed, playersByRawName);

  return {
    session,
    totals: {
      ...parsed.totals,
      insertedHands: hands.length,
      insertedNotableHands: notableHands.length,
      insertedPlayerStats: playerStats.length,
    },
    warnings: parsed.warnings,
  };
}
