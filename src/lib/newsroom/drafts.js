import { supabase } from "@/lib/supabase";
import { getDraftTableConfig } from "@/lib/newsroom/draftTypes";
import {
  createTrainingExampleForDraft,
  recordApprovedOutputForDraft,
} from "@/lib/newsroom/trainingExamples";

const DRAFT_TABLE_REGISTRY = getDraftTableConfig();

const DRAFT_TABLE_SOURCE_COLUMNS = {
  recap_drafts: {
    providerColumn: "provider",
    hasScope: true,
    sourceColumns: {
      sourceSessionId: "source_session_id",
      sourcePlayerId: "source_player_id",
      articleRequest: "article_request",
    },
  },
  profile_drafts: {
    sourceColumns: { sourcePlayerId: "player_id" },
  },
  player_session_recap_drafts: {
    sourceColumns: { sourcePlayerId: "player_id", sourceSessionId: "session_id" },
  },
  standings_drafts: {
    sourceColumns: { seasonCode: "season_code" },
  },
  moment_blurb_drafts: {
    sourceColumns: { momentId: "moment_id" },
  },
  article_drafts: {
    sourceColumns: { articleRequest: "article_request" },
  },
  social_caption_drafts: {
    sourceColumns: { sourceSessionId: "session_id", sourcePlayerId: "player_id", seasonCode: "season_code", momentId: "moment_id", articleRequest: "article_request" },
  },
  private_note_drafts: {
    sourceColumns: { sourceSessionId: "session_id", sourcePlayerId: "player_id", seasonCode: "season_code", momentId: "moment_id", articleRequest: "article_request" },
  },
};

export const DRAFT_TABLES = Object.fromEntries(
  Object.entries(DRAFT_TABLE_REGISTRY).map(([table, config]) => [
    table,
    {
      ...config,
      ...(DRAFT_TABLE_SOURCE_COLUMNS[table] || {}),
    },
  ])
);

function arrayValue(value) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

export function normalizeDraftTable(value) {
  return DRAFT_TABLES[value]?.table || "recap_drafts";
}

function schemaCacheMessage(error) {
  return `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
}

function missingSchemaCacheColumn(error) {
  const value = schemaCacheMessage(error);
  if (!value.includes("pgrst204") && !value.includes("schema cache")) return "";
  const match = String(error?.message || "").match(/'([^']+)'\s+column/i);
  return match?.[1] || "";
}

function isSchemaCacheColumnError(error) {
  return Boolean(missingSchemaCacheColumn(error));
}

function isMissingOptionalGenerationColumn(error) {
  const value = schemaCacheMessage(error);
  return (
    value.includes("pgrst204") &&
    (value.includes("fallback_trace") ||
      value.includes("provider_used") ||
      value.includes("model_used") ||
      value.includes("generation_error") ||
      value.includes("provider"))
  );
}

function isMissingTable(error) {
  const value = schemaCacheMessage(error);
  return (
    value.includes("pgrst205") ||
    value.includes("42p01") ||
    value.includes("does not exist") ||
    (value.includes("schema cache") && value.includes("table"))
  );
}

function withDebugPacket(contextPacket, { provider, modelUsed, fallbackTrace, generationError }) {
  return {
    ...contextPacket,
    generation_debug: {
      provider_used: provider,
      model_used: modelUsed,
      fallback_trace: fallbackTrace,
      generation_error: generationError,
    },
  };
}

function baseDraftInsert({
  table = "recap_drafts",
  scope,
  sourceSessionId = null,
  sourcePlayerId = null,
  seasonCode = "S0",
  momentId = null,
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
  const tableConfig = DRAFT_TABLES[normalizeDraftTable(table)];
  const insert = {
    status: "draft",
    visibility: "admin",
    context_packet: withDebugPacket(contextPacket, { provider, modelUsed, fallbackTrace, generationError }),
    draft,
    provider_used: provider,
    model_used: modelUsed,
    fallback_trace: fallbackTrace,
    generation_error: generationError,
    generated_at: new Date().toISOString(),
  };

  if (tableConfig.hasScope) {
    insert.scope = scope;
    insert.confidence_notes = arrayValue(draft?.confidence_notes);
    insert.missing_data_warnings = arrayValue(draft?.missing_data_warnings);
    insert.provider = provider;
    insert.prompt_version = promptVersion;
    insert.source_data_version = sourceDataVersion;
  }

  const sources = tableConfig.sourceColumns || {};
  if (sources.sourceSessionId) insert[sources.sourceSessionId] = sourceSessionId;
  if (sources.sourcePlayerId) insert[sources.sourcePlayerId] = sourcePlayerId;
  if (sources.seasonCode) insert[sources.seasonCode] = seasonCode;
  if (sources.momentId && momentId) insert[sources.momentId] = momentId;
  if (sources.articleRequest) insert[sources.articleRequest] = articleRequest || {};

  return insert;
}

function removeOptionalGenerationColumns(insert) {
  const nextInsert = { ...insert };
  delete nextInsert.provider_used;
  delete nextInsert.fallback_trace;
  delete nextInsert.generation_error;
  if ("provider" in nextInsert && !("scope" in nextInsert)) delete nextInsert.provider;
  return nextInsert;
}

function shouldDropSchemaCacheColumn(column, payload) {
  if (!column || !(column in payload)) return false;
  return !["id", "draft", "context_packet"].includes(column);
}

async function insertSingleWithSchemaCacheFallback(table, insert) {
  let payload = { ...insert };
  const removedColumns = [];

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data, error } = await supabase.from(table).insert(payload).select("*").single();
    if (!error) {
      if (removedColumns.length) {
        console.warn("[newsroom] schema-cache insert fallback used", { table, removedColumns });
      }
      return { data, removedColumns };
    }

    const missingColumn = missingSchemaCacheColumn(error);
    if (shouldDropSchemaCacheColumn(missingColumn, payload)) {
      removedColumns.push(missingColumn);
      payload = { ...payload };
      delete payload[missingColumn];
      continue;
    }

    throw error;
  }

  throw new Error(`Could not insert ${table}; schema cache kept rejecting columns.`);
}

async function updateSingleWithSchemaCacheFallback(table, draftId, patch) {
  let payload = { ...patch };
  const removedColumns = [];

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq("id", draftId)
      .select("*")
      .single();

    if (!error) {
      if (removedColumns.length) {
        console.warn("[newsroom] schema-cache update fallback used", { table, removedColumns });
      }
      return { data, removedColumns };
    }

    const missingColumn = missingSchemaCacheColumn(error);
    if (shouldDropSchemaCacheColumn(missingColumn, payload)) {
      removedColumns.push(missingColumn);
      payload = { ...payload };
      delete payload[missingColumn];
      continue;
    }

    throw error;
  }

  throw new Error(`Could not update ${table}; schema cache kept rejecting columns.`);
}

async function upsertWithSchemaCacheFallback(table, payload, options) {
  let nextPayload = { ...payload };
  const removedColumns = [];

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { error } = await supabase.from(table).upsert(nextPayload, options);
    if (!error) {
      if (removedColumns.length) {
        console.warn("[newsroom] schema-cache upsert fallback used", { table, removedColumns });
      }
      return;
    }

    const missingColumn = missingSchemaCacheColumn(error);
    if (shouldDropSchemaCacheColumn(missingColumn, nextPayload)) {
      removedColumns.push(missingColumn);
      nextPayload = { ...nextPayload };
      delete nextPayload[missingColumn];
      continue;
    }

    throw error;
  }

  throw new Error(`Could not upsert ${table}; schema cache kept rejecting columns.`);
}

async function updateManyWithSchemaCacheFallback(table, patch, column, value) {
  let payload = { ...patch };
  const removedColumns = [];

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { error } = await supabase.from(table).update(payload).eq(column, value);
    if (!error) {
      if (removedColumns.length) {
        console.warn("[newsroom] schema-cache bulk update fallback used", { table, removedColumns });
      }
      return;
    }

    const missingColumn = missingSchemaCacheColumn(error);
    if (shouldDropSchemaCacheColumn(missingColumn, payload)) {
      removedColumns.push(missingColumn);
      payload = { ...payload };
      delete payload[missingColumn];
      continue;
    }

    throw error;
  }

  throw new Error(`Could not update ${table}; schema cache kept rejecting columns.`);
}

function fallbackInputForRecapDraft(input, originalTable) {
  const tableConfig = DRAFT_TABLES[originalTable] || {};
  const articleRequest = {
    ...(input.articleRequest || {}),
    fallback_from_table: originalTable,
  };

  if (input.seasonCode) articleRequest.seasonCode = input.seasonCode;
  if (input.momentId) articleRequest.momentId = input.momentId;

  return {
    ...input,
    table: "recap_drafts",
    scope: input.scope || tableConfig.fallbackScope || "article",
    articleRequest,
  };
}

export async function logGeneration({
  scope,
  sourceId = "",
  providerUsed = "",
  modelUsed = "",
  fallbackTrace = [],
  generationError = "",
}) {
  const insert = {
    scope,
    source_id: sourceId,
    provider_used: providerUsed,
    model_used: modelUsed,
    fallback_trace: fallbackTrace,
    generation_error: generationError,
  };

  try {
    await insertSingleWithSchemaCacheFallback("generation_logs", insert);
  } catch (error) {
    if (!isMissingTable(error) && !isSchemaCacheColumnError(error)) {
      console.warn("[newsroom] generation log failed", error.message);
    }
  }
}

export async function saveNewsroomDraft(input) {
  const table = normalizeDraftTable(input.table);
  const insert = baseDraftInsert({ ...input, table });

  try {
    const { data } = await insertSingleWithSchemaCacheFallback(table, insert);
    await createTrainingExampleForDraft({
      draftRow: data,
      draftTable: table,
      scope: input.scope,
      sourceSessionId: input.sourceSessionId,
      sourcePlayerId: input.sourcePlayerId,
      seasonCode: input.seasonCode,
      momentId: input.momentId,
      contextPacket: insert.context_packet,
      originalOutput: input.draft,
      provider: input.provider,
      modelUsed: input.modelUsed,
      promptVersion: input.promptVersion,
      sourceDataVersion: input.sourceDataVersion,
    });
    await logGeneration({
      scope: input.scope,
      sourceId: input.sourceSessionId || input.sourcePlayerId || input.seasonCode || input.momentId || "",
      providerUsed: input.provider,
      modelUsed: input.modelUsed,
      fallbackTrace: input.fallbackTrace || [],
      generationError: input.generationError || "",
    });
    return { ...data, _draft_table: table };
  } catch (error) {
    if (isMissingOptionalGenerationColumn(error)) {
      const { data: retryData } = await insertSingleWithSchemaCacheFallback(table, removeOptionalGenerationColumns(insert));
      await createTrainingExampleForDraft({
        draftRow: retryData,
        draftTable: table,
        scope: input.scope,
        sourceSessionId: input.sourceSessionId,
        sourcePlayerId: input.sourcePlayerId,
        seasonCode: input.seasonCode,
        momentId: input.momentId,
        contextPacket: insert.context_packet,
        originalOutput: input.draft,
        provider: input.provider,
        modelUsed: input.modelUsed,
        promptVersion: input.promptVersion,
        sourceDataVersion: input.sourceDataVersion,
      });
      await logGeneration({
        scope: input.scope,
        sourceId: input.sourceSessionId || input.sourcePlayerId || input.seasonCode || input.momentId || "",
        providerUsed: input.provider,
        modelUsed: input.modelUsed,
        fallbackTrace: input.fallbackTrace || [],
        generationError: input.generationError || "",
      });
      return { ...retryData, _draft_table: table };
    }

    if (table !== "recap_drafts" && isMissingTable(error)) {
      console.warn("[newsroom] draft table missing from schema cache; falling back to recap_drafts", {
        table,
        message: error.message,
      });
      return saveNewsroomDraft(fallbackInputForRecapDraft(input, table));
    }

    throw new Error(error.message);
  }
}

export async function saveRecapDraft(input) {
  return saveNewsroomDraft({ ...input, table: "recap_drafts" });
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
  return data ? { ...data, _draft_table: "recap_drafts" } : null;
}

export async function updateDraft(table, draftId, patch) {
  const cleanTable = normalizeDraftTable(table);
  const nextDraft = patch.draft || {};
  const update = {
    draft: nextDraft,
    status: patch.status || "draft",
    visibility: patch.visibility || "admin",
  };
  const tableConfig = DRAFT_TABLES[cleanTable] || {};
  if (tableConfig.sourceColumns?.articleRequest && patch.articleRequest) {
    update[tableConfig.sourceColumns.articleRequest] = patch.articleRequest;
  }

  if (cleanTable === "recap_drafts") {
    update.confidence_notes = arrayValue(nextDraft.confidence_notes);
    update.missing_data_warnings = arrayValue(nextDraft.missing_data_warnings);
  }

  const { data } = await updateSingleWithSchemaCacheFallback(cleanTable, draftId, update);
  return { ...data, _draft_table: cleanTable };
}

export async function updateRecapDraft(draftId, patch) {
  return updateDraft("recap_drafts", draftId, patch);
}

export async function listNewsroomDrafts({
  table = "recap_drafts",
  fallbackScope = "",
  sourcePlayerId = "",
  sourceSessionId = "",
  seasonCode = "",
  momentId = "",
  visibility = "",
  limit = 50,
} = {}) {
  const cleanTable = normalizeDraftTable(table);
  const rows = [];

  async function runList(tableName, tableConfig = DRAFT_TABLES[tableName] || {}, scope = "") {
    let query = supabase.from(tableName).select("*").order("generated_at", { ascending: false }).limit(limit);
    const sources = tableConfig.sourceColumns || {};

    if (tableName === "recap_drafts" && scope) query = query.eq("scope", scope);
    if (sourcePlayerId && sources.sourcePlayerId) query = query.eq(sources.sourcePlayerId, sourcePlayerId);
    if (sourceSessionId && sources.sourceSessionId) query = query.eq(sources.sourceSessionId, sourceSessionId);
    if (seasonCode && sources.seasonCode) query = query.eq(sources.seasonCode, seasonCode);
    if (momentId && sources.momentId) query = query.eq(sources.momentId, momentId);
    if (visibility) query = query.eq("visibility", visibility);

    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data || []).map((row) => ({ ...row, _draft_table: tableName })));
  }

  try {
    await runList(cleanTable, DRAFT_TABLES[cleanTable], fallbackScope);
  } catch (error) {
    if (!isMissingTable(error) && !isSchemaCacheColumnError(error)) {
      console.warn("[newsroom] draft list failed", { table: cleanTable, message: error.message });
    }
  }

  if (cleanTable !== "recap_drafts" && fallbackScope) {
    try {
      await runList("recap_drafts", DRAFT_TABLES.recap_drafts, fallbackScope);
    } catch (error) {
      if (!isMissingTable(error) && !isSchemaCacheColumnError(error)) {
        console.warn("[newsroom] fallback draft list failed", { scope: fallbackScope, message: error.message });
      }
    }
  }

  const unique = new Map();
  for (const row of rows) {
    unique.set(`${row._draft_table}:${row.id}`, row);
  }

  return [...unique.values()]
    .sort((left, right) => new Date(right.generated_at || right.created_at || 0) - new Date(left.generated_at || left.created_at || 0))
    .slice(0, limit);
}

export async function getLatestNewsroomDraft(options = {}) {
  const rows = await listNewsroomDrafts({ ...options, limit: 1 });
  return rows[0] || null;
}

export async function listArticleDrafts(limit = 50) {
  return listNewsroomDrafts({ table: "article_drafts", fallbackScope: "article", visibility: "published", limit });
}

export async function deleteDraft(table, draftId) {
  const cleanTable = normalizeDraftTable(table);

  if (cleanTable === "article_drafts") {
    try {
      await supabase.from("published_articles").delete().eq("draft_id", draftId);
    } catch (error) {
      if (!isMissingTable(error) && !isSchemaCacheColumnError(error)) {
        console.warn("[newsroom] published article mirror delete failed", error.message);
      }
    }
  }

  const { data, error } = await supabase.from(cleanTable).delete().eq("id", draftId).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { ...data, _draft_table: cleanTable } : null;
}

function articleSlug(row) {
  const explicit = row?.article_request?.slug || row?.draft?.slug;
  if (explicit) return String(explicit).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  return String(row?.id || crypto.randomUUID());
}

async function upsertPublishedArticle(row, scope) {
  const title = row?.draft?.headline || row?.draft?.title || "Published Para League article";
  try {
    await upsertWithSchemaCacheFallback(
      "published_articles",
      {
        draft_id: row.id,
        scope,
        slug: articleSlug(row),
        title,
        body: row.draft || {},
        published_at: row.published_at || new Date().toISOString(),
        unpublished_at: row.unpublished_at || null,
      },
      { onConflict: "draft_id" }
    );
    return "";
  } catch (error) {
    if (!isMissingTable(error)) {
      console.warn("[newsroom] published article upsert failed", error.message);
      return `Published draft saved, but published_articles mirror failed: ${error.message}`;
    }
    return `Published draft saved, but published_articles is not available: ${error.message}`;
  }
}

async function unpublishArticle(row) {
  if (!row?.id) return;
  try {
    await updateManyWithSchemaCacheFallback("published_articles", { unpublished_at: new Date().toISOString() }, "draft_id", row.id);
  } catch (error) {
    if (!isMissingTable(error)) {
      console.warn("[newsroom] published article unpublish failed", error.message);
    }
  }
}

export async function setDraftPublishStateForTable(table, draftId, { publish, approvedBy = "admin" }) {
  const cleanTable = normalizeDraftTable(table);
  const now = new Date().toISOString();
  const patch = publish
    ? {
        status: "approved",
        visibility: "published",
        published_at: now,
        unpublished_at: null,
      }
    : {
        visibility: "admin",
        unpublished_at: now,
      };

  if (cleanTable === "recap_drafts" && publish) {
    patch.approved_by = approvedBy;
    patch.approved_at = now;
  }

  const { data } = await updateSingleWithSchemaCacheFallback(cleanTable, draftId, patch);
  const warnings = [];

  if (publish) {
    await recordApprovedOutputForDraft(cleanTable, data, approvedBy);
  }

  if (cleanTable === "article_drafts") {
    if (publish) {
      const warning = await upsertPublishedArticle(data, "article");
      if (warning) warnings.push(warning);
    }
    else await unpublishArticle(data);
  }

  return { ...data, _draft_table: cleanTable, _publish_warnings: warnings };
}

export async function setDraftPublishState(draftId, options) {
  return setDraftPublishStateForTable("recap_drafts", draftId, options);
}
