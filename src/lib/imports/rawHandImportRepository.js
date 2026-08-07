import { buildRawHandImportArtifact } from "@/lib/imports/rawHandImportArtifact";
import { nextSessionNumber, positiveSessionNumber } from "@/lib/imports/sessionNumber";
import { getSessionByIdOrCode, safeQuery, supabase, text } from "@/lib/newsroom/data";
import { recalculateCareerStats, recalculateSeasonStats } from "@/lib/stats/statRepository";

export class ImportRepositoryError extends Error {
  constructor(message, { status = 500, details = null } = {}) {
    super(message);
    this.name = "ImportRepositoryError";
    this.status = status;
    this.details = details;
  }
}

function rpcErrorMessage(error, fallback) {
  return error?.message || error?.details || fallback;
}

function assertMatchingArtifactChecksums(artifact, preview) {
  const fields = [
    ["sourceChecksum", artifact.sourceChecksum],
    ["metadataChecksum", artifact.metadataChecksum],
    ["manifestChecksum", artifact.manifestChecksum],
    ["validationReportChecksum", artifact.validationReportChecksum],
  ];
  for (const [field, expected] of fields) {
    if (preview?.[field] !== expected) {
      throw new ImportRepositoryError(`Database ${field} did not match the canonical server artifact.`, { status: 500 });
    }
  }
}

export async function persistRawHandImportPreview({ sourceBytes, source, metadata } = {}) {
  const artifact = buildRawHandImportArtifact({ sourceBytes, source, metadata });
  const { data, error } = await supabase.rpc("create_raw_hand_import_preview", {
    p_source_filename: artifact.manifest.source.filename,
    p_source_media_type: artifact.manifest.source.mediaType,
    p_source_base64: Buffer.from(artifact.sourceBytes).toString("base64"),
    p_canonical_metadata: artifact.canonicalMetadata,
    p_parser_version: artifact.parserVersion,
    p_canonical_manifest: artifact.canonicalManifest,
    p_canonical_validation_report: artifact.canonicalValidationReport,
    p_created_by_user_id: null,
  });
  if (error) {
    throw new ImportRepositoryError(rpcErrorMessage(error, "Could not persist the immutable preview."), { details: error });
  }
  assertMatchingArtifactChecksums(artifact, data);
  return data;
}

export async function commitRawHandImport(input) {
  const { data, error } = await supabase.rpc("commit_raw_hand_session_import", {
    p_import_id: input.importId,
    p_preview_checksum: input.previewChecksum,
    p_confirm: input.confirm,
    p_confirm_replace: input.confirmReplace,
    p_expected_current_evidence_revision_id: input.expectedCurrentEvidenceRevisionId,
  });
  if (error) {
    throw new ImportRepositoryError(rpcErrorMessage(error, "Could not commit the stored import."), { details: error });
  }
  if (data?.status === "not_found") throw new ImportRepositoryError(data.error, { status: 404, details: data });
  if (data?.status === "conflict" || data?.status === "duplicate") {
    throw new ImportRepositoryError(data.error || "The import conflicts with current evidence.", { status: 409, details: data });
  }
  if (data?.status === "failed") {
    throw new ImportRepositoryError(data.error || "The evidence transaction failed and was rolled back.", { status: 500, details: data });
  }
  if (data?.status !== "imported") {
    throw new ImportRepositoryError("The commit RPC returned an unexpected status.", { details: data });
  }
  return data;
}

async function requireLegacyUnversionedSession(sessionIdOrCode) {
  const session = await getSessionByIdOrCode(sessionIdOrCode);
  if (!session) throw new ImportRepositoryError("Session not found.", { status: 404 });
  if (session.current_evidence_revision_id) {
    throw new ImportRepositoryError(
      "Revisioned evidence cannot be edited or deleted through legacy session maintenance. Create an explicit replacement preview instead.",
      { status: 409 }
    );
  }
  return session;
}

async function resolveLegacySessionNumber(metadata = {}, existing = null) {
  const explicit = positiveSessionNumber(metadata.sessionNumber || metadata.session_number);
  if (explicit !== null) return explicit;
  const existingNumber = positiveSessionNumber(existing?.session_number);
  if (existingNumber !== null) return existingNumber;
  const seasonCode = text(metadata.seasonCode || metadata.season_code, "S0");
  const rows = await safeQuery(
    supabase.from("sessions").select("session_number").eq("season_code", seasonCode).order("session_number", { ascending: false }).limit(1),
    []
  );
  return nextSessionNumber(rows || []);
}

function isoDate(value, fallback) {
  const date = new Date(value || fallback || "");
  if (Number.isNaN(date.getTime())) throw new ImportRepositoryError("Played-at must be a valid date.", { status: 400 });
  return date.toISOString();
}

export async function updateImportedSession(sessionIdOrCode, patch = {}) {
  const session = await requireLegacyUnversionedSession(sessionIdOrCode);
  const nextSessionCode = text(patch.sessionCode || patch.session_code, session.session_code).trim();
  if (nextSessionCode.toLowerCase() !== text(session.session_code).toLowerCase()) {
    const existingCode = await getSessionByIdOrCode(nextSessionCode);
    if (existingCode && existingCode.id !== session.id) {
      throw new ImportRepositoryError("Another session already uses that session code.", { status: 409 });
    }
  }

  const update = {
    season_code: text(patch.seasonCode || patch.season_code, session.season_code || "S0"),
    session_number: await resolveLegacySessionNumber(patch, session),
    session_code: nextSessionCode,
    played_at: isoDate(patch.playedAt || patch.played_at, session.played_at),
    table_name: text(patch.tableName || patch.table_name, session.table_name || "Imported Table"),
    format: text(patch.format, session.format || "Imported hand history"),
    status: text(patch.status, session.status || "processed"),
    hands_count: Number(patch.handsCount || patch.hands_count || session.hands_count || 0),
    players_count: Number(patch.playersCount || patch.players_count || session.players_count || 0),
  };
  const { data, error } = await supabase.from("sessions").update(update).eq("id", session.id).select("*").single();
  if (error) throw new ImportRepositoryError(`Could not update session import: ${error.message}`);
  return data;
}

async function clearLegacyImportedRows(sessionId) {
  for (const table of ["actions", "notable_hands", "player_session_stats", "session_results", "hands"]) {
    const { error } = await supabase.from(table).delete().eq("session_id", sessionId);
    if (error) throw new ImportRepositoryError(`Could not clear ${table}: ${error.message}`);
  }
}

export async function deleteImportedSession(sessionIdOrCode) {
  const session = await requireLegacyUnversionedSession(sessionIdOrCode);
  const seasonCode = session.season_code || "S0";
  await clearLegacyImportedRows(session.id);
  await supabase.from("recap_drafts").delete().eq("scope", "session").eq("source_session_id", session.id);
  const { error } = await supabase.from("sessions").delete().eq("id", session.id);
  if (error) throw new ImportRepositoryError(`Could not delete session import: ${error.message}`);
  await recalculateSeasonStats(seasonCode);
  await recalculateCareerStats();
  return { deleted: true, sessionId: session.id, sessionCode: session.session_code };
}
