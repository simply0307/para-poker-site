import {
  EGGS_SESSION_MANIFEST_VERSION,
  EGGS_SESSION_PARSER_VERSION,
  EGGS_SESSION_PREVIEW_VERSION,
  MAX_EGGS_PACKAGE_BYTES,
  canonicalJson,
  computeEggsPreviewChecksum,
  sha256Bytes,
  sha256Utf8,
} from "./eggsSessionPackageArtifact.js";

export const GAUNTLET_MATCH_VERSION = "gauntlet.para-match.v2";
export const GAUNTLET_EVIDENCE_VERSION = "gauntlet.league-evidence.v1";
export const GAUNTLET_VALIDATION_VERSION = "gauntlet-match-validation-v1";

function text(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function validTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function decode(sourceBytes) {
  return new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes).replace(/^\uFEFF/u, "");
}

export function computeGauntletContentHash(completedMatch) {
  const value = structuredClone(completedMatch);
  value.exportedAt = null;
  if (value.verification) delete value.verification.contentHash;
  return sha256Utf8(canonicalJson(value));
}

function validateContract(completedMatch) {
  const errors = [];
  const warnings = [];
  if (completedMatch.schemaVersion !== GAUNTLET_MATCH_VERSION) errors.push("Unsupported Gauntlet match schema version.");
  if (completedMatch.contract?.producer !== "Gauntlet Online") errors.push("Source contract producer must be Gauntlet Online.");
  if (completedMatch.source?.product !== "Gauntlet Online" || completedMatch.source?.producerId !== "gauntlet-online") {
    errors.push("Source product must be the authoritative Gauntlet Online producer.");
  }
  if (completedMatch.source?.serverAuthored !== true) errors.push("Gauntlet match must be server-authored.");
  if (Number(completedMatch.contract?.recordVersion) !== 2 || Number(completedMatch.verification?.matchRecordVersion) !== 2) {
    errors.push("Gauntlet match record version 2 is required.");
  }
  if (completedMatch.contract?.evidenceSchemaVersion !== GAUNTLET_EVIDENCE_VERSION
      || completedMatch.evidence?.schemaVersion !== GAUNTLET_EVIDENCE_VERSION) {
    errors.push("Unsupported Gauntlet evidence schema version.");
  }
  const matchId = text(completedMatch.match?.matchId);
  if (!matchId || matchId !== completedMatch.source?.authoritativeMatchId) errors.push("Authoritative source and match IDs must agree.");
  if (!validTimestamp(completedMatch.exportedAt) || !validTimestamp(completedMatch.match?.startedAt)
      || !validTimestamp(completedMatch.match?.completedAt)) errors.push("Export, start, and completion timestamps are required.");
  if (validTimestamp(completedMatch.match?.startedAt) && validTimestamp(completedMatch.match?.completedAt)
      && Date.parse(completedMatch.match.completedAt) < Date.parse(completedMatch.match.startedAt)) {
    errors.push("Match completion cannot precede match start.");
  }
  const participants = Array.isArray(completedMatch.participants) ? completedMatch.participants : [];
  if (participants.length < 2) errors.push("At least two Gauntlet participants are required.");
  const participantIds = participants.map((participant) => text(participant.participantId));
  const playerNumbers = participants.map((participant) => Number(participant.playerNum));
  if (participantIds.some((id) => !id) || new Set(participantIds).size !== participantIds.length) errors.push("Participant IDs must be non-empty and unique.");
  if (playerNumbers.some((number) => !Number.isInteger(number)) || new Set(playerNumbers).size !== playerNumbers.length) errors.push("Player numbers must be unique integers.");
  for (const participant of participants) {
    if (!text(participant.displayName)) errors.push(`Participant ${participant.participantId || "unknown"} needs a display name.`);
    if (!["account", "guest", "ai"].includes(participant.identityType)) errors.push(`Participant ${participant.participantId || "unknown"} has an unsupported identity type.`);
    if (participant.identityType === "account" && !text(participant.gauntletAccountId)) errors.push(`Account participant ${participant.participantId || "unknown"} needs a Gauntlet account ID.`);
    if (!["win", "loss", "draw", "abandoned"].includes(participant.result)) errors.push(`Participant ${participant.participantId || "unknown"} has an unsupported result.`);
  }
  const resultRows = Array.isArray(completedMatch.results?.participants) ? completedMatch.results.participants : [];
  if (resultRows.length !== participants.length) errors.push("Every participant needs one explicit result row.");
  for (const participant of participants) {
    const result = resultRows.find((row) => row.participantId === participant.participantId);
    if (!result || Number(result.playerNum) !== Number(participant.playerNum)
        || result.result !== participant.result || Number(result.finalLife) !== Number(participant.finalLife)) {
      errors.push(`Participant result contradicts source participant ${participant.participantId}.`);
    }
  }
  const winnerPlayerNum = completedMatch.results?.winnerPlayerNum;
  const winners = participants.filter((participant) => participant.result === "win");
  if (winnerPlayerNum == null) {
    if (winners.length) errors.push("A result without winner metadata cannot contain a winning participant.");
  } else {
    const winner = participants.find((participant) => Number(participant.playerNum) === Number(winnerPlayerNum));
    if (!winner || winner.result !== "win" || winners.length !== 1
        || completedMatch.results?.winnerParticipantId !== winner.participantId) {
      errors.push("Winner metadata contradicts participant outcomes.");
    }
  }
  const entries = Array.isArray(completedMatch.evidence?.entries) ? completedMatch.evidence.entries : [];
  if (completedMatch.evidence?.coverage !== "complete" || completedMatch.evidence?.ordered !== true || !entries.length) {
    errors.push("A complete ordered Gauntlet evidence stream is required.");
  }
  const eventIds = new Set();
  entries.forEach((entry, index) => {
    if (Number(entry.sequence) !== index + 1) errors.push(`Evidence sequence must be contiguous at position ${index + 1}.`);
    if (!text(entry.eventId) || eventIds.has(entry.eventId)) errors.push(`Evidence event ${entry.eventId || index + 1} must have a unique ID.`);
    eventIds.add(entry.eventId);
    if (!text(entry.eventType) || !validTimestamp(entry.serverTimestamp) || !/^[0-9a-f]{64}$/u.test(text(entry.resultingStateChecksum))) {
      errors.push(`Evidence event ${entry.eventId || index + 1} is incomplete.`);
    }
  });
  if (Number(completedMatch.verification?.evidenceEventCount) !== entries.length) errors.push("Evidence count is inconsistent.");
  if (entries.length && completedMatch.verification?.finalStateChecksum !== entries.at(-1).resultingStateChecksum) errors.push("Final state checksum is inconsistent.");
  if (!/^[0-9a-f]{64}$/u.test(text(completedMatch.verification?.contentHash))
      || completedMatch.verification?.contentHash !== computeGauntletContentHash(completedMatch)) {
    errors.push("Gauntlet content hash is invalid.");
  }
  if (completedMatch.source?.storage?.fullRecordDurable !== true) {
    warnings.push(`Gauntlet full record durability is ${completedMatch.source?.storage?.completeRecordV2 || "unknown"}; import the available record before backend replacement.`);
  }
  return { errors: unique(errors), warnings: unique(warnings) };
}

function resolveParticipants(completedMatch, participantMappings, leaguePlayersById) {
  const unresolved = [];
  const warnings = [];
  const rows = [];
  for (const participant of completedMatch.participants || []) {
    const requested = text(participantMappings?.[participant.participantId]);
    if (participant.identityType === "ai") {
      if (requested) warnings.push(`Ignored league-player mapping for AI participant ${participant.participantId}.`);
      continue;
    }
    const leaguePlayer = leaguePlayersById.get(requested);
    if (participant.identityType === "account" && !leaguePlayer) {
      unresolved.push({
        sourcePlayerId: participant.participantId,
        seatId: `p${participant.playerNum}`,
        displayName: participant.displayName,
        identityType: participant.identityType,
        gauntletAccountId: participant.gauntletAccountId,
        requestedLeaguePlayerId: requested || null,
      });
    }
    if (participant.identityType === "guest" && !requested) {
      warnings.push(`Guest participant ${participant.participantId} will remain source-only unless mapped explicitly.`);
      continue;
    }
    rows.push({
      rawName: participant.participantId,
      displayName: participant.displayName,
      sourcePlayerId: participant.participantId,
      seatId: `p${participant.playerNum}`,
      kind: participant.identityType,
      gauntletAccountId: participant.gauntletAccountId || null,
      leaguePlayerId: leaguePlayer?.id || requested || null,
      leaguePlayerName: leaguePlayer?.display_name || null,
      resolved: Boolean(leaguePlayer),
    });
  }
  return { rows, unresolved, warnings };
}

function finishFor(participant, participants) {
  if (participant.result === "win") return 1;
  if (participant.result === "loss") return participants.filter((row) => row.result === "win").length + 1;
  return 1;
}

function evidenceAmount(entry) {
  for (const field of ["damage", "amount", "effectiveValue", "total", "attackValue", "blockValue", "count"]) {
    const value = Number(entry.publicPayload?.[field]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function buildManifest(completedMatch, sourceBytes, source, metadataInput, mappings) {
  const participantsByNumber = new Map(completedMatch.participants.map((participant) => [Number(participant.playerNum), participant]));
  const winner = participantsByNumber.get(Number(completedMatch.results.winnerPlayerNum)) || null;
  const playedAt = validTimestamp(metadataInput.playedAt) ? new Date(metadataInput.playedAt).toISOString() : completedMatch.match.completedAt;
  const metadata = {
    schemaVersion: EGGS_SESSION_PREVIEW_VERSION,
    sourceKind: "eggs_session_package",
    sessionCode: text(metadataInput.sessionCode, completedMatch.match.matchId),
    seasonCode: text(metadataInput.seasonCode, "S0"),
    sessionNumber: metadataInput.sessionNumber ? Number(metadataInput.sessionNumber) : null,
    tableName: text(metadataInput.tableName, `Gauntlet ${completedMatch.match.mode}`),
    playedAt,
    format: text(metadataInput.format, `Gauntlet ${completedMatch.match.mode}`),
    replaceExisting: Boolean(metadataInput.replaceExisting),
    sourceApplication: "gauntlet-online",
    sourceMatchId: completedMatch.match.matchId,
    sourcePackageChecksum: completedMatch.verification.contentHash,
    participantMappings: Object.fromEntries(mappings.rows.filter((row) => row.resolved).map((row) => [row.sourcePlayerId, row.leaguePlayerId])),
  };
  const hand = {
    clientHandId: completedMatch.match.matchId,
    handNo: 1,
    handCode: completedMatch.match.matchId,
    startTime: completedMatch.match.startedAt,
    board: "",
    winnerName: winner?.displayName || "",
    winnerSourcePlayerId: winner?.participantId || "",
    potCollected: Number(completedMatch.recapEvidence?.damageDealt || 0),
    potBb: null,
    bigBlind: null,
    smallBlind: null,
    winningHand: completedMatch.results.completionReason,
    showdown: false,
    rawResult: canonicalJson(completedMatch.results),
    completionEventId: completedMatch.evidence.entries.at(-1)?.eventId || null,
    completionReason: completedMatch.results.completionReason,
    settlementEventIds: [completedMatch.evidence.entries.at(-1)?.eventId].filter(Boolean),
  };
  const actions = completedMatch.evidence.entries.map((entry) => {
    const actor = participantsByNumber.get(Number(entry.actorPlayerNum));
    return {
      clientHandId: completedMatch.match.matchId,
      handNo: 1,
      logOrder: Number(entry.sequence),
      eventId: entry.eventId,
      commandId: entry.commandId || null,
      street: entry.phase || "action",
      playerName: actor?.displayName || "Gauntlet system",
      sourcePlayerId: actor?.participantId || "gauntlet-system",
      position: entry.sourceType || "",
      seatIndex: actor ? Number(actor.playerNum) - 1 : null,
      dealerName: "",
      preflopActionOrder: null,
      action: entry.eventType,
      amount: evidenceAmount(entry),
      targetContribution: null,
      raiseTo: null,
      allIn: false,
      facedRaise: false,
      faced3bet: false,
      isOpenRaise: false,
      is3bet: false,
      isLimp: false,
      isCallVsRaise: false,
      rawEntry: canonicalJson({ eventType: entry.eventType, publicPayload: entry.publicPayload }),
    };
  });
  const sessionResults = mappings.rows.filter((row) => row.resolved).map((row) => {
    const participant = completedMatch.participants.find((entry) => entry.participantId === row.sourcePlayerId);
    return {
      sourcePlayerId: row.sourcePlayerId,
      playerName: participant.displayName,
      leaguePlayerId: row.leaguePlayerId,
      finish: finishFor(participant, completedMatch.participants),
      finalStack: Math.max(0, Number(participant.finalLife || 0)),
      confidence: "authoritative_gauntlet",
      approved: false,
    };
  });
  const notableHands = [{
    handNo: 1,
    handCode: completedMatch.match.matchId,
    tags: ["gauntlet-authoritative", completedMatch.match.mode, ...(completedMatch.match.campaign ? ["campaign"] : [])],
    winnerName: winner?.displayName || "Draw",
    potCollected: Number(completedMatch.recapEvidence?.damageDealt || 0),
    potBb: null,
    bigBlind: null,
    smallBlind: null,
    winningHand: completedMatch.results.completionReason,
    board: "",
    involvedPlayers: completedMatch.participants.map((participant) => participant.displayName),
    summary: `${winner?.displayName || "No participant"} ${winner ? "won" : "drew"} the authoritative Gauntlet match on turn ${completedMatch.match.turnCount}.`,
    rawResult: canonicalJson(completedMatch.recapEvidence),
  }];
  const totals = {
    sourceRows: 0,
    sourceBytes: sourceBytes.byteLength,
    players: completedMatch.participants.length,
    hands: 1,
    actions: actions.length,
    events: completedMatch.evidence.entries.length,
    notableHands: notableHands.length,
    playerSessionStats: 0,
    sessionResults: sessionResults.length,
  };
  return {
    metadata,
    manifest: {
      schemaVersion: EGGS_SESSION_MANIFEST_VERSION,
      parserVersion: EGGS_SESSION_PARSER_VERSION,
      source: {
        kind: "eggs_session_package",
        filename: text(source.filename, `${completedMatch.match.matchId}.json`),
        mediaType: text(source.mediaType, "application/json"),
        sizeBytes: sourceBytes.byteLength,
      },
      sourceIdentity: {
        application: "gauntlet-online",
        matchId: completedMatch.match.matchId,
        tableId: completedMatch.match.mode,
        packageChecksum: completedMatch.verification.contentHash,
        contractVersion: "para-completed-session-v2",
        eventSchemaVersion: "poker-event-v2",
        sourceContractVersion: completedMatch.schemaVersion,
        sourceEventSchemaVersion: completedMatch.evidence.schemaVersion,
      },
      sourceContract: {
        schemaVersion: completedMatch.schemaVersion,
        evidenceSchemaVersion: completedMatch.evidence.schemaVersion,
        producer: completedMatch.source.producerId,
        recordVersion: completedMatch.contract.recordVersion,
        storage: structuredClone(completedMatch.source.storage),
      },
      session: {
        sessionCode: metadata.sessionCode,
        seasonCode: metadata.seasonCode,
        sessionNumber: metadata.sessionNumber,
        tableName: metadata.tableName,
        playedAt,
        format: metadata.format,
        replaceExisting: metadata.replaceExisting,
        resultReviewStatus: "awaiting_result_review",
      },
      players: mappings.rows,
      sourceParticipants: structuredClone(completedMatch.participants),
      hands: [hand],
      actions,
      notableHands,
      playerSessionStats: [],
      sessionResults,
      publicEvents: structuredClone(completedMatch.evidence.entries),
      authorityConsequences: {
        gauntletResults: structuredClone(completedMatch.results),
        recapEvidence: structuredClone(completedMatch.recapEvidence),
        provenance: structuredClone(completedMatch.source),
      },
      totals,
      warnings: mappings.warnings,
    },
  };
}

function finalize({ sourceBytes, metadata, manifest, validationReport }) {
  const canonicalMetadata = canonicalJson(metadata);
  const canonicalManifest = canonicalJson(manifest);
  const canonicalValidationReport = canonicalJson(validationReport);
  const sourceChecksum = sha256Bytes(sourceBytes);
  const metadataChecksum = sha256Utf8(canonicalMetadata);
  const manifestChecksum = sha256Utf8(canonicalManifest);
  const validationReportChecksum = sha256Utf8(canonicalValidationReport);
  return {
    sourceBytes,
    metadata,
    manifest,
    validationReport,
    parserVersion: EGGS_SESSION_PARSER_VERSION,
    canonicalMetadata,
    canonicalManifest,
    canonicalValidationReport,
    sourceChecksum,
    metadataChecksum,
    manifestChecksum,
    validationReportChecksum,
    previewChecksum: computeEggsPreviewChecksum({
      sourceChecksum,
      metadataChecksum,
      manifestChecksum,
      validationReportChecksum,
      targetSessionId: null,
      expectedCurrentEvidenceRevisionId: null,
    }),
  };
}

export function buildGauntletMatchImportArtifact({
  sourceBytes,
  source = {},
  metadata: metadataInput = {},
  participantMappings = {},
  leaguePlayers = [],
} = {}) {
  if (!(sourceBytes instanceof Uint8Array)) throw new TypeError("sourceBytes must contain the exact Gauntlet export bytes.");
  if (!sourceBytes.byteLength) throw new TypeError("The Gauntlet export is empty.");
  if (sourceBytes.byteLength > MAX_EGGS_PACKAGE_BYTES) throw new RangeError("The Gauntlet export exceeds the import size limit.");
  let completedMatch;
  try {
    completedMatch = JSON.parse(decode(sourceBytes));
  } catch (error) {
    throw new TypeError(error instanceof SyntaxError ? "The Gauntlet export is not valid JSON." : "The Gauntlet export is not valid UTF-8.");
  }
  const contractValidation = validateContract(completedMatch);
  const leaguePlayersById = new Map(leaguePlayers.map((player) => [String(player.id), player]));
  const mappings = resolveParticipants(completedMatch, participantMappings, leaguePlayersById);
  const { metadata, manifest } = buildManifest(completedMatch, sourceBytes, source, metadataInput, mappings);
  const errors = [...contractValidation.errors];
  if (!metadata.sessionCode) errors.push("A league session code is required.");
  if (!metadata.seasonCode) errors.push("A league season code is required.");
  if (metadata.sessionNumber !== null && (!Number.isInteger(metadata.sessionNumber) || metadata.sessionNumber <= 0)) errors.push("Session number must be positive when provided.");
  const validationReport = {
    schemaVersion: GAUNTLET_VALIDATION_VERSION,
    valid: errors.length === 0 && mappings.unresolved.length === 0,
    errors: unique(errors),
    warnings: unique([...contractValidation.warnings, ...mappings.warnings]),
    unresolvedPlayerMappings: mappings.unresolved,
    totals: manifest.totals,
  };
  return finalize({ sourceBytes, metadata, manifest, validationReport });
}
