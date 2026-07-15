"use client";

import { useCallback, useState } from "react";
import { AdminShell } from "@/components/admin-newsroom/AdminShell";
import { ArticleContextSelector } from "@/components/admin-newsroom/ArticleContextSelector";
import { PromptConfigPicker } from "@/components/admin-newsroom/PromptConfigPicker";
import { RichTextEditor } from "@/components/admin-newsroom/RichTextEditor";
import {
  getDraftDefaultPayload,
  getDraftEditorConfig,
  getDraftType,
  getDraftTypeByEndpoint,
  getDraftTypeByTable,
  getDraftVariationOptions,
  mergeDraftPayload,
} from "@/lib/newsroom/draftTypes";
import { getPromptPreset } from "@/lib/newsroom/promptConfigs";

function pretty(value) {
  return JSON.stringify(value || {}, null, 2);
}

function parseJson(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return null;
  }
}

function bodyFieldFor(draft = {}, editorConfig = {}) {
  const fields = [
    editorConfig.bodyField,
    ...(editorConfig.richTextFields || []),
    "recap_body",
    "profile_body",
    "article_body",
    "caption",
    "long_body",
    "body",
  ].filter(Boolean);
  return fields.find((field) => typeof draft?.[field] === "string") || fields[0] || "";
}

function titleFieldFor(draft = {}, editorConfig = {}) {
  if (editorConfig.titleField) return editorConfig.titleField;
  if (typeof draft?.headline === "string") return "headline";
  if (typeof draft?.title === "string") return "title";
  return "headline";
}

function mergePayload(current, patch) {
  const next = { ...(current || {}) };
  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === "object" && !Array.isArray(value) && next[key] && typeof next[key] === "object" && !Array.isArray(next[key])) {
      next[key] = mergePayload(next[key], value);
    } else {
      next[key] = value;
    }
  }
  return next;
}

function patchMatchesPayload(payload = {}, patch = {}) {
  return Object.entries(patch || {}).every(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) return patchMatchesPayload(payload[key] || {}, value);
    return String(payload[key] || "") === String(value || "");
  });
}

function PayloadSelectionPanel({ title = "Source selector", options = [], payload = {}, onSelect }) {
  const [query, setQuery] = useState("");
  if (!options.length) return null;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter((option) =>
        [option.label, option.description, option.id]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery)
      )
    : options;

  return (
    <section className="mt-8 rounded-lg border border-zinc-300 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Draft target</p>
          <h2 className="text-2xl font-black">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Pick a source to update the generation payload. The JSON remains editable below.
          </p>
        </div>
        <p className="text-sm font-bold text-zinc-500">
          {filteredOptions.length} of {options.length} options
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Filter draft targets</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by hand, player, winner, contender, pot, or session..."
            className="w-full rounded-md border border-zinc-300 px-3 py-2.5 text-sm"
          />
        </label>
        {query ? (
          <button type="button" onClick={() => setQuery("")} className="rounded-md border border-zinc-300 px-3 py-2.5 text-sm font-black">
            Clear
          </button>
        ) : null}
      </div>
      <div className="mt-4 max-h-[28rem] overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-3">
        {filteredOptions.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredOptions.map((option) => {
              const active = patchMatchesPayload(payload, option.patch || {});
              return (
                <button
                  key={option.id || option.label}
                  type="button"
                  onClick={() => onSelect(option.patch || {})}
                  className={`rounded-md border bg-white p-3 text-left transition ${
                    active ? "border-amber-700 bg-amber-50" : "border-zinc-200 hover:border-amber-700 hover:bg-amber-50"
                  }`}
                >
                  <span className="block font-black text-zinc-950">{option.label}</span>
                  {option.description ? <span className="mt-1 block text-sm leading-6 text-zinc-600">{option.description}</span> : null}
                  {active ? <span className="mt-2 inline-block rounded-sm bg-amber-700 px-2 py-1 text-xs font-black uppercase tracking-wide text-white">Selected</span> : null}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="p-4 text-sm font-bold text-zinc-500">No draft targets match that filter.</p>
        )}
      </div>
    </section>
  );
}

export function GenericDraftWorkspace({
  draftType = "",
  title,
  endpoint,
  defaultPayload = {},
  variationOptions = [],
  defaultPromptPreset = "",
  existingDrafts = [],
  existingDraftsTitle = "Existing drafts",
  initialDraft = null,
  preface = null,
  articleContextOptions = null,
  payloadOptions = [],
  payloadOptionsTitle = "Source selector",
}) {
  const endpointDraftType = endpoint ? getDraftTypeByEndpoint(endpoint)?.key : "";
  const initialTableDraftType = initialDraft?._draft_table ? getDraftTypeByTable(initialDraft._draft_table)?.key : "";
  const resolvedDraftTypeKey = draftType || endpointDraftType || initialTableDraftType || "";
  const registry = getDraftType(resolvedDraftTypeKey);
  const workspaceEndpoint = endpoint || registry?.endpoint;
  const resolvedDefaultPayload = resolvedDraftTypeKey
    ? getDraftDefaultPayload(resolvedDraftTypeKey, defaultPayload)
    : defaultPayload;
  const editorConfig = getDraftEditorConfig(resolvedDraftTypeKey);
  const resolvedVariationOptions = variationOptions.length ? variationOptions : getDraftVariationOptions(resolvedDraftTypeKey);
  const resolvedDefaultPromptPreset = defaultPromptPreset || registry?.defaultPromptPreset || "official_session_recap";
  const [payloadText, setPayloadText] = useState(pretty(resolvedDefaultPayload));
  const [promptConfig, setPromptConfig] = useState(
    resolvedDefaultPayload.promptConfig ||
      resolvedDefaultPayload.articleRequest?.promptConfig ||
      getPromptPreset(resolvedDefaultPromptPreset)
  );
  const [draftRow, setDraftRow] = useState(initialDraft);
  const [draftText, setDraftText] = useState(initialDraft?.draft ? pretty(initialDraft.draft) : "{}");
  const [drafts, setDrafts] = useState(() => {
    if (!initialDraft?.id) return existingDrafts;
    return [initialDraft, ...existingDrafts.filter((row) => row.id !== initialDraft.id || row._draft_table !== initialDraft._draft_table)];
  });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const currentPayload = parseJson(payloadText) || {};
  const currentDraft = parseJson(draftText) || {};
  const bodyField = bodyFieldFor(currentDraft, editorConfig);
  const titleField = titleFieldFor(currentDraft, editorConfig);
  const isArticleWorkspace = editorConfig.supportsAuthor || workspaceEndpoint === "/api/articles/generate" || draftRow?._draft_table === "article_drafts" || Boolean(currentPayload.articleRequest);
  const selectedVariation = currentPayload.variation || currentPayload.variationKey || currentPayload.articleRequest?.variation || "";

  function chooseVariation(variationKey) {
    const payload = parseJson(payloadText) || {};
    setPayloadText(pretty({ ...payload, variation: variationKey }));
  }

  function patchPayload(patch) {
    setPayloadText((currentText) => pretty(mergePayload(parseJson(currentText) || {}, patch)));
  }

  const handleArticleContextChange = useCallback(({ topic, authorName, displayDate, contextSelection }) => {
    setPayloadText((currentText) => {
      const payload = parseJson(currentText) || {};
      const next = mergePayload(payload, {
        articleRequest: {
          ...(payload.articleRequest || {}),
          topic,
          authorName,
          displayDate,
          contextSelection,
        },
      });
      return pretty(next);
    });
  }, [setPayloadText]);

  async function generateDraft() {
    const payload = parseJson(payloadText);
    if (!payload) {
      setError("Payload must be valid JSON.");
      return;
    }
    const requestPayload = {
      ...payload,
      promptConfig,
      articleRequest: payload.articleRequest ? { ...payload.articleRequest, promptConfig } : payload.articleRequest,
    };

    setBusy("generate");
    setError("");
    setMessage("");

    if (!workspaceEndpoint) {
      setError("This draft type does not have a generation endpoint configured.");
      return;
    }

    const response = await fetch(workspaceEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error || "Generation failed.");
      setBusy("");
      return;
    }

    setDraftRow(result.draft);
    setDraftText(pretty(result.draft?.draft));
    setDrafts((current) => [result.draft, ...current.filter((row) => row.id !== result.draft?.id)]);
    setMessage("Draft generated.");
    setBusy("");
  }

  async function saveDraft() {
    if (!draftRow?.id) {
      setError("Generate a draft before saving.");
      return;
    }
    const draft = parseJson(draftText);
    if (!draft) {
      setError("Draft JSON is invalid.");
      return;
    }

    setBusy("save");
    setError("");
    setMessage("");

    const response = await fetch(`/api/admin/recap-drafts/${draftRow.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table: draftRow._draft_table || "recap_drafts",
        draft,
        articleRequest: currentPayload.articleRequest,
        status: draftRow.status || "draft",
        visibility: draftRow.visibility || "admin",
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error || "Save failed.");
      setBusy("");
      return;
    }

    setDraftRow(result.draft);
    setDraftText(pretty(result.draft?.draft));
    setDrafts((current) => current.map((row) => (row.id === result.draft?.id ? result.draft : row)));
    setMessage("Draft saved.");
    setBusy("");
  }

  function loadDraft(row) {
    setDraftRow(row);
    setDraftText(pretty(row?.draft));
    if (row?.article_request) {
      setPayloadText(pretty(mergeDraftPayload(resolvedDefaultPayload, {
        variation: row.article_request?.variation || defaultPayload.variation || "",
        articleRequest: row.article_request,
      })));
    }
    setMessage(`Loaded draft: ${row?.draft?.headline || row?.draft?.title || row?.id}`);
    setError("");
  }

  function updateBody(nextValue) {
    if (!bodyField) return;
    setDraftText(pretty({ ...(parseJson(draftText) || {}), [bodyField]: nextValue }));
  }

  function updateDraftField(field, value) {
    setDraftText(pretty({ ...(parseJson(draftText) || {}), [field]: value }));
  }

  function updateArticleRequestField(field, value) {
    setPayloadText((currentText) => {
      const payload = parseJson(currentText) || {};
      return pretty({
        ...payload,
        articleRequest: {
          ...(payload.articleRequest || {}),
          [field]: value,
        },
      });
    });
  }

  function updateAuthor(value) {
    updateDraftField("author", value);
    updateArticleRequestField("authorName", value);
  }

  function updateDisplayDate(value) {
    updateArticleRequestField("displayDate", value);
  }

  async function setPublishState(action) {
    if (!draftRow?.id) {
      setError("Generate a draft before publishing.");
      return;
    }

    setBusy(action);
    setError("");
    setMessage("");

    const response = await fetch(`/api/admin/recap-drafts/${draftRow.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, table: draftRow._draft_table || "recap_drafts" }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error || "Publish state failed.");
      setBusy("");
      return;
    }

    setDraftRow(result.draft);
    setDrafts((current) => current.map((row) => (row.id === result.draft?.id ? result.draft : row)));
    const warnings = Array.isArray(result.warnings) && result.warnings.length ? ` ${result.warnings.join(" ")}` : "";
    setMessage(`${action === "publish" ? "Draft published." : "Draft unpublished."}${warnings}`);
    setBusy("");
  }

  async function setRowPublishState(row, action) {
    if (!row?.id) return;

    setBusy(`${action}-${row.id}`);
    setError("");
    setMessage("");

    const response = await fetch(`/api/admin/recap-drafts/${row.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, table: row._draft_table || "recap_drafts" }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error || "Publish state failed.");
      setBusy("");
      return;
    }

    setDrafts((current) => current.map((item) => (item.id === result.draft?.id ? result.draft : item)));
    if (draftRow?.id === result.draft?.id) setDraftRow(result.draft);
    const warnings = Array.isArray(result.warnings) && result.warnings.length ? ` ${result.warnings.join(" ")}` : "";
    setMessage(`${action === "publish" ? "Draft published." : "Draft unpublished."}${warnings}`);
    setBusy("");
  }

  async function handleDelete() {
    if (!draftRow?.id) {
      setError("Load or generate a draft before deleting.");
      return;
    }
    const confirmed = window.confirm("Delete this draft? This cannot be undone.");
    if (!confirmed) return;

    setBusy("delete");
    setError("");
    setMessage("");

    const table = draftRow._draft_table || "recap_drafts";
    const response = await fetch(`/api/admin/recap-drafts/${draftRow.id}?table=${encodeURIComponent(table)}`, {
      method: "DELETE",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error || "Delete failed.");
      setBusy("");
      return;
    }

    setDrafts((current) => current.filter((row) => row.id !== draftRow.id));
    setDraftRow(null);
    setDraftText("{}");
    setMessage("Draft deleted.");
    setBusy("");
  }

  async function deleteRow(row) {
    if (!row?.id) return;
    const confirmed = window.confirm("Delete this draft? This cannot be undone.");
    if (!confirmed) return;

    setBusy(`delete-${row.id}`);
    setError("");
    setMessage("");

    const table = row._draft_table || "recap_drafts";
    const response = await fetch(`/api/admin/recap-drafts/${row.id}?table=${encodeURIComponent(table)}`, {
      method: "DELETE",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error || "Delete failed.");
      setBusy("");
      return;
    }

    setDrafts((current) => current.filter((item) => item.id !== row.id));
    if (draftRow?.id === row.id) {
      setDraftRow(null);
      setDraftText("{}");
    }
    setMessage("Draft deleted.");
    setBusy("");
  }

  return (
    <AdminShell
      title={title}
      description="Generate a draft, inspect context and docs, edit JSON, save, publish, or unpublish."
    >
      {preface ? <div className="mb-8">{preface}</div> : null}

      {articleContextOptions ? (
        <div className="mb-8">
          <ArticleContextSelector
            key={draftRow?.id || "new-article-context"}
            options={articleContextOptions}
            initialValue={currentPayload.articleRequest || currentPayload}
            onChange={handleArticleContextChange}
          />
        </div>
      ) : null}

      <PayloadSelectionPanel title={payloadOptionsTitle} options={payloadOptions} payload={currentPayload} onSelect={patchPayload} />

      {drafts.length ? (
        <section className="rounded-lg border border-zinc-300 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Draft library</p>
              <h2 className="text-2xl font-black">{existingDraftsTitle}</h2>
            </div>
            <p className="text-sm font-bold text-zinc-500">{drafts.length} saved</p>
          </div>
          <div className="mt-4 grid gap-3">
            {drafts.map((row) => {
              const headline = row.draft?.headline || row.draft?.title || row.article_request?.topic || "Untitled draft";
              const active = draftRow?.id === row.id;
              const coverageTarget = row.article_request?.coverageTarget || row.context_packet?.coverage_target || null;
              return (
                <article key={`${row._draft_table || "draft"}-${row.id}`} className={`rounded-md border p-4 ${active ? "border-amber-600 bg-amber-50" : "border-zinc-200 bg-zinc-50"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black">{headline}</h3>
                      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
                        {(row._draft_table || "recap_drafts").replace(/_/g, " ")} / {row.visibility || "admin"} / {row.status || "draft"}
                      </p>
                      {coverageTarget?.role ? (
                        <p className="mt-1 text-sm font-bold text-amber-700">
                          Covers {coverageTarget.role}: {coverageTarget.playerName || coverageTarget.player_name || "target pending"}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm text-zinc-600">{row.generated_at ? new Date(row.generated_at).toLocaleString() : "Date pending"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => loadDraft(row)} className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-black text-white">
                        {active ? "Loaded" : "Edit"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRowPublishState(row, row.visibility === "published" ? "unpublish" : "publish")}
                        disabled={Boolean(busy)}
                        className="rounded-md bg-amber-600 px-3 py-2 text-sm font-black text-white disabled:opacity-50"
                      >
                        {row.visibility === "published" ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRow(row)}
                        disabled={Boolean(busy)}
                        className="rounded-md border border-red-300 px-3 py-2 text-sm font-black text-red-700 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {resolvedVariationOptions.length ? (
        <section className="mt-8 rounded-lg border border-zinc-300 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Draft variation</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {resolvedVariationOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`rounded-md border px-3 py-2 text-sm font-black ${
                  selectedVariation === option.key ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-300 bg-white text-zinc-800"
                }`}
                onClick={() => chooseVariation(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {resolvedVariationOptions.map((option) => (
              <p key={option.key} className="rounded-md bg-zinc-100 p-3 text-sm leading-6 text-zinc-700">
                <strong className="text-zinc-950">{option.label}:</strong> {option.instruction}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-8">
        <PromptConfigPicker defaultPreset={resolvedDefaultPromptPreset} onChange={setPromptConfig} />
      </div>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <label className="grid gap-2">
          <span className="font-black">Generation payload</span>
          <textarea className="min-h-64 rounded-lg border border-zinc-300 p-3 font-mono text-sm" value={payloadText} onChange={(event) => setPayloadText(event.target.value)} />
        </label>
        <label className="grid gap-2">
          <span className="font-black">Editable draft JSON</span>
          <textarea className="min-h-64 rounded-lg border border-zinc-300 p-3 font-mono text-sm" value={draftText} onChange={(event) => setDraftText(event.target.value)} />
        </label>
      </section>

      <section className="mt-6 rounded-lg border border-zinc-300 bg-white p-4 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Editable display fields</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <TextInput
            label="Title"
            value={currentDraft[titleField] || ""}
            onChange={(value) => updateDraftField(titleField, value)}
          />
          <TextInput
            label="Subheadline"
            value={currentDraft.subheadline || ""}
            onChange={(value) => updateDraftField("subheadline", value)}
          />
          {isArticleWorkspace ? (
            <>
              <TextInput
                label="Author"
                value={currentDraft.author || currentDraft.byline || currentPayload.articleRequest?.authorName || currentPayload.articleRequest?.author_name || ""}
                onChange={updateAuthor}
              />
              <TextInput
                label="Display date"
                type="date"
                value={currentPayload.articleRequest?.displayDate || currentPayload.articleRequest?.display_date || ""}
                onChange={updateDisplayDate}
              />
              <TextInput
                label="Article slug"
                value={currentPayload.articleRequest?.slug || currentDraft.slug || ""}
                onChange={(value) => {
                  updateDraftField("slug", value);
                  updateArticleRequestField("slug", value);
                }}
              />
            </>
          ) : null}
        </div>
      </section>

      {bodyField ? (
        <div className="mt-6">
          <RichTextEditor label={`Editable ${bodyField}`} value={currentDraft[bodyField] || ""} onChange={updateBody} />
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button className="rounded-md bg-zinc-950 px-4 py-3 font-black text-white disabled:opacity-50" onClick={generateDraft} disabled={Boolean(busy)}>
          {busy === "generate" ? "Generating..." : "Generate Draft"}
        </button>
        <button className="rounded-md bg-zinc-700 px-4 py-3 font-black text-white disabled:opacity-50" onClick={saveDraft} disabled={Boolean(busy) || !draftRow?.id}>
          Save Draft
        </button>
        <button className="rounded-md bg-amber-600 px-4 py-3 font-black text-white disabled:opacity-50" onClick={() => setPublishState("publish")} disabled={Boolean(busy) || !draftRow?.id}>
          Publish
        </button>
        <button className="rounded-md border border-zinc-400 px-4 py-3 font-black disabled:opacity-50" onClick={() => setPublishState("unpublish")} disabled={Boolean(busy) || !draftRow?.id}>
          Unpublish
        </button>
        <button className="rounded-md border border-red-300 px-4 py-3 font-black text-red-700 disabled:opacity-50" onClick={handleDelete} disabled={Boolean(busy) || !draftRow?.id}>
          {busy === "delete" ? "Deleting..." : "Delete Draft"}
        </button>
      </div>

      {message ? <p className="mt-4 rounded-md bg-green-100 p-3 font-bold text-green-800">{message}</p> : null}
      {error ? <p className="mt-4 rounded-md bg-red-100 p-3 font-bold text-red-800">{error}</p> : null}

      {draftRow ? (
        <details className="mt-6 rounded-lg border border-zinc-300 bg-white p-4">
          <summary className="cursor-pointer font-black">Context packet and generation debug</summary>
          <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap text-xs">{pretty({
            provider: draftRow.provider_used || draftRow.provider,
            model: draftRow.model_used,
            variation: draftRow.context_packet?.selected_variation?.label || draftRow.context_packet?.selected_variation?.key,
            prompt_config: draftRow.context_packet?.prompt_config,
            prompt_config_instructions: draftRow.context_packet?.prompt_config_instructions,
            article_type: draftRow.context_packet?.article_request?.articleType,
            article_context_selection: draftRow.context_packet?.article_context_selection,
            selected_article_context: draftRow.context_packet?.selected_article_context,
            season_context: draftRow.context_packet?.season_context,
            warnings: draftRow.context_packet?.warnings || draftRow.context_packet?.selected_article_context?.warnings,
            fallback_trace: draftRow.fallback_trace || draftRow.context_packet?.generation_debug?.fallback_trace,
            docs: draftRow.context_packet?.editorial_docs?.manifest,
            context_packet: draftRow.context_packet,
          })}</pre>
        </details>
      ) : null}
    </AdminShell>
  );
}

function TextInput({ label, value, onChange, type = "text" }) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      <input
        type={type}
        className="rounded-md border border-zinc-300 p-2.5 text-sm"
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
