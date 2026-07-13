import crypto from "node:crypto";
import { supabase } from "@/lib/supabase";
import { CAPTURE_STATUSES, DATASET_SPLITS } from "@/lib/newsroom/trainingConstants";

function schemaCacheMessage(error) {
  return `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
}

function isMissingTrainingTable(error) {
  const value = schemaCacheMessage(error);
  return (
    value.includes("pgrst205") ||
    value.includes("pgrst204") ||
    value.includes("42p01") ||
    value.includes("does not exist") ||
    value.includes("column") ||
    value.includes("constraint") ||
    value.includes("violates check constraint") ||
    value.includes("invalid input value") ||
    value.includes("schema cache")
  );
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function sourceHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function normalizeSplit(value = null) {
  if (!value) return null;
  return DATASET_SPLITS.includes(value) ? value : null;
}

function normalizeStatus(value = "undecided") {
  return CAPTURE_STATUSES.includes(value) ? value : "undecided";
}

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function rowSourceId(row = {}) {
  return text(row.source_session_id || row.source_player_id || row.season_code || row.moment_id || row.id);
}

export async function createTrainingExampleForDraft({
  draftRow,
  draftTable = "recap_drafts",
  scope = "",
  sourceSessionId = null,
  sourcePlayerId = null,
  seasonCode = null,
  momentId = null,
  contextPacket,
  originalOutput,
  provider,
  modelUsed,
  promptVersion,
  sourceDataVersion,
}) {
  if (!draftRow?.id || !contextPacket || !originalOutput) return null;
  const existing = await getTrainingExampleForDraft(draftTable, draftRow.id);
  if (existing?.id) return existing;
  const hash = sourceHash({
    draftTable,
    draftId: draftRow.id,
    scope,
    contextPacket,
    originalOutput,
    provider,
    modelUsed,
    promptVersion,
    sourceDataVersion,
  });
  const insert = {
    draft_table: draftTable,
    draft_id: String(draftRow.id),
    scope: scope || draftRow.scope || "unknown",
    source_session_id: sourceSessionId ? String(sourceSessionId) : null,
    source_player_id: sourcePlayerId ? String(sourcePlayerId) : null,
    season_code: seasonCode ? String(seasonCode) : null,
    moment_id: momentId ? String(momentId) : null,
    source_hash: hash,
    context_packet: contextPacket,
    original_output: originalOutput,
    provider_used: provider || "",
    model_used: modelUsed || "",
    prompt_version: promptVersion || contextPacket?.prompt_version || "",
    source_data_version: sourceDataVersion || contextPacket?.source_data_version || "",
    capture_status: "captured",
    training_eligible: null,
    dataset_split: null,
    generated_at: draftRow.generated_at || new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase.from("recap_training_examples").insert(insert).select("*").single();
    if (error) throw error;
    return data;
  } catch (error) {
    if (schemaCacheMessage(error).includes("duplicate key")) {
      return getTrainingExampleForDraft(draftTable, draftRow.id);
    }
    if (!isMissingTrainingTable(error)) {
      console.warn("[newsroom] training example capture failed", error.message);
    }
    return null;
  }
}

export async function getTrainingExampleForDraft(draftTable, draftId) {
  if (!draftId) return null;
  try {
    const { data, error } = await supabase
      .from("recap_training_examples")
      .select("*")
      .eq("draft_table", draftTable)
      .eq("draft_id", String(draftId))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  } catch (error) {
    if (!isMissingTrainingTable(error)) console.warn("[newsroom] training example read failed", error.message);
    return null;
  }
}

export async function updateTrainingExampleForDraft(draftTable, draftId, patch = {}) {
  const existing = await getTrainingExampleForDraft(draftTable, draftId);
  if (!existing?.id) return null;
  const captureStatus = normalizeStatus(patch.captureStatus || patch.capture_status || "undecided");
  const split = normalizeSplit(patch.datasetSplit || patch.dataset_split);
  const update = {
    capture_status: captureStatus,
    training_eligible: captureStatus === "included" ? true : captureStatus === "excluded" ? false : null,
    dataset_split: captureStatus === "included" ? split : null,
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from("recap_training_examples")
      .update(update)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    if (!isMissingTrainingTable(error)) console.warn("[newsroom] training example update failed", error.message);
    return null;
  }
}

export async function recordApprovedOutputForDraft(draftTable, draftRow, approvedBy = "admin") {
  if (!draftRow?.id) return null;
  const existing = await getTrainingExampleForDraft(draftTable, draftRow.id);
  if (!existing?.id) return null;

  try {
    const { data, error } = await supabase
      .from("recap_training_examples")
      .update({
        approved_output: draftRow.draft || {},
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        capture_status: "ready_for_review",
        training_eligible: null,
        dataset_split: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    if (!isMissingTrainingTable(error)) console.warn("[newsroom] approved output capture failed", error.message);
    return null;
  }
}

export async function updateTrainingExampleReview({ id, captureStatus = "undecided" }) {
  if (!id) return null;
  const normalized = normalizeStatus(captureStatus);
  try {
    const { data, error } = await supabase
      .from("recap_training_examples")
      .update({
        capture_status: normalized,
        training_eligible: normalized === "included" ? true : normalized === "excluded" ? false : null,
        dataset_split: normalized === "included" ? null : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    if (!isMissingTrainingTable(error)) console.warn("[newsroom] training example review update failed", error.message);
    return null;
  }
}

function splitForSession(sessionId = "") {
  const hash = crypto.createHash("sha256").update(String(sessionId || "unknown-session")).digest();
  const bucket = hash[0] % 10;
  if (bucket < 7) return "train";
  if (bucket < 9) return "development";
  return "test";
}

export async function bulkAssignDatasetSplitsBySession() {
  const examples = await listExportableTrainingExamples({ requireSplit: false });
  if (!examples.length) return { updated: 0, sessions: 0 };

  const splitBySession = new Map();
  for (const example of examples) {
    const sessionKey = example.source_session_id || `no-session:${example.id}`;
    if (!splitBySession.has(sessionKey)) splitBySession.set(sessionKey, splitForSession(sessionKey));
  }

  let updated = 0;
  for (const [sessionKey, split] of splitBySession.entries()) {
    const matchingIds = examples
      .filter((example) => (example.source_session_id || `no-session:${example.id}`) === sessionKey)
      .map((example) => example.id);
    if (!matchingIds.length) continue;
    const { error } = await supabase
      .from("recap_training_examples")
      .update({ dataset_split: split, updated_at: new Date().toISOString() })
      .in("id", matchingIds);
    if (error) {
      if (!isMissingTrainingTable(error)) console.warn("[newsroom] bulk split assignment failed", error.message);
      continue;
    }
    updated += matchingIds.length;
  }

  return { updated, sessions: splitBySession.size };
}

export async function listTrainingExamples({ limit = 100 } = {}) {
  try {
    const { data, error } = await supabase
      .from("recap_training_examples")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (error) {
    if (!isMissingTrainingTable(error)) console.warn("[newsroom] training example list failed", error.message);
    return [];
  }
}

export async function listExportableTrainingExamples({ split = "", requireSplit = true } = {}) {
  let query = supabase
    .from("recap_training_examples")
    .select("*")
    .eq("capture_status", "included")
    .eq("training_eligible", true)
    .not("approved_output", "is", null)
    .order("approved_at", { ascending: false });
  if (requireSplit) query = query.not("dataset_split", "is", null);
  if (split) query = query.eq("dataset_split", normalizeSplit(split));

  const { data, error } = await query;
  if (error) {
    if (isMissingTrainingTable(error)) return [];
    throw new Error(error.message);
  }
  return data || [];
}

export function trainingMessagesForExample(example = {}) {
  return {
    messages: [
      {
        role: "system",
        content:
          "You are the Para Poker League newsroom writer. Use only supplied context facts. Write expressive player-facing league prose without inventing hands, results, quotes, table talk, emotions, rivalries, season outcomes, or standings movement.",
      },
      {
        role: "user",
        content: JSON.stringify({
          scope: example.scope,
          context_packet: example.context_packet,
        }),
      },
      {
        role: "assistant",
        content: JSON.stringify(example.approved_output || {}),
      },
    ],
    metadata: {
      source_hash: example.source_hash,
      scope: example.scope,
      dataset_split: example.dataset_split,
      source_id: rowSourceId(example),
    },
  };
}
