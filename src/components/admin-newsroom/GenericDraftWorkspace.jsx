"use client";

import { useState } from "react";
import { AdminShell } from "@/components/admin-newsroom/AdminShell";
import { PromptConfigPicker } from "@/components/admin-newsroom/PromptConfigPicker";
import { RichTextEditor } from "@/components/admin-newsroom/RichTextEditor";
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

function bodyFieldFor(draft = {}) {
  return ["recap_body", "profile_body", "article_body", "caption", "long_body", "body"].find((field) => typeof draft?.[field] === "string") || "";
}

export function GenericDraftWorkspace({
  title,
  endpoint,
  defaultPayload = {},
  variationOptions = [],
  defaultPromptPreset = "official_session_recap",
  existingDrafts = [],
  existingDraftsTitle = "Existing drafts",
  initialDraft = null,
  preface = null,
}) {
  const [payloadText, setPayloadText] = useState(pretty(defaultPayload));
  const [promptConfig, setPromptConfig] = useState(defaultPayload.promptConfig || defaultPayload.articleRequest?.promptConfig || getPromptPreset(defaultPromptPreset));
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
  const bodyField = bodyFieldFor(currentDraft);
  const selectedVariation = currentPayload.variation || currentPayload.variationKey || currentPayload.articleRequest?.variation || "";

  function chooseVariation(variationKey) {
    const payload = parseJson(payloadText) || {};
    setPayloadText(pretty({ ...payload, variation: variationKey }));
  }

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

    const response = await fetch(endpoint, {
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
      setPayloadText(pretty({
        ...defaultPayload,
        variation: row.article_request?.variation || defaultPayload.variation || "",
        articleRequest: row.article_request,
      }));
    }
    setMessage(`Loaded draft: ${row?.draft?.headline || row?.draft?.title || row?.id}`);
    setError("");
  }

  function updateBody(nextValue) {
    if (!bodyField) return;
    setDraftText(pretty({ ...(parseJson(draftText) || {}), [bodyField]: nextValue }));
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

  return (
    <AdminShell
      title={title}
      description="Generate a draft, inspect context and docs, edit JSON, save, publish, or unpublish."
    >
      {preface ? <div className="mb-8">{preface}</div> : null}

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
              return (
                <article key={`${row._draft_table || "draft"}-${row.id}`} className={`rounded-md border p-4 ${active ? "border-amber-600 bg-amber-50" : "border-zinc-200 bg-zinc-50"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black">{headline}</h3>
                      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-zinc-500">
                        {(row._draft_table || "recap_drafts").replace(/_/g, " ")} / {row.visibility || "admin"} / {row.status || "draft"}
                      </p>
                      <p className="mt-1 text-sm text-zinc-600">{row.generated_at ? new Date(row.generated_at).toLocaleString() : "Date pending"}</p>
                    </div>
                    <button type="button" onClick={() => loadDraft(row)} className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-black text-white">
                      {active ? "Loaded" : "Edit"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {variationOptions.length ? (
        <section className="mt-8 rounded-lg border border-zinc-300 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Draft variation</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {variationOptions.map((option) => (
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
            {variationOptions.map((option) => (
              <p key={option.key} className="rounded-md bg-zinc-100 p-3 text-sm leading-6 text-zinc-700">
                <strong className="text-zinc-950">{option.label}:</strong> {option.instruction}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-8">
        <PromptConfigPicker defaultPreset={defaultPromptPreset} onChange={setPromptConfig} />
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
            season_context: draftRow.context_packet?.season_context,
            fallback_trace: draftRow.fallback_trace || draftRow.context_packet?.generation_debug?.fallback_trace,
            docs: draftRow.context_packet?.editorial_docs?.manifest,
            context_packet: draftRow.context_packet,
          })}</pre>
        </details>
      ) : null}
    </AdminShell>
  );
}
