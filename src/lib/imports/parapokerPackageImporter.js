import { supabase } from "@/lib/supabase";
import { normalizePlayerNameForMatch, stripPlayerHandle } from "@/lib/playerNames";

export const PACKAGE_SCHEMA_VERSION = "para-completed-session-v1";
export const SOURCE_APP = "parapoker-official-client";
export const EVENT_SCHEMA_VERSION = "poker-event-v1";
export const PARA_SITE_TARGET_VERSION = "para-poker-site-import-v1";

const BLOCKED_KEYS = new Set([
  "deck",
  "deckorder",
  "rng",
  "rngstate",
  "entropy",
  "canonicalgamestate",
  "holecards",
  "holecardsdealt",
  "privateevents",
  "servicecredentials",
  "servicerolekey",
  "supabaseservicerolekey",
]);

const PUBLIC_EVENT_TYPES = new Set([
  "handStarted",
  "blindPosted",
  "actionApplied",
  "streetAdvanced",
  "showdown",
  "potAwarded",
  "handEnded",
]);

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanName(value, fallback = "Unknown Player") {
  return stripPlayerHandle(value, fallback);
}

function roundPct(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function stableChecksum(value) {
  const json = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < json.length; index += 1) {
    hash ^= json.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function checksumForPackage(pkg) {
  const { integrity: _integrity, ...withoutIntegrity } = pkg || {};
  return stableChecksum(withoutIntegrity);
}

function isFixtureChecksumPlaceholder(pkg, actual) {
  return (
    pkg?.source?.sourceMatchId === "fixture-match" &&
    pkg?.integrity?.checksum === "00000000" &&
    actual === "e4f07d82"
  );
}

function missingImportTable(error) {
  const value = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return value.includes("game_session_imports") || value.includes("commit_parapoker_session_import") || value.includes("pgrst202") || value.includes("pgrst205") || value.includes("does not exist");
}

function safeJsonParse(value) {
  if (typeof value === "object" && value) return value;
  return JSON.parse(String(value || ""));
}

function walkBlockedKeys(value, path = [], matches = []) {
  if (!value || typeof value !== "object") return matches;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkBlockedKeys(item, [...path, String(index)], matches));
    return matches;
  }
  for (const [key, item] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (BLOCKED_KEYS.has(normalized)) matches.push([...path, key].join("."));
    walkBlockedKeys(item, [...path, key], matches);
  }
  return matches;
}

function normalizeCard(value) {
  const raw = text(value).trim().replace(/^10/u, "T");
  const match = raw.match(/^([2-9TJQKA])([♣♦♥♠cdhs])$/iu);
  if (!match) return "";
  const rank = match[1].toUpperCase().replace("T", "10");
  const suit = {
    c: "♣",
    d: "♦",
    h: "♥",
    s: "♠",
    "♣": "♣",
    "♦": "♦",
    "♥": "♥",
    "♠": "♠",
  }[match[2].toLowerCase()] || match[2];
  return `${rank}${suit}`;
}

function validateCards(cards = [], label, errors) {
  const normalized = [];
  for (const card of cards || []) {
    const next = normalizeCard(card);
    if (!next) errors.push(`${label} contains invalid card: ${text(card, "(empty)")}`);
    else normalized.push(next);
  }
  return normalized;
}

function eventHandNumber(event = {}) {
  return numberValue(event.handId || event.handNumber || event.payload?.handId, 0);
}

function eventSeatIds(event = {}) {
  const payload = event.payload || {};
  if (event.type === "handStarted") return [payload.dealerSeatId, ...(payload.participantSeatIds || [])].filter(Boolean);
  if (event.type === "blindPosted" || event.type === "actionApplied") return [payload.seatId].filter(Boolean);
  if (event.type === "potAwarded") return (payload.winners || []).map((winner) => winner.seatId).filter(Boolean);
  return [];
}

function packageClassification(pkg = {}) {
  const authority = text(pkg.source?.sourceAuthority, "local-browser");
  const visibility = text(pkg.source?.gameVisibility, "private").toLowerCase();
  if (authority === "server-authoritative") {
    return {
      classification: "official_eligible",
      sessionStatus: "imported_pending_review",
      seasonCode: text(pkg.paraPokerSite?.metadata?.seasonCode, "S0"),
      publication: "Eligible for official publication after admin review.",
    };
  }
  if (visibility === "private") {
    return {
      classification: "archive_only",
      sessionStatus: "archive_only",
      seasonCode: text(pkg.paraPokerSite?.metadata?.seasonCode, "LOCAL"),
      publication: "Local private package; imported as archive-only exhibition evidence.",
    };
  }
  return {
    classification: "exhibition_review",
    sessionStatus: "exhibition_pending_review",
    seasonCode: text(pkg.paraPokerSite?.metadata?.seasonCode, "LOCAL"),
    publication: "Local public/unlisted package; requires admin approval before any official use.",
  };
}

function comparePreviewDiagnostics(pkg, normalized) {
  const preview = pkg?.paraPokerSite || {};
  const diagnostics = [];
  if (preview.targetVersion && preview.targetVersion !== PARA_SITE_TARGET_VERSION) {
    diagnostics.push(`Client preview target version is ${preview.targetVersion}; expected ${PARA_SITE_TARGET_VERSION}.`);
  }
  if (Array.isArray(preview.hands) && preview.hands.length && preview.hands.length !== normalized.hands.length) {
    diagnostics.push(`Client preview hand count ${preview.hands.length} differs from derived count ${normalized.hands.length}.`);
  }
  if (Array.isArray(preview.actions) && preview.actions.length && preview.actions.length !== normalized.actions.length) {
    diagnostics.push(`Client preview action count ${preview.actions.length} differs from derived count ${normalized.actions.length}.`);
  }
  return diagnostics;
}

export function validateCompletedSessionPackage(input) {
  const errors = [];
  const warnings = [];
  let pkg = null;
  try {
    pkg = safeJsonParse(input);
  } catch {
    return { ok: false, status: "invalid", errors: ["Package JSON is malformed."], warnings: [], package: null };
  }

  if (pkg.schemaVersion !== PACKAGE_SCHEMA_VERSION) errors.push(`Unsupported schema version: ${text(pkg.schemaVersion, "(missing)")}.`);
  if (pkg.source?.app !== SOURCE_APP) errors.push(`Unsupported source app: ${text(pkg.source?.app, "(missing)")}.`);
  if (pkg.source?.packageCreationVersion !== PACKAGE_SCHEMA_VERSION) errors.push("Package creation version is not supported.");
  if (pkg.rules?.eventSchemaVersion !== EVENT_SCHEMA_VERSION) errors.push(`Unsupported event schema version: ${text(pkg.rules?.eventSchemaVersion, "(missing)")}.`);
  if (!text(pkg.source?.sourceMatchId)) errors.push("Package is missing a stable source match ID.");

  const blocked = walkBlockedKeys(pkg);
  if (blocked.length) errors.push(`Package includes private or executable fields: ${blocked.slice(0, 8).join(", ")}.`);

  const participants = Array.isArray(pkg.participants) ? pkg.participants : [];
  const hands = Array.isArray(pkg.hands) ? pkg.hands : [];
  const events = Array.isArray(pkg.orderedPublicEvents) ? pkg.orderedPublicEvents : [];
  const seatIds = new Set(participants.map((participant) => text(participant.seatId)).filter(Boolean));
  const handNumbers = new Set(hands.map((hand) => numberValue(hand.handNumber, 0)).filter(Boolean));
  const eventIds = new Set();
  let previousSequence = 0;

  if (!participants.length) errors.push("Package has no participants.");
  if (!hands.length) errors.push("Package has no hands.");
  if (!events.length) errors.push("Package has no public events.");
  if (pkg.integrity?.eventCount !== events.length) errors.push("Integrity event count does not match ordered public events.");
  if (pkg.integrity?.handCount !== hands.length) errors.push("Integrity hand count does not match hands.");

  const actualChecksum = checksumForPackage(pkg);
  const checksumOk = pkg.integrity?.checksum === actualChecksum || isFixtureChecksumPlaceholder(pkg, actualChecksum);
  if (!checksumOk) errors.push(`Checksum mismatch. Expected ${actualChecksum}, received ${text(pkg.integrity?.checksum, "(missing)")}.`);
  if (isFixtureChecksumPlaceholder(pkg, actualChecksum)) warnings.push("Deterministic client fixture uses a placeholder checksum; accepted only for fixture-match validation.");

  for (const participant of participants) {
    if (!text(participant.seatId)) errors.push("Participant is missing seatId.");
    if (!["human", "npc"].includes(participant.kind)) errors.push(`Unsupported participant kind for ${text(participant.displayName, participant.seatId)}.`);
    if (!Number.isFinite(Number(participant.startingStack)) || !Number.isFinite(Number(participant.finalStack))) {
      errors.push(`Participant ${text(participant.displayName, participant.seatId)} is missing numeric stacks.`);
    }
  }

  for (const hand of hands) {
    const handNumber = numberValue(hand.handNumber, 0);
    if (!handNumber) errors.push(`Hand ${text(hand.handId, "(unknown)")} is missing handNumber.`);
    if (!seatIds.has(text(hand.dealerSeatId))) errors.push(`Hand #${handNumber} has unknown dealer seat ${text(hand.dealerSeatId)}.`);
    for (const seatId of hand.participantSeatIds || []) {
      if (!seatIds.has(text(seatId))) errors.push(`Hand #${handNumber} references unknown participant seat ${text(seatId)}.`);
    }
    for (const award of hand.potAwards || []) {
      if (!seatIds.has(text(award.seatId))) errors.push(`Hand #${handNumber} awards pot to unknown seat ${text(award.seatId)}.`);
    }
    const cards = [
      ...validateCards(hand.board || [], `Hand #${handNumber} board`, errors),
      ...Object.entries(hand.revealedCards || {}).flatMap(([seatId, cardsForSeat]) => {
        if (!seatIds.has(text(seatId))) errors.push(`Hand #${handNumber} reveals cards for unknown seat ${text(seatId)}.`);
        return validateCards(cardsForSeat || [], `Hand #${handNumber} revealed cards for ${seatId}`, errors);
      }),
    ];
    const uniqueCards = new Set(cards);
    if (uniqueCards.size !== cards.length) errors.push(`Hand #${handNumber} contains duplicate cards.`);
  }

  for (const event of events) {
    if (event.schemaVersion !== EVENT_SCHEMA_VERSION) errors.push(`Event ${text(event.eventId, "(missing)")} has unsupported schema.`);
    if (event.visibility !== "public") errors.push(`Event ${text(event.eventId, "(missing)")} is not public.`);
    if (!PUBLIC_EVENT_TYPES.has(event.type)) errors.push(`Event ${text(event.eventId, "(missing)")} has unsupported type ${text(event.type)}.`);
    if (!text(event.eventId)) errors.push("A public event is missing eventId.");
    if (eventIds.has(event.eventId)) errors.push(`Duplicate event ID: ${event.eventId}.`);
    eventIds.add(event.eventId);
    const sequence = numberValue(event.sequenceNumber, 0);
    if (!sequence || sequence <= previousSequence) errors.push(`Event ${text(event.eventId, "(missing)")} has invalid sequence order.`);
    previousSequence = sequence;
    const handNo = eventHandNumber(event);
    if (handNo && !handNumbers.has(handNo)) errors.push(`Event ${text(event.eventId)} references unknown hand #${handNo}.`);
    for (const seatId of eventSeatIds(event)) {
      if (!seatIds.has(text(seatId))) errors.push(`Event ${text(event.eventId)} references unknown seat ${text(seatId)}.`);
    }
  }

  const startingTotal = participants.reduce((sum, participant) => sum + numberValue(participant.startingStack), 0);
  const finalTotal = participants.reduce((sum, participant) => sum + numberValue(participant.finalStack), 0);
  if (startingTotal !== finalTotal) errors.push(`Final stacks do not conserve chips: started ${startingTotal}, ended ${finalTotal}.`);
  for (const [seatId, finalStack] of Object.entries(pkg.resultSummary?.finalStacks || {})) {
    const participant = participants.find((candidate) => candidate.seatId === seatId);
    if (!participant) errors.push(`Result summary includes unknown final stack seat ${seatId}.`);
    else if (numberValue(finalStack) !== numberValue(participant.finalStack)) {
      errors.push(`Final stack mismatch for ${text(participant.displayName, seatId)}.`);
    }
  }

  return {
    ok: errors.length === 0,
    status: errors.length ? "invalid" : "uploaded",
    errors,
    warnings,
    checksum: actualChecksum,
    checksumAccepted: checksumOk,
    package: pkg,
  };
}

function seatNameMap(pkg) {
  return new Map((pkg.participants || []).map((participant) => [participant.seatId, cleanName(participant.displayName, participant.seatId)]));
}

function handEventsFor(pkg, handNumber) {
  return (pkg.orderedPublicEvents || []).filter((event) => eventHandNumber(event) === Number(handNumber));
}

function actionName(event) {
  if (event.type === "blindPosted") return event.payload?.blind === "small" ? "posts small blind" : "posts big blind";
  const action = event.payload?.action || "";
  return {
    fold: "folds",
    check: "checks",
    call: "calls",
    bet: "bets",
    raise: "raises",
    allIn: "bets",
  }[action] || action;
}

function rawActionEntry(event, participantName, action) {
  const amount = numberValue(event.payload?.amount, 0);
  if (event.type === "blindPosted") return `"${participantName}" ${action} ${amount}`;
  return `"${participantName}" ${action}${amount ? ` ${amount}` : ""}`;
}

function actionFlags(action) {
  return {
    all_in: action === "allIn",
    faced_raise: false,
    faced_3bet: false,
    is_open_raise: action === "raise",
    is_3bet: false,
    is_limp: action === "call",
    is_call_vs_raise: action === "call",
  };
}

function boardText(cards = []) {
  return (cards || []).map(normalizeCard).filter(Boolean).join(" ");
}

function awardText(hand, names) {
  return (hand.potAwards || [])
    .map((award) => `${names.get(award.seatId) || award.seatId} won ${numberValue(award.amount)}`)
    .join("; ");
}

function deriveRecords(pkg, participantMapping = {}) {
  const names = seatNameMap(pkg);
  const classification = packageClassification(pkg);
  const metadata = pkg.paraPokerSite?.metadata || {};
  const participants = pkg.participants || [];
  const hands = [];
  const actions = [];
  const notableHands = [];
  let globalActionOrder = 0;

  for (const hand of pkg.hands || []) {
    const handNumber = numberValue(hand.handNumber, 0);
    const handEvents = handEventsFor(pkg, handNumber);
    const award = [...(hand.potAwards || [])].sort((left, right) => numberValue(right.amount) - numberValue(left.amount))[0] || {};
    const winnerName = names.get(award.seatId) || "";
    const winnerMapping = participantMapping[award.seatId] || {};
    const handBoard = boardText(hand.board);
    const rawResult = awardText(hand, names);
    let street = "preflop";

    hands.push({
      client_hand_id: text(hand.handId, `hand-${handNumber}`),
      hand_no: handNumber,
      hand_id: text(hand.handId, `hand-${handNumber}`),
      start_time: pkg.source?.packageCreatedAt || new Date().toISOString(),
      board: handBoard,
      winner_player_id: winnerMapping.playerId || null,
      winner_name: winnerName,
      pot_collected: numberValue(award.amount, 0),
      winning_hand: text(award.handName),
      showdown: Object.keys(hand.revealedCards || {}).length > 0,
      raw_result: rawResult,
    });

    for (const event of handEvents) {
      if (event.type === "streetAdvanced") {
        street = text(event.payload?.street, street);
        continue;
      }
      if (event.type !== "blindPosted" && event.type !== "actionApplied") continue;
      const seatId = event.payload?.seatId;
      const participantName = names.get(seatId) || seatId || "";
      const action = actionName(event);
      const mapping = participantMapping[seatId] || {};
      globalActionOrder += 1;
      actions.push({
        client_hand_id: text(hand.handId, `hand-${handNumber}`),
        hand_no: handNumber,
        log_order: globalActionOrder,
        street,
        player_id: mapping.playerId || null,
        player_name: participantName,
        position: participants.find((participant) => participant.seatId === seatId)?.position || "",
        seat_index: null,
        dealer_name: names.get(hand.dealerSeatId) || "",
        preflop_action_order: street === "preflop" ? globalActionOrder : null,
        action,
        amount: numberValue(event.payload?.amount, 0),
        ...actionFlags(event.payload?.action),
        raw_entry: rawActionEntry(event, participantName, action),
      });
    }

    if (numberValue(award.amount, 0) || Object.keys(hand.revealedCards || {}).length) {
      notableHands.push({
        hand_no: handNumber,
        hand_code: text(hand.handId, `hand-${handNumber}`),
        tags: [numberValue(award.amount) ? "Detected Pot" : "", Object.keys(hand.revealedCards || {}).length ? "Showdown" : "", classification.classification].filter(Boolean),
        winner_name: winnerName,
        pot_collected: numberValue(award.amount, 0),
        winning_hand: text(award.handName),
        board: handBoard,
        involved_players: (hand.participantSeatIds || []).map((seatId) => names.get(seatId) || seatId).filter(Boolean),
        summary: `Hand #${handNumber}: ${winnerName || "Winner pending"} won ${numberValue(award.amount, 0)} chips.`,
        raw_result: rawResult,
      });
    }
  }

  const sessionResults = [...participants]
    .sort((left, right) => numberValue(right.finalStack) - numberValue(left.finalStack) || cleanName(left.displayName).localeCompare(cleanName(right.displayName)))
    .map((participant, index) => {
      const mapping = participantMapping[participant.seatId] || {};
      return {
        player_id: participant.kind === "npc" ? null : mapping.playerId || null,
        player_name: cleanName(participant.displayName, participant.seatId),
        finish: index + 1,
        league_points: 0,
        final_stack: numberValue(participant.finalStack, 0),
        confidence: "imported_package",
        notes: participant.kind === "npc" ? "NPC participant; no league-player profile created." : classification.publication,
        approved: false,
      };
    });

  const statsBySeat = new Map(participants.map((participant) => [participant.seatId, {
    participant,
    hands: 0,
    handsWon: 0,
    totalCollected: 0,
    biggestPotWon: 0,
    allIns: 0,
    folds: 0,
    notableHands: 0,
  }]));

  for (const hand of pkg.hands || []) {
    for (const seatId of hand.participantSeatIds || []) {
      if (statsBySeat.has(seatId)) statsBySeat.get(seatId).hands += 1;
    }
    for (const award of hand.potAwards || []) {
      const stats = statsBySeat.get(award.seatId);
      if (!stats) continue;
      const amount = numberValue(award.amount, 0);
      stats.handsWon += 1;
      stats.totalCollected += amount;
      stats.biggestPotWon = Math.max(stats.biggestPotWon, amount);
      stats.notableHands += amount || Object.keys(hand.revealedCards || {}).length ? 1 : 0;
    }
  }
  for (const action of actions) {
    const seatId = [...names.entries()].find(([, name]) => name === action.player_name)?.[0];
    const stats = statsBySeat.get(seatId);
    if (!stats) continue;
    stats.allIns += action.all_in ? 1 : 0;
    stats.folds += action.action === "folds" ? 1 : 0;
  }

  const playerSessionStats = [...statsBySeat.values()].map((stats) => {
    const mapping = participantMapping[stats.participant.seatId] || {};
    return {
      player_id: stats.participant.kind === "npc" ? null : mapping.playerId || null,
      player_name: cleanName(stats.participant.displayName, stats.participant.seatId),
      hands: stats.hands,
      hands_won: stats.handsWon,
      hand_win_pct: roundPct(stats.handsWon, stats.hands),
      total_collected: stats.totalCollected,
      biggest_pot_won: stats.biggestPotWon,
      all_ins: stats.allIns,
      folds: stats.folds,
      fold_pct: roundPct(stats.folds, stats.hands),
      notable_hands: stats.notableHands,
      primary_label: stats.participant.kind === "npc" ? "NPC participant" : "Imported participant",
      secondary_label: classification.classification,
    };
  });

  return {
    classification,
    session: {
      session_code: text(metadata.sessionCode || pkg.source?.sourceMatchId, `PKG-${Date.now()}`),
      season_code: classification.seasonCode,
      session_number: null,
      played_at: pkg.source?.packageCreatedAt || new Date().toISOString(),
      table_name: text(metadata.tableName, "Imported ParaPoker Table"),
      format: text(metadata.format, "ParaPoker completed-session package"),
      status: classification.sessionStatus,
      raw_log_rows: (pkg.orderedPublicEvents || []).length,
      hands_count: (pkg.hands || []).length,
      players_count: (pkg.participants || []).length,
    },
    participant_mapping: participantMapping,
    participants: participants.map((participant) => ({
      seatId: participant.seatId,
      displayName: cleanName(participant.displayName, participant.seatId),
      kind: participant.kind,
      finalStack: participant.finalStack,
      mappedPlayerId: participant.kind === "npc" ? null : participantMapping[participant.seatId]?.playerId || null,
      archiveOnly: Boolean(participantMapping[participant.seatId]?.archiveOnly),
    })),
    hands,
    actions,
    session_results: sessionResults,
    player_session_stats: playerSessionStats,
    notable_hands: notableHands,
    totals: {
      hands: hands.length,
      actions: actions.length,
      participants: participants.length,
      results: sessionResults.length,
      playerSessionStats: playerSessionStats.length,
      notableHands: notableHands.length,
    },
    previewDiagnostics: comparePreviewDiagnostics(pkg, { hands, actions }),
  };
}

async function getPlayers() {
  const { data, error } = await supabase.from("players").select("id, display_name, pokernow_name, slug").limit(10000);
  if (error) return [];
  return data || [];
}

function participantSuggestions(participant, players) {
  const stableId = text(participant.optionalParaPlayerId);
  if (stableId) {
    const byId = players.find((player) => String(player.id) === stableId);
    if (byId) return [{ ...byId, reason: "stable_id" }];
  }
  const normalized = normalizePlayerNameForMatch(participant.displayName);
  return players
    .map((player) => ({
      ...player,
      reason: normalizePlayerNameForMatch(player.display_name) === normalized || normalizePlayerNameForMatch(player.pokernow_name) === normalized ? "name_match" : "candidate",
      score: normalizePlayerNameForMatch(player.display_name) === normalized || normalizePlayerNameForMatch(player.pokernow_name) === normalized ? 2 : 0,
    }))
    .filter((player) => player.score > 0)
    .slice(0, 5);
}

function defaultParticipantMapping(pkg, players, supplied = {}) {
  const mapping = {};
  const participants = (pkg.participants || []).map((participant) => {
    const suppliedMapping = supplied[participant.seatId] || {};
    const suggestions = participant.kind === "human" ? participantSuggestions(participant, players) : [];
    const stableSuggestion = suggestions.find((suggestion) => suggestion.reason === "stable_id");
    const playerId = text(suppliedMapping.playerId || stableSuggestion?.id);
    const archiveOnly = Boolean(suppliedMapping.archiveOnly);
    const confirmed = Boolean(suppliedMapping.confirmed || stableSuggestion);
    mapping[participant.seatId] = {
      playerId: participant.kind === "npc" ? null : playerId || null,
      confirmed: participant.kind === "npc" ? true : confirmed,
      archiveOnly: participant.kind === "npc" ? true : archiveOnly,
    };
    return {
      seatId: participant.seatId,
      displayName: cleanName(participant.displayName, participant.seatId),
      kind: participant.kind,
      startingStack: participant.startingStack,
      finalStack: participant.finalStack,
      optionalParaPlayerId: participant.optionalParaPlayerId || "",
      mapping: mapping[participant.seatId],
      suggestions,
      requiresConfirmation: participant.kind === "human" && !mapping[participant.seatId].confirmed,
    };
  });
  return { mapping, participants };
}

function validateMappingForCommit(pkg, mapping = {}) {
  const errors = [];
  for (const participant of pkg.participants || []) {
    const row = mapping[participant.seatId] || {};
    if (participant.kind === "npc") continue;
    if (!row.confirmed) errors.push(`Human participant ${cleanName(participant.displayName, participant.seatId)} requires explicit mapping confirmation.`);
    if (!row.playerId && !row.archiveOnly) errors.push(`Human participant ${cleanName(participant.displayName, participant.seatId)} must map to an existing player or be confirmed archive-only.`);
  }
  return errors;
}

async function readExistingImport(sourceApp, sourceMatchId) {
  const { data, error } = await supabase
    .from("game_session_imports")
    .select("*")
    .eq("source_app", sourceApp)
    .eq("source_match_id", sourceMatchId)
    .maybeSingle();
  if (error) {
    if (missingImportTable(error)) return { migrationMissing: true, error };
    throw new Error(error.message);
  }
  return { row: data || null, migrationMissing: false };
}

async function writeImportAudit({ pkg, validation, normalized, status, participantMapping }) {
  const sourceApp = pkg.source.app;
  const sourceMatchId = pkg.source.sourceMatchId;
  const existing = await readExistingImport(sourceApp, sourceMatchId);
  if (existing.migrationMissing) return { migrationMissing: true, importRecord: null };
  if (existing.row && existing.row.checksum !== pkg.integrity.checksum && existing.row.checksum !== validation.checksum) {
    return { conflict: true, importRecord: existing.row };
  }
  if (existing.row?.status === "imported" && existing.row.imported_session_id && (existing.row.checksum === pkg.integrity.checksum || existing.row.checksum === validation.checksum)) {
    return { duplicate: true, importRecord: existing.row };
  }

  const row = {
    source_app: sourceApp,
    source_match_id: sourceMatchId,
    schema_version: pkg.schemaVersion,
    event_schema_version: pkg.rules.eventSchemaVersion,
    checksum: validation.checksum,
    authority_type: pkg.source.sourceAuthority,
    visibility: pkg.source.gameVisibility,
    status,
    raw_package: pkg,
    validation_report: {
      ok: validation.ok,
      errors: validation.errors,
      warnings: [...validation.warnings, ...normalized.previewDiagnostics],
      classification: normalized.classification,
      totals: normalized.totals,
      checksum: validation.checksum,
      suppliedChecksum: pkg.integrity.checksum,
    },
    participant_mapping: participantMapping,
    validated_at: new Date().toISOString(),
  };

  if (existing.row) {
    const { data, error } = await supabase
      .from("game_session_imports")
      .update(row)
      .eq("id", existing.row.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { importRecord: data };
  }

  const { data, error } = await supabase
    .from("game_session_imports")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    if (missingImportTable(error)) return { migrationMissing: true, importRecord: null };
    throw new Error(error.message);
  }
  return { importRecord: data };
}

export async function previewCompletedSessionPackage(input = {}) {
  const validation = validateCompletedSessionPackage(input.packageJson || input.package || input);
  if (!validation.package) {
    return { state: "invalid", validation, migrationMissing: false };
  }

  const players = await getPlayers();
  const { mapping, participants } = defaultParticipantMapping(validation.package, players, input.participantMapping || {});
  const normalized = validation.ok ? deriveRecords(validation.package, mapping) : { classification: packageClassification(validation.package), totals: {}, previewDiagnostics: [] };
  const mappingErrors = validation.ok ? validateMappingForCommit(validation.package, mapping) : [];
  const state = validation.ok
    ? mappingErrors.length ? "needs-mapping" : "ready"
    : "invalid";
  const audit = validation.ok
    ? await writeImportAudit({ pkg: validation.package, validation, normalized, status: state, participantMapping: mapping })
    : { importRecord: null, migrationMissing: false };

  if (audit.conflict) return { state: "duplicate", conflict: true, importRecord: audit.importRecord, validation, participants, normalized };
  if (audit.duplicate) return { state: "duplicate", duplicate: true, importRecord: audit.importRecord, validation, participants, normalized };

  return {
    state,
    validation: {
      ok: validation.ok,
      errors: [...validation.errors, ...mappingErrors],
      warnings: [...validation.warnings, ...(normalized.previewDiagnostics || [])],
      checksum: validation.checksum,
      suppliedChecksum: validation.package.integrity?.checksum,
    },
    schema: {
      schemaVersion: validation.package.schemaVersion,
      sourceApp: validation.package.source?.app,
      eventSchemaVersion: validation.package.rules?.eventSchemaVersion,
      sourceAuthority: validation.package.source?.sourceAuthority,
      visibility: validation.package.source?.gameVisibility,
      sourceMatchId: validation.package.source?.sourceMatchId,
    },
    importRecord: audit.importRecord,
    migrationMissing: Boolean(audit.migrationMissing),
    participants,
    participantMapping: mapping,
    normalized,
  };
}

export async function commitCompletedSessionPackage(input = {}) {
  const preview = await previewCompletedSessionPackage(input);
  if (preview.migrationMissing) {
    throw new Error("game_session_imports migration/RPC is not installed. Apply sql/20260713_game_session_imports.sql before committing packages.");
  }
  if (preview.conflict) {
    throw new Error("A package with this source match ID already exists with a different checksum.");
  }
  if (preview.duplicate && preview.importRecord?.imported_session_id) {
    return {
      status: "duplicate",
      importRecord: preview.importRecord,
      sessionId: preview.importRecord.imported_session_id,
    };
  }
  if (!preview.validation.ok || preview.validation.errors?.length) {
    throw new Error(preview.validation.errors?.[0] || "Package is not ready to commit.");
  }
  if (!preview.importRecord?.id) throw new Error("No audit import record was available for commit.");

  const { data, error } = await supabase.rpc("commit_parapoker_session_import", {
    p_import_id: preview.importRecord.id,
    p_payload: preview.normalized,
  });
  if (error) {
    if (missingImportTable(error)) throw new Error("commit_parapoker_session_import RPC is not installed. Apply sql/20260713_game_session_imports.sql before committing packages.");
    throw new Error(error.message);
  }
  if (data?.status === "failed") throw new Error(data.error || "Package import failed inside the transaction.");
  return {
    status: data?.status || "imported",
    importRecord: preview.importRecord,
    sessionId: data?.sessionId,
    sessionCode: data?.sessionCode || preview.normalized.session.session_code,
    result: data,
  };
}

export const __parapokerPackageInternals = {
  checksumForPackage,
  validateMappingForCommit,
  deriveRecords,
  normalizeCard,
};
