import { buildGauntletMatchImportArtifact } from "@/lib/imports/gauntletMatchArtifact";
import { ImportRepositoryError } from "@/lib/imports/rawHandImportRepository";
import { supabase } from "@/lib/newsroom/data";

function message(error, fallback) {
  return error?.message || error?.details || fallback;
}

async function leaguePlayers() {
  const { data, error } = await supabase.from("players").select("id,display_name,pokernow_name,slug").order("display_name");
  if (error) throw new ImportRepositoryError(message(error, "Could not load league player identities."));
  return data || [];
}

export async function persistGauntletMatchPreview({ sourceBytes, source, metadata, participantMappings } = {}) {
  const artifact = buildGauntletMatchImportArtifact({
    sourceBytes,
    source,
    metadata,
    participantMappings,
    leaguePlayers: await leaguePlayers(),
  });
  const { data, error } = await supabase.rpc("create_eggs_session_import_preview", {
    p_source_filename: artifact.manifest.source.filename,
    p_source_media_type: artifact.manifest.source.mediaType,
    p_source_base64: Buffer.from(artifact.sourceBytes).toString("base64"),
    p_canonical_metadata: artifact.canonicalMetadata,
    p_parser_version: artifact.parserVersion,
    p_canonical_manifest: artifact.canonicalManifest,
    p_canonical_validation_report: artifact.canonicalValidationReport,
    p_created_by_user_id: null,
  });
  if (error) throw new ImportRepositoryError(message(error, "Could not persist the immutable Gauntlet preview."), { details: error });
  for (const [field, expected] of [
    ["sourceChecksum", artifact.sourceChecksum],
    ["metadataChecksum", artifact.metadataChecksum],
    ["manifestChecksum", artifact.manifestChecksum],
    ["validationReportChecksum", artifact.validationReportChecksum],
  ]) {
    if (data?.[field] !== expected) throw new ImportRepositoryError(`Database ${field} did not match the canonical Gauntlet artifact.`, { status: 500 });
  }
  return data;
}

export async function commitGauntletMatch(input) {
  const { data, error } = await supabase.rpc("commit_eggs_session_import", {
    p_import_id: input.importId,
    p_preview_checksum: input.previewChecksum,
    p_confirm: input.confirm,
    p_confirm_replace: input.confirmReplace,
    p_expected_current_evidence_revision_id: input.expectedCurrentEvidenceRevisionId,
  });
  if (error) throw new ImportRepositoryError(message(error, "Could not commit the Gauntlet evidence."), { details: error });
  if (data?.status === "not_found") throw new ImportRepositoryError(data.error, { status: 404, details: data });
  if (["conflict", "duplicate"].includes(data?.status)) {
    throw new ImportRepositoryError(data.error || "The Gauntlet import conflicts with current evidence.", { status: 409, details: data });
  }
  if (data?.status === "failed") throw new ImportRepositoryError(data.error || "The Gauntlet evidence transaction failed and rolled back.", { details: data });
  if (data?.status !== "imported") throw new ImportRepositoryError("The Gauntlet commit RPC returned an unexpected status.", { details: data });
  return data;
}
