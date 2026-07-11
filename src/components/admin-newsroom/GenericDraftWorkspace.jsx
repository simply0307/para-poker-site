"use client";

import { useState } from "react";
import { AdminShell } from "@/components/admin-newsroom/AdminShell";

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

export function GenericDraftWorkspace({ title, endpoint, defaultPayload = {}, variationOptions = [] }) {
  const [payloadText, setPayloadText] = useState(pretty(defaultPayload));
  const [draftRow, setDraftRow] = useState(null);
  const [draftText, setDraftText] = useState("{}");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const currentPayload = parseJson(payloadText) || {};
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

    setBusy("generate");
    setError("");
    setMessage("");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error || "Generation failed.");
      setBusy("");
      return;
    }

    setDraftRow(result.draft);
    setDraftText(pretty(result.draft?.draft));
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
    setMessage("Draft saved.");
    setBusy("");
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
    const warnings = Array.isArray(result.warnings) && result.warnings.length ? ` ${result.warnings.join(" ")}` : "";
    setMessage(`${action === "publish" ? "Draft published." : "Draft unpublished."}${warnings}`);
    setBusy("");
  }

  return (
    <AdminShell
      title={title}
      description="Generate a draft, inspect context and docs, edit JSON, save, publish, or unpublish."
    >

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
