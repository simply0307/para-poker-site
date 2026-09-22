import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";
import schema from "./contracts/para-completed-session-v2.schema.json" with { type: "json" };
import { derivePlayerSessionStatsFromRows } from "../stats/calculators.js";

export const EGGS_SESSION_PACKAGE_VERSION = "para-completed-session-v2";
export const EGGS_SESSION_PARSER_VERSION = "eggs-session-package-v2";
export const EGGS_SESSION_MANIFEST_VERSION = "raw-hand-manifest-v1";
export const EGGS_SESSION_VALIDATION_VERSION = "eggs-session-validation-v1";
export const EGGS_SESSION_PREVIEW_VERSION = "raw-hand-preview-v1";
export const EGGS_SCHEMA_CHECKSUM = "50843d64ca62fa910d87cb893651a4a7664c796afa11f55247d33fedaeb3192c";
export const PARA_PLAYER_IDENTITY_SYSTEM = "para-poker-league-player-id";
export const MAX_EGGS_PACKAGE_BYTES = 10 * 1024 * 1024;

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateSchema = ajv.compile(schema);

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])])
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

function decodePackage(sourceBytes) {
  return new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes).replace(/^\uFEFF/u, "");
}

function packageChecksumPayload(completedPackage) {
  const copy = structuredClone(completedPackage);
  delete copy.integrity.packageChecksum;
  return copy;
}

export function computeEggsPackageChecksum(completedPackage) {
  return sha256Utf8(canonicalJson(packageChecksumPayload(completedPackage)));
}

function stableUnique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizedText(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function resolvedMapping(participant, participantMappings) {
  const explicit = normalizedText(participantMappings?.[participant.sourcePlayerId]);
  const packaged = participant.externalIdentities?.find((identity) => identity.system === PARA_PLAYER_IDENTITY_SYSTEM)?.id;
  return explicit || normalizedText(packaged);
}

function buildPlayers(completedPackage, participantMappings, leaguePlayersById) {
  return completedPackage.participants.map((participant) => {
    const leaguePlayerId = resolvedMapping(participant, participantMappings);
    const leaguePlayer = leaguePlayersById.get(leaguePlayerId);
    return {
      rawName: participant.sourcePlayerId,
      displayName: participant.displayName,
      sourcePlayerId: participant.sourcePlayerId,
      seatId: participant.seatId,
      kind: participant.kind,
      leaguePlayerId: leaguePlayer?.id || leaguePlayerId || null,
      leaguePlayerName: leaguePlayer?.display_name || null,
      resolved: Boolean(leaguePlayer),
    };
  });
}

function buildHands(completedPackage) {
  return completedPackage.hands.map((hand) => {
    const biggestAward = [...hand.settlement.awards].sort((left, right) => right.amount - left.amount)[0];
    const winner = completedPackage.participants.find((participant) => participant.seatId === biggestAward?.seatId);
    const board = hand.streets.at(-1)?.board || [];
    return {
      clientHandId: hand.handId,
      handNo: hand.handNumber,
      handCode: hand.handId,
      startTime: hand.startedAt,
      board: board.join(" "),
      winnerName: winner?.displayName || "",
      winnerSourcePlayerId: winner?.sourcePlayerId || "",
      potCollected: Number(biggestAward?.amount || 0),
      potBb: completedPackage.rules.blinds.bigBlind
        ? Number(biggestAward?.amount || 0) / completedPackage.rules.blinds.bigBlind
        : null,
      bigBlind: completedPackage.rules.blinds.bigBlind,
      smallBlind: completedPackage.rules.blinds.smallBlind,
      winningHand: biggestAward?.handName || "",
      showdown: Object.keys(hand.revealedCards || {}).length > 0,
      rawResult: hand.settlement.awards.map((award) => `${award.seatId} won ${award.amount}`).join("; "),
      completionEventId: hand.settlement.completionEventId,
      completionReason: hand.settlement.completionReason,
      settlementEventIds: [...hand.settlement.settlementEventIds],
    };
  });
}

function actionName(action) {
  return {
    smallBlind: "posts small blind",
    bigBlind: "posts big blind",
    fold: "folds",
    check: "checks",
    call: "calls",
    bet: "bets",
    raise: "raises",
    allIn: "all-in",
  }[action] || action;
}

function buildActions(completedPackage) {
  const participants = new Map(completedPackage.participants.map((participant) => [participant.seatId, participant]));
  return completedPackage.hands.flatMap((hand) => hand.actions.map((action) => {
    const participant = participants.get(action.seatId);
    return {
      clientHandId: hand.handId,
      handNo: hand.handNumber,
      logOrder: action.sequenceNumber,
      eventId: action.eventId,
      commandId: action.commandId || null,
      street: action.street,
      playerName: participant?.displayName || action.seatId,
      sourcePlayerId: participant?.sourcePlayerId || action.seatId,
      position: hand.positions[action.seatId] || "",
      seatIndex: hand.participantSeatIds.indexOf(action.seatId),
      dealerName: participants.get(hand.dealerSeatId)?.displayName || "",
      preflopActionOrder: action.street === "preflop" ? action.sequenceNumber : null,
      action: actionName(action.action),
      amount: action.amount,
      targetContribution: action.targetContribution,
      raiseTo: action.raiseTo ?? null,
      allIn: action.action === "allIn",
      facedRaise: false,
      faced3bet: false,
      isOpenRaise: action.action === "raise",
      is3bet: false,
      isLimp: action.action === "call" && action.targetContribution === completedPackage.rules.blinds.bigBlind,
      isCallVsRaise: action.action === "call" && action.targetContribution > completedPackage.rules.blinds.bigBlind,
      rawEntry: `${participant?.displayName || action.seatId} ${actionName(action.action)}${action.amount ? ` ${action.amount}` : ""}${action.raiseTo ? ` to ${action.raiseTo}` : ""}`,
    };
  }));
}

function buildNotableHands(completedPackage, hands) {
  const factionHands = new Set(completedPackage.orderedPublicEvents
    .filter((event) => event.type === "factionAbilityUsed")
    .map((event) => event.handId));
  return hands.map((hand) => ({
    handNo: hand.handNo,
    handCode: hand.handCode,
    tags: ["eggs-authoritative", ...(factionHands.has(hand.handNo) ? ["faction-ability"] : [])],
    winnerName: hand.winnerName,
    potCollected: hand.potCollected,
    potBb: hand.potBb,
    bigBlind: hand.bigBlind,
    smallBlind: hand.smallBlind,
    winningHand: hand.winningHand,
    board: hand.board,
    involvedPlayers: completedPackage.participants.map((participant) => participant.displayName),
    summary: "Authoritative EGGS hand candidate; narrative remains editorial.",
    rawResult: hand.rawResult,
  }));
}

function buildStats(hands, actions, notableHands) {
  const displayNameBySourcePlayerId = new Map(actions.map((action) => [action.sourcePlayerId, action.playerName]));
  const derived = derivePlayerSessionStatsFromRows({
    hands: hands.map((hand) => ({
      hand_no: hand.handNo,
      hand_id: hand.clientHandId,
      winner_name: hand.winnerSourcePlayerId,
      pot_collected: hand.potCollected,
      pot_bb: hand.potBb,
      big_blind: hand.bigBlind,
      showdown: hand.showdown,
    })),
    actions: actions.map((action) => ({
      hand_no: action.handNo,
      hand_id: action.clientHandId,
      player_name: action.sourcePlayerId,
      street: action.street,
      action: action.action,
      amount: action.amount,
      all_in: action.allIn,
      is_open_raise: action.isOpenRaise,
      is_3bet: action.is3bet,
      is_call_vs_raise: action.isCallVsRaise,
      raw_entry: action.rawEntry,
    })),
  });
  return derived.map((row) => {
    const playerName = displayNameBySourcePlayerId.get(row.player_name) || row.player_name;
    return {
      sourcePlayerId: row.player_name,
      playerName,
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
      notableHands: notableHands.filter((notable) => notable.involvedPlayers.includes(playerName)).length,
      vpipPct: row.vpip_pct,
      pfrPct: row.pfr_pct,
      vpipPfrGap: row.vpip_pfr_gap,
      threeBetPct: row.three_bet_pct,
      openRaisePct: row.open_raise_pct,
      limpPct: row.limp_pct,
      callPfRaisePct: row.call_pf_raise_pct,
      preflopAllIns: row.preflop_all_ins,
    };
  });
}

function buildSessionResults(completedPackage, players) {
  const playerBySeat = new Map(players.map((player) => [player.seatId, player]));
  return completedPackage.results.finishOrder.map((result) => {
    const player = playerBySeat.get(result.seatId);
    return {
      sourcePlayerId: player?.sourcePlayerId || result.seatId,
      playerName: player?.displayName || result.seatId,
      leaguePlayerId: player?.leaguePlayerId || null,
      finish: result.finish,
      finalStack: result.finalStack,
      confidence: "authoritative_eggs",
      approved: false,
    };
  });
}

function validateInternalConsistency(completedPackage) {
  const errors = [];
  const participants = new Set(completedPackage.participants.map((participant) => participant.seatId));
  const eventIds = new Set();
  let previousHand = 0;
  let previousSequence = 0;
  for (const event of completedPackage.orderedPublicEvents) {
    if (event.visibility !== "public") errors.push(`Event ${event.eventId} is not public.`);
    if (event.type === "holeCardsDealt") errors.push("Private hole-card deal events are forbidden.");
    if (eventIds.has(event.eventId)) errors.push(`Duplicate event ID ${event.eventId}.`);
    eventIds.add(event.eventId);
    if (event.handId < previousHand || (event.handId === previousHand && event.sequenceNumber <= previousSequence)) {
      errors.push(`Event ${event.eventId} is out of order.`);
    }
    previousHand = event.handId;
    previousSequence = event.sequenceNumber;
  }
  if (completedPackage.integrity.eventCount !== completedPackage.orderedPublicEvents.length) errors.push("Event count is inconsistent.");
  if (completedPackage.integrity.handCount !== completedPackage.hands.length) errors.push("Hand count is inconsistent.");
  if (completedPackage.integrity.participantCount !== completedPackage.participants.length) errors.push("Participant count is inconsistent.");
  if (completedPackage.integrity.sourceMatchId !== completedPackage.source.sourceMatchId) errors.push("Integrity source match is inconsistent.");
  for (const hand of completedPackage.hands) {
    const events = completedPackage.orderedPublicEvents.filter((event) => event.handId === hand.handNumber);
    if (canonicalJson(events.map((event) => event.eventId)) !== canonicalJson(hand.eventIds)) errors.push(`Hand ${hand.handNumber} event IDs are inconsistent.`);
    const completionIndex = events.findIndex((event) => event.eventId === hand.settlement.completionEventId && event.type === "handCompleted");
    if (completionIndex < 0) errors.push(`Hand ${hand.handNumber} is missing handCompleted evidence.`);
    for (const settlementId of hand.settlement.settlementEventIds) {
      const settlementIndex = events.findIndex((event) => event.eventId === settlementId);
      if (settlementIndex < 0 || settlementIndex >= completionIndex) errors.push(`Hand ${hand.handNumber} has invalid settlement reference ${settlementId}.`);
    }
    const expectedActionIds = events.filter((event) => event.type === "blindPosted" || event.type === "actionApplied").map((event) => event.eventId);
    if (canonicalJson(expectedActionIds) !== canonicalJson(hand.actions.map((action) => action.eventId))) errors.push(`Hand ${hand.handNumber} action evidence is incomplete or reordered.`);
    for (const seatId of [...hand.participantSeatIds, hand.dealerSeatId, ...Object.keys(hand.stackCheckpoints.final)]) {
      if (!participants.has(seatId)) errors.push(`Hand ${hand.handNumber} references unknown seat ${seatId}.`);
    }
  }
  const resultSeats = completedPackage.results.finishOrder.map((result) => result.seatId);
  if (new Set(resultSeats).size !== participants.size || resultSeats.some((seatId) => !participants.has(seatId))) {
    errors.push("Result participants are inconsistent.");
  }
  return stableUnique(errors);
}

export function computeEggsPreviewChecksum({
  sourceChecksum,
  metadataChecksum,
  manifestChecksum,
  validationReportChecksum,
  targetSessionId = null,
  expectedCurrentEvidenceRevisionId = null,
}) {
  return sha256Utf8([
    EGGS_SESSION_PREVIEW_VERSION,
    sourceChecksum,
    metadataChecksum,
    EGGS_SESSION_PARSER_VERSION,
    manifestChecksum,
    validationReportChecksum,
    `${targetSessionId || ""}:${expectedCurrentEvidenceRevisionId || ""}`,
  ].join("\n"));
}

export function buildEggsSessionImportArtifact({
  sourceBytes,
  metadata: metadataInput = {},
  participantMappings = {},
  leaguePlayers = [],
  source = {},
} = {}) {
  if (!(sourceBytes instanceof Uint8Array)) throw new TypeError("sourceBytes must contain the exact EGGS package bytes.");
  if (!sourceBytes.byteLength) throw new TypeError("The EGGS package is empty.");
  if (sourceBytes.byteLength > MAX_EGGS_PACKAGE_BYTES) throw new RangeError("The EGGS package exceeds the import size limit.");
  let completedPackage = null;
  const errors = [];
  try {
    completedPackage = JSON.parse(decodePackage(sourceBytes));
  } catch (error) {
    errors.push(error instanceof SyntaxError ? "The EGGS package is not valid JSON." : "The EGGS package is not valid UTF-8.");
  }
  if (!completedPackage) {
    return invalidArtifact({ sourceBytes, source, metadataInput, errors });
  }
  if (!validateSchema(completedPackage)) {
    errors.push(...(validateSchema.errors || []).map((error) => `Schema ${error.instancePath || "/"} ${error.message}.`));
  }
  if (completedPackage.schemaVersion === EGGS_SESSION_PACKAGE_VERSION) {
    if (completedPackage.integrity?.contractSchemaChecksum !== EGGS_SCHEMA_CHECKSUM) errors.push("Contract schema checksum is unsupported.");
    if (completedPackage.integrity?.packageChecksum !== computeEggsPackageChecksum(completedPackage)) errors.push("Package checksum is invalid.");
    errors.push(...validateInternalConsistency(completedPackage));
  }
  const leaguePlayersById = new Map(leaguePlayers.map((player) => [String(player.id), player]));
  const players = buildPlayers(completedPackage, participantMappings, leaguePlayersById);
  const unresolvedPlayerMappings = players
    .filter((player) => !player.resolved)
    .map((player) => ({ sourcePlayerId: player.sourcePlayerId, seatId: player.seatId, displayName: player.displayName, requestedLeaguePlayerId: player.leaguePlayerId }));
  const metadata = {
    schemaVersion: EGGS_SESSION_PREVIEW_VERSION,
    sourceKind: "eggs_session_package",
    sessionCode: normalizedText(metadataInput.sessionCode, completedPackage.competition.leagueSessionId || completedPackage.source.sourceMatchId),
    seasonCode: normalizedText(metadataInput.seasonCode, completedPackage.competition.seasonCode || "S0"),
    sessionNumber: metadataInput.sessionNumber ? Number(metadataInput.sessionNumber) : null,
    tableName: normalizedText(metadataInput.tableName, completedPackage.source.sourceTableId),
    playedAt: normalizedText(metadataInput.playedAt, completedPackage.source.packageCreatedAt),
    format: normalizedText(metadataInput.format, "EGGS authoritative heads-up"),
    replaceExisting: Boolean(metadataInput.replaceExisting),
    sourceApplication: completedPackage.source.producingApplication,
    sourceMatchId: completedPackage.source.sourceMatchId,
    sourcePackageChecksum: completedPackage.integrity.packageChecksum,
    participantMappings: Object.fromEntries(players.filter((player) => player.resolved).map((player) => [player.sourcePlayerId, player.leaguePlayerId])),
  };
  if (!metadata.sessionCode) errors.push("A league session code is required.");
  if (!metadata.seasonCode) errors.push("A league season code is required.");
  if (metadata.sessionNumber !== null && (!Number.isInteger(metadata.sessionNumber) || metadata.sessionNumber <= 0)) errors.push("Session number must be positive when provided.");
  const playedAtTimestamp = Date.parse(metadata.playedAt);
  if (Number.isNaN(playedAtTimestamp)) errors.push("Played-at must be a valid timestamp.");
  const hands = buildHands(completedPackage);
  const actions = buildActions(completedPackage);
  const notableHands = buildNotableHands(completedPackage, hands);
  const playerSessionStats = buildStats(hands, actions, notableHands);
  const sessionResults = buildSessionResults(completedPackage, players);
  const manifest = {
    schemaVersion: EGGS_SESSION_MANIFEST_VERSION,
    parserVersion: EGGS_SESSION_PARSER_VERSION,
    source: {
      kind: "eggs_session_package",
      filename: normalizedText(source.filename, `${completedPackage.source.sourceMatchId}.json`),
      mediaType: "application/json",
      sizeBytes: sourceBytes.byteLength,
    },
    sourceIdentity: {
      application: completedPackage.source.producingApplication,
      matchId: completedPackage.source.sourceMatchId,
      tableId: completedPackage.source.sourceTableId,
      packageChecksum: completedPackage.integrity.packageChecksum,
      contractVersion: completedPackage.schemaVersion,
      eventSchemaVersion: completedPackage.source.eventSchemaVersion,
    },
    session: {
      sessionCode: metadata.sessionCode,
      seasonCode: metadata.seasonCode,
      sessionNumber: metadata.sessionNumber,
      tableName: metadata.tableName,
      playedAt: Number.isNaN(playedAtTimestamp) ? new Date(0).toISOString() : new Date(playedAtTimestamp).toISOString(),
      format: metadata.format,
      replaceExisting: metadata.replaceExisting,
      resultReviewStatus: "awaiting_result_review",
    },
    players,
    hands,
    actions,
    notableHands,
    playerSessionStats,
    sessionResults,
    publicEvents: structuredClone(completedPackage.orderedPublicEvents),
    authorityConsequences: structuredClone(completedPackage.authorityConsequences),
    totals: {
      sourceRows: 0,
      sourceBytes: sourceBytes.byteLength,
      players: players.length,
      hands: hands.length,
      actions: actions.length,
      events: completedPackage.orderedPublicEvents.length,
      notableHands: notableHands.length,
      playerSessionStats: playerSessionStats.length,
      sessionResults: sessionResults.length,
    },
    warnings: [],
  };
  const validationReport = {
    schemaVersion: EGGS_SESSION_VALIDATION_VERSION,
    valid: errors.length === 0 && unresolvedPlayerMappings.length === 0,
    errors: stableUnique(errors),
    warnings: [],
    unresolvedPlayerMappings,
    totals: manifest.totals,
  };
  return finalizeArtifact({ sourceBytes, metadata, manifest, validationReport });
}

function invalidArtifact({ sourceBytes, source, metadataInput, errors }) {
  const metadata = {
    schemaVersion: EGGS_SESSION_PREVIEW_VERSION,
    sourceKind: "eggs_session_package",
    sessionCode: normalizedText(metadataInput.sessionCode),
    seasonCode: normalizedText(metadataInput.seasonCode, "S0"),
    sessionNumber: null,
    tableName: normalizedText(metadataInput.tableName, "EGGS authoritative table"),
    playedAt: normalizedText(metadataInput.playedAt, new Date(0).toISOString()),
    format: normalizedText(metadataInput.format, "EGGS authoritative heads-up"),
    replaceExisting: Boolean(metadataInput.replaceExisting),
    sourceApplication: "parapoker-official-client",
    sourceMatchId: "invalid",
    sourcePackageChecksum: "invalid",
    participantMappings: {},
  };
  const totals = { sourceRows: 0, sourceBytes: sourceBytes.byteLength, players: 0, hands: 0, actions: 0, events: 0, notableHands: 0, playerSessionStats: 0, sessionResults: 0 };
  return finalizeArtifact({
    sourceBytes,
    metadata,
    manifest: {
      schemaVersion: EGGS_SESSION_MANIFEST_VERSION,
      parserVersion: EGGS_SESSION_PARSER_VERSION,
      source: { kind: "eggs_session_package", filename: normalizedText(source.filename, "invalid-eggs-package.json"), mediaType: "application/json", sizeBytes: sourceBytes.byteLength },
      sourceIdentity: { application: "parapoker-official-client", matchId: "invalid", tableId: "invalid", packageChecksum: "invalid", contractVersion: EGGS_SESSION_PACKAGE_VERSION, eventSchemaVersion: "poker-event-v2" },
      session: { sessionCode: metadata.sessionCode, seasonCode: metadata.seasonCode, sessionNumber: null, tableName: metadata.tableName, playedAt: metadata.playedAt, format: metadata.format, replaceExisting: metadata.replaceExisting, resultReviewStatus: "awaiting_result_review" },
      players: [], hands: [], actions: [], notableHands: [], playerSessionStats: [], sessionResults: [], publicEvents: [], authorityConsequences: { progressionEffects: [] }, totals, warnings: [],
    },
    validationReport: { schemaVersion: EGGS_SESSION_VALIDATION_VERSION, valid: false, errors: stableUnique(errors), warnings: [], unresolvedPlayerMappings: [], totals },
  });
}

function finalizeArtifact({ sourceBytes, metadata, manifest, validationReport }) {
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
    parserVersion: EGGS_SESSION_PARSER_VERSION,
    sourceChecksum: sha256Bytes(sourceBytes),
    metadataChecksum: sha256Utf8(canonicalMetadata),
    manifestChecksum: sha256Utf8(canonicalManifest),
    validationReportChecksum: sha256Utf8(canonicalValidationReport),
  };
}
