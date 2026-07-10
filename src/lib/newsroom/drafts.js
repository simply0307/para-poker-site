import { supabase } from "@/lib/supabase";

function arrayValue(value) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

export async function saveRecapDraft({
  scope,
  sourceSessionId = null,
  sourcePlayerId = null,
  articleRequest = {},
  contextPacket,
  draft,
  provider,
  modelUsed,
  fallbackTrace = [],
  generationError = "",
  promptVersion,
  sourceDataVersion,
}) {
  const contextPacketWithDebug = {
    ...contextPacket,
    generation_debug: {
      provider_used: provider,
      model_used: modelUsed,
      fallback_trace: fallbackTrace,
      generation_error: generationError,
    },
  };
  const baseInsert = {
    scope,
    status: "draft",
    visibility: "admin",
    source_session_id: sourceSessionId,
    source_player_id: sourcePlayerId,
    article_request: articleRequest || {},
    context_packet: contextPacketWithDebug,
    draft,
    confidence_notes: arrayValue(draft?.confidence_notes),
    missing_data_warnings: arrayValue(draft?.missing_data_warnings),
    provider,
    model_used: modelUsed,
    prompt_version: promptVersion,
    source_data_version: sourceDataVersion,
    generated_at: new Date().toISOString(),
  };
  const insertWithOptionalColumns = {
    ...baseInsert,
    provider_used: provider,
    fallback_trace: fallbackTrace,
    generation_error: generationError,
  };
  const { data, error } = await supabase
    .from("recap_drafts")
    .insert(insertWithOptionalColumns)
    .select("*")
    .single();

  if (isMissingOptionalGenerationColumn(error)) {
    const retry = await supabase
      .from("recap_drafts")
      .insert(baseInsert)
      .select("*")
      .single();

    if (retry.error) throw new Error(retry.error.message);
    return retry.data;
  }

  if (error) throw new Error(error.message);
  return data;
}

function isMissingOptionalGenerationColumn(error) {
  const value = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return (
    value.includes("pgrst204") &&
    (value.includes("fallback_trace") ||
      value.includes("provider_used") ||
      value.includes("generation_error"))
  );
}

export async function getLatestSessionDraft(sessionId) {
  if (!sessionId) return null;

  const { data, error } = await supabase
    .from("recap_drafts")
    .select("*")
    .eq("scope", "session")
    .eq("source_session_id", sessionId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data;
}

export async function updateRecapDraft(draftId, patch) {
  const nextDraft = patch.draft || {};
  const { data, error } = await supabase
    .from("recap_drafts")
    .update({
      draft: nextDraft,
      confidence_notes: arrayValue(nextDraft.confidence_notes),
      missing_data_warnings: arrayValue(nextDraft.missing_data_warnings),
      status: patch.status || "draft",
      visibility: patch.visibility || "admin",
    })
    .eq("id", draftId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function setDraftPublishState(draftId, { publish, approvedBy = "admin" }) {
  const now = new Date().toISOString();
  const patch = publish
    ? {
        status: "approved",
        visibility: "published",
        approved_by: approvedBy,
        approved_at: now,
        published_at: now,
        unpublished_at: null,
      }
    : {
        visibility: "admin",
        unpublished_at: now,
      };

  const { data, error } = await supabase
    .from("recap_drafts")
    .update(patch)
    .eq("id", draftId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}
