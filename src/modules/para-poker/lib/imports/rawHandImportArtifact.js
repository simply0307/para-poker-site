import { createHash } from "node:crypto";
import { parseHandHistoryInput, RAW_HAND_PARSER_VERSION } from "./rawHandHistoryParser.js";
import { derivePlayerSessionStatsFromRows } from "../stats/calculators.js";

export const RAW_HAND_MANIFEST_VERSION = "raw-hand-manifest-v1";
export const RAW_HAND_VALIDATION_VERSION = "raw-hand-validation-v1";
export const RAW_HAND_PREVIEW_VERSION = "raw-hand-preview-v1";
export const MAX_RAW_HAND_SOURCE_BYTES = 10 * 1024 * 1024;

function stringValue(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function normalizedText(value, fallback = "") {
  return stringValue(value, fallback).trim();
}

function finiteNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalValue(value[key])])
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha256Utf8(value) {
  return sha256Bytes(Buffer.from(String(value), "utf8"));
}

export function previewChecksumInput({
  sourceChecksum,
  metadataChecksum,
  parserVersion,
  manifestChecksum,
  validationReportChecksum,
  targetSessionId = null,
  expectedCurrentEvidenceRevisionId = null,
}) {
  return [
    RAW_HAND_PREVIEW_VERSION,
    sourceChecksum,
    metadataChecksum,
    parserVersion,
    manifestChecksum,
    validationReportChecksum,
    `${targetSessionId || ""}:${expectedCurrentEvidenceRevisionId || ""}`,
  ].join("\n");
}

export function computePreviewChecksum(input) {
  return sha256Utf8(previewChecksumInput(input));
}

function strictDecode(sourceBytes) {
  return new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes);
}

function normalizedMetadata(input = {}) {
  const errors = [];
  const sessionCode = normalizedText(input.sessionCode);
  const seasonCode = normalizedText(input.seasonCode, "S0");
  const tableName = normalizedText(input.tableName, "Imported Table");
  const format = normalizedText(input.format, "Imported hand history");
  const sessionNumber = input.sessionNumber === null || input.sessionNumber === undefined || input.sessionNumber === ""
    ? null
    : Number(input.sessionNumber);
  const playedDate = new Date(input.playedAt || "");
  const playedAt = Number.isNaN(playedDate.getTime()) ? null : playedDate.toISOString();
  const sourceKind = input.sourceKind === "pasted_text" ? "pasted_text" : "csv_file";
  const inputMode = input.inputMode === "raw_text" ? "raw_text" : "csv";

  if (!sessionCode) errors.push("A session code is required.");
  if (!seasonCode) errors.push("A season code is required.");
  if (!playedAt) errors.push("A valid played-at date is required.");
  if (sessionNumber !== null && (!Number.isInteger(sessionNumber) || sessionNumber <= 0)) {
    errors.push("Session number must be a positive integer when provided.");
  }
  if (sourceKind === "csv_file" && inputMode !== "csv") {
    errors.push("Uploaded raw-hand files must use the CSV parser mode.");
  }

  return {
    metadata: {
      schemaVersion: RAW_HAND_PREVIEW_VERSION,
      sessionCode,
      seasonCode,
      sessionNumber: Number.isInteger(sessionNumber) && sessionNumber > 0 ? sessionNumber : null,
      tableName,
      playedAt,
      format,
      replaceExisting: Boolean(input.replaceExisting),
      sourceKind,
      inputMode,
    },
    errors,
  };
}

function actionFlags(action = {}) {
  const kind = normalizedText(action.action).toLowerCase();
  return {
    facedRaise: false,
    faced3bet: false,
    isOpenRaise: kind === "raises",
    is3bet: false,
    isLimp: kind === "calls" && Number(action.amount || 0) > 0,
    isCallVsRaise: kind === "calls",
  };
}

function handClientId(hand = {}) {
  return `hand:${Number(hand.hand_no || 0)}:${normalizedText(hand.hand_code, `hand-${Number(hand.hand_no || 0)}`)}`;
}

function manifestHands(parsed = {}) {
  return (parsed.hands || []).map((hand) => ({
    clientHandId: handClientId(hand),
    handNo: Number(hand.hand_no || 0),
    handCode: normalizedText(hand.hand_code, `hand-${Number(hand.hand_no || 0)}`),
    board: normalizedText(hand.board),
    winnerName: normalizedText(hand.winner_name),
    potCollected: finiteNumber(hand.pot_collected, 0),
    potBb: finiteNumber(hand.pot_bb),
    bigBlind: finiteNumber(hand.big_blind),
    smallBlind: finiteNumber(hand.small_blind),
    winningHand: normalizedText(hand.winning_hand),
    showdown: Boolean(hand.showdown),
    rawResult: normalizedText(hand.raw_result),
  }));
}

function manifestActions(parsed = {}, hands = []) {
  const clientIdByKey = new Map(hands.map((hand) => [`${hand.handNo}:${hand.handCode}`, hand.clientHandId]));
  const clientIdByNumber = new Map(hands.map((hand) => [hand.handNo, hand.clientHandId]));
  return (parsed.actions || []).map((action) => ({
    clientHandId: clientIdByKey.get(`${Number(action.hand_no || 0)}:${normalizedText(action.hand_code)}`)
      || clientIdByNumber.get(Number(action.hand_no || 0))
      || "",
    handNo: Number(action.hand_no || 0),
    logOrder: Number(action.log_order || 0),
    street: normalizedText(action.street, "action"),
    playerName: normalizedText(action.player_name),
    position: "",
    seatIndex: null,
    dealerName: "",
    preflopActionOrder: normalizedText(action.street, "preflop") === "preflop" ? Number(action.log_order || 0) : null,
    action: normalizedText(action.action),
    amount: finiteNumber(action.amount, 0),
    allIn: Boolean(action.all_in),
    ...actionFlags(action),
    rawEntry: normalizedText(action.raw_entry),
  }));
}

function manifestNotableHands(parsed = {}) {
  return (parsed.notableHands || []).map((row) => ({
    handNo: Number(row.hand_no || 0),
    handCode: normalizedText(row.hand_code),
    tags: (row.tags || []).map((tag) => normalizedText(tag)).filter(Boolean),
    winnerName: normalizedText(row.winner_name),
    potCollected: finiteNumber(row.pot_collected, 0),
    potBb: finiteNumber(row.pot_bb),
    bigBlind: finiteNumber(row.big_blind),
    smallBlind: finiteNumber(row.small_blind),
    winningHand: normalizedText(row.winning_hand),
    board: normalizedText(row.board),
    involvedPlayers: (row.involved_players || []).map((name) => normalizedText(name)).filter(Boolean),
    summary: normalizedText(row.summary),
    rawResult: normalizedText(row.raw_result),
  }));
}

function manifestStats(hands, actions, notableHands) {
  const calculatorHands = hands.map((hand) => ({
    hand_no: hand.handNo,
    hand_id: hand.clientHandId,
    winner_name: hand.winnerName,
    pot_collected: hand.potCollected,
    pot_bb: hand.potBb,
    big_blind: hand.bigBlind,
    showdown: hand.showdown,
  }));
  const calculatorActions = actions.map((action) => ({
    hand_no: action.handNo,
    hand_id: action.clientHandId,
    player_name: action.playerName,
    street: action.street,
    action: action.action,
    amount: action.amount,
    all_in: action.allIn,
    is_open_raise: action.isOpenRaise,
    is_3bet: action.is3bet,
    is_call_vs_raise: action.isCallVsRaise,
    raw_entry: action.rawEntry,
  }));
  return derivePlayerSessionStatsFromRows({ hands: calculatorHands, actions: calculatorActions }).map((row) => ({
    playerName: row.player_name,
    hands: row.hands,
    handsWon: row.hands_won,
    handWinPct: row.hand_win_pct,
    totalCollected: row.total_collected,
    totalCollectedBb: row.total_collected_bb,
    biggestPotWon: row.biggest_pot_won,
    biggestPotWonBb: row.biggest_pot_won_bb,
    allIns: row.all_ins,
    folds: row.folds,
    foldPct: row.fold_pct,
    notableHands: notableHands.filter((notable) => notable.involvedPlayers.includes(row.player_name)).length,
    vpipPct: row.vpip_pct,
    pfrPct: row.pfr_pct,
    vpipPfrGap: row.vpip_pfr_gap,
    threeBetPct: row.three_bet_pct,
    openRaisePct: row.open_raise_pct,
    limpPct: row.limp_pct,
    callPfRaisePct: row.call_pf_raise_pct,
    preflopAllIns: row.preflop_all_ins,
  }));
}

function stableUnique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function validateManifest({ metadata, manifest, decodedText, decodeError }) {
  const errors = [];
  if (decodeError) errors.push("Source bytes are not valid UTF-8.");
  if (!decodedText.replace(/^\uFEFF/u, "").length) errors.push("The source file is empty.");
  if (!manifest.hands.length) errors.push("No hands were parsed from the source.");

  const handIds = new Set();
  const handNumbers = new Set();
  const handCodes = new Set();
  for (const hand of manifest.hands) {
    if (!hand.handNo || !hand.clientHandId) errors.push("Every parsed hand must have a stable identifier.");
    if (handIds.has(hand.clientHandId)) errors.push(`Duplicate hand identifier: ${hand.clientHandId}.`);
    if (handNumbers.has(hand.handNo)) errors.push(`Duplicate hand number: ${hand.handNo}.`);
    if (hand.handCode && handCodes.has(hand.handCode)) errors.push(`Duplicate hand code: ${hand.handCode}.`);
    handIds.add(hand.clientHandId);
    handNumbers.add(hand.handNo);
    if (hand.handCode) handCodes.add(hand.handCode);
  }
  for (const action of manifest.actions) {
    if (!action.clientHandId || !handIds.has(action.clientHandId)) {
      errors.push(`Action ${action.logOrder || "without order"} is not linked to a parsed hand.`);
    }
  }

  const calculated = {
    players: manifest.players.length,
    hands: manifest.hands.length,
    actions: manifest.actions.length,
    notableHands: manifest.notableHands.length,
    playerSessionStats: manifest.playerSessionStats.length,
  };
  for (const [key, count] of Object.entries(calculated)) {
    if (manifest.totals[key] !== count) errors.push(`Manifest total ${key} is inconsistent.`);
  }
  if (manifest.session.sessionCode !== metadata.sessionCode || manifest.session.replaceExisting !== metadata.replaceExisting) {
    errors.push("Manifest session metadata is inconsistent with canonical metadata.");
  }
  return stableUnique(errors);
}

export function buildRawHandImportArtifact({ sourceBytes, source = {}, metadata: metadataInput = {} } = {}) {
  if (!(sourceBytes instanceof Uint8Array)) throw new TypeError("sourceBytes must be a Uint8Array containing the exact uploaded bytes.");
  if (sourceBytes.byteLength > MAX_RAW_HAND_SOURCE_BYTES) {
    throw new RangeError(`Raw hand source exceeds the ${MAX_RAW_HAND_SOURCE_BYTES} byte limit.`);
  }

  const { metadata, errors: metadataErrors } = normalizedMetadata(metadataInput);
  let decodedText = "";
  let decodeError = null;
  try {
    decodedText = strictDecode(sourceBytes);
  } catch (error) {
    decodeError = error;
  }
  const parseText = decodedText.replace(/^\uFEFF/u, "");
  const parsed = parseHandHistoryInput(metadata.inputMode === "raw_text"
    ? { rawText: parseText }
    : { csvText: parseText });
  const hands = manifestHands(parsed);
  const actions = manifestActions(parsed, hands);
  const notableHands = manifestNotableHands(parsed);
  const playerSessionStats = manifestStats(hands, actions, notableHands);
  const players = (parsed.players || []).map((player) => ({
    rawName: normalizedText(player.raw_name),
    displayName: normalizedText(player.display_name, normalizedText(player.raw_name)),
  }));
  const sourceRows = parseText ? parseText.split(/\r\n|\r|\n/u).filter((line) => line.length > 0).length : 0;

  const manifest = {
    schemaVersion: RAW_HAND_MANIFEST_VERSION,
    parserVersion: RAW_HAND_PARSER_VERSION,
    source: {
      kind: metadata.sourceKind,
      filename: normalizedText(source.filename, metadata.sourceKind === "pasted_text" ? "pasted-hand-history.txt" : "hands.csv"),
      mediaType: normalizedText(source.mediaType, metadata.sourceKind === "pasted_text" ? "text/plain" : "text/csv"),
      sizeBytes: sourceBytes.byteLength,
    },
    session: {
      sessionCode: metadata.sessionCode,
      seasonCode: metadata.seasonCode,
      sessionNumber: metadata.sessionNumber,
      tableName: metadata.tableName,
      playedAt: metadata.playedAt,
      format: metadata.format,
      replaceExisting: metadata.replaceExisting,
    },
    players,
    hands,
    actions,
    notableHands,
    playerSessionStats,
    totals: {
      sourceRows,
      sourceBytes: sourceBytes.byteLength,
      players: players.length,
      hands: hands.length,
      actions: actions.length,
      notableHands: notableHands.length,
      playerSessionStats: playerSessionStats.length,
    },
    warnings: stableUnique(parsed.warnings || []),
  };

  const validationErrors = [
    ...metadataErrors,
    ...validateManifest({ metadata, manifest, decodedText, decodeError }),
  ];
  const validationReport = {
    schemaVersion: RAW_HAND_VALIDATION_VERSION,
    valid: validationErrors.length === 0,
    errors: stableUnique(validationErrors),
    warnings: manifest.warnings,
    totals: manifest.totals,
  };
  const canonicalMetadata = canonicalJson(metadata);
  const canonicalManifest = canonicalJson(manifest);
  const canonicalValidationReport = canonicalJson(validationReport);

  return {
    sourceBytes: new Uint8Array(sourceBytes),
    metadata,
    manifest,
    validationReport,
    canonicalMetadata,
    canonicalManifest,
    canonicalValidationReport,
    parserVersion: RAW_HAND_PARSER_VERSION,
    sourceChecksum: sha256Bytes(sourceBytes),
    metadataChecksum: sha256Utf8(canonicalMetadata),
    manifestChecksum: sha256Utf8(canonicalManifest),
    validationReportChecksum: sha256Utf8(canonicalValidationReport),
  };
}
