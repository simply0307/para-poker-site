"use client";

import { useCallback, useMemo, useState } from "react";
import { PromptConfigPicker } from "@/components/admin-newsroom/PromptConfigPicker";
import { RichTextEditor } from "@/components/admin-newsroom/RichTextEditor";
import { getPromptPreset } from "@/lib/newsroom/promptConfigs";
import styles from "./SessionRecapDraftEditor.module.css";

const emptyDraft = {
  headline: "",
  subheadline: "",
  recap_body: "",
  key_moments: [],
  player_blurbs: [],
  confidence_notes: [],
  missing_data_warnings: [],
};

const defaultPromptConfig = getPromptPreset("official_session_recap");

function normalizeDraft(row) {
  return row?.draft && typeof row.draft === "object" ? row.draft : emptyDraft;
}

function listToText(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function textToList(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseJsonList(value, fallback) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function traceRows(row) {
  if (Array.isArray(row?.fallback_trace)) return row.fallback_trace;
  if (Array.isArray(row?.context_packet?.generation_debug?.fallback_trace)) {
    return row.context_packet.generation_debug.fallback_trace;
  }
  return [];
}

function editorialDocs(row) {
  return Array.isArray(row?.context_packet?.editorial_docs?.manifest)
    ? row.context_packet.editorial_docs.manifest
    : [];
}

function magicGuide(row) {
  return row?.context_packet?.session_recap_magic_guide || null;
}

function storyPlan(row) {
  return row?.context_packet?.story_plan && typeof row.context_packet.story_plan === "object"
    ? row.context_packet.story_plan
    : null;
}

export function SessionRecapDraftEditor({ sessionKey, initialDraft, variationOptions = [] }) {
  const [draftRow, setDraftRow] = useState(initialDraft || null);
  const [draft, setDraft] = useState(normalizeDraft(initialDraft));
  const [selectedVariation, setSelectedVariation] = useState(
    initialDraft?.context_packet?.selected_variation?.key || variationOptions[0]?.key || "turning_point_led"
  );
  const [promptConfig, setPromptConfig] = useState(initialDraft?.context_packet?.prompt_config || defaultPromptConfig);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const handlePromptConfigChange = useCallback((nextConfig) => {
    setPromptConfig(nextConfig);
  }, []);

  const generatedMeta = useMemo(() => {
    if (!draftRow) return "No draft generated yet.";
    return [
      draftRow.provider ? `Provider: ${draftRow.provider}` : "",
      draftRow.model_used ? `Model: ${draftRow.model_used}` : "",
      draftRow.generated_at ? `Generated: ${new Date(draftRow.generated_at).toLocaleString()}` : "",
      draftRow.visibility ? `Visibility: ${draftRow.visibility}` : "",
    ].filter(Boolean).join(" / ");
  }, [draftRow]);

  function updateField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleGenerate() {
    setBusy("generate");
    setNotice("");
    setError("");

    const response = await fetch("/api/recaps/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sessionKey, variation: selectedVariation, editorialNotes: "", promptConfig }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const trace = Array.isArray(payload.fallbackTrace) && payload.fallbackTrace.length
        ? `\n\nFallback trace:\n${payload.fallbackTrace.map((item) => `${item.model}: ${item.message}`).join("\n")}`
        : "";
      setError(`${payload.error || "Could not generate draft."}${trace}`);
      setBusy("");
      return;
    }

    setDraftRow(payload.draft);
    setDraft(normalizeDraft(payload.draft));
    setNotice("Draft generated and saved for editorial review.");
    setBusy("");
  }

  async function handleSave() {
    if (!draftRow?.id) {
      setError("Generate a draft before saving edits.");
      return;
    }

    setBusy("save");
    setNotice("");
    setError("");

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
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.error || "Could not save draft edits.");
      setBusy("");
      return;
    }

    setDraftRow(payload.draft);
    setDraft(normalizeDraft(payload.draft));
    setNotice("Draft edits saved.");
    setBusy("");
  }

  async function handlePublish(action) {
    if (!draftRow?.id) {
      setError("Generate a draft before changing publish state.");
      return;
    }

    setBusy(action);
    setNotice("");
    setError("");

    const response = await fetch(`/api/admin/recap-drafts/${draftRow.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, table: draftRow._draft_table || "recap_drafts" }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.error || "Could not update publish state.");
      setBusy("");
      return;
    }

    setDraftRow(payload.draft);
    setDraft(normalizeDraft(payload.draft));
    const warnings = Array.isArray(payload.warnings) && payload.warnings.length ? ` ${payload.warnings.join(" ")}` : "";
    setNotice(`${action === "publish" ? "Draft published to the public session route." : "Draft unpublished."}${warnings}`);
    setBusy("");
  }

  return (
    <section className={styles.editor} aria-label="Session recap draft editor">
      <div className={styles.header}>
        <div>
          <span className={styles.kicker}>Newsroom MVP</span>
          <h2>Public session recap draft</h2>
          <p>
            Generate an editable recap from structured league data. Nothing publishes automatically.
          </p>
        </div>
        <button type="button" onClick={handleGenerate} disabled={Boolean(busy)} className={styles.primaryButton}>
          {busy === "generate" ? "Generating..." : "Generate Public Session Recap Draft"}
        </button>
      </div>

      {variationOptions.length ? (
        <section className={styles.variationPanel}>
          <span>Draft variation</span>
          <div className={styles.variationButtons}>
            {variationOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className={selectedVariation === option.key ? styles.variationActive : ""}
                onClick={() => setSelectedVariation(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className={styles.variationNotes}>
            {variationOptions.map((option) => (
              <p key={option.key}>
                <strong>{option.label}:</strong> {option.instruction}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <PromptConfigPicker defaultPreset="official_session_recap" onChange={handlePromptConfigChange} />

      <div className={styles.meta}>{generatedMeta}</div>
      {draftRow ? <AdminDebugPanel draftRow={draftRow} /> : null}
      {notice ? <p className={styles.notice}>{notice}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Headline</span>
          <input value={draft.headline || ""} onChange={(event) => updateField("headline", event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Subheadline</span>
          <input value={draft.subheadline || ""} onChange={(event) => updateField("subheadline", event.target.value)} />
        </label>
        <div className={styles.full}>
          <RichTextEditor label="Recap body" value={draft.recap_body || ""} onChange={(nextValue) => updateField("recap_body", nextValue)} />
        </div>
        <JsonTextarea
          key={`key-moments-${draftRow?.id || "new"}`}
          label="Key moments JSON"
          value={draft.key_moments || []}
          onChange={(nextValue) => updateField("key_moments", nextValue)}
        />
        <JsonTextarea
          key={`player-blurbs-${draftRow?.id || "new"}`}
          label="Player blurbs JSON"
          value={draft.player_blurbs || []}
          onChange={(nextValue) => updateField("player_blurbs", nextValue)}
        />
        <label className={styles.field}>
          <span>Confidence notes</span>
          <textarea
            rows={6}
            value={listToText(draft.confidence_notes)}
            onChange={(event) => updateField("confidence_notes", textToList(event.target.value))}
          />
        </label>
        <label className={styles.field}>
          <span>Missing data warnings</span>
          <textarea
            rows={6}
            value={listToText(draft.missing_data_warnings)}
            onChange={(event) => updateField("missing_data_warnings", textToList(event.target.value))}
          />
        </label>
      </div>

      <div className={styles.actions}>
        <button type="button" onClick={handleSave} disabled={Boolean(busy) || !draftRow?.id}>
          {busy === "save" ? "Saving..." : "Save Draft"}
        </button>
        <button type="button" onClick={() => handlePublish("publish")} disabled={Boolean(busy) || !draftRow?.id}>
          {busy === "publish" ? "Publishing..." : "Publish"}
        </button>
        <button type="button" onClick={() => handlePublish("unpublish")} disabled={Boolean(busy) || !draftRow?.id}>
          {busy === "unpublish" ? "Unpublishing..." : "Unpublish"}
        </button>
      </div>
    </section>
  );
}

function AdminDebugPanel({ draftRow }) {
  const rows = traceRows(draftRow);
  const docs = editorialDocs(draftRow);
  const guide = magicGuide(draftRow);
  const plan = storyPlan(draftRow);
  const promptConfig = draftRow.context_packet?.prompt_config || null;
  const promptInstructions = draftRow.context_packet?.prompt_config_instructions || null;

  return (
    <details className={styles.debugPanel}>
      <summary>Generation debug</summary>
      <div className={styles.debugGrid}>
        <DebugItem label="Provider used" value={draftRow.provider_used || draftRow.provider || "-"} />
        <DebugItem label="Model used" value={draftRow.model_used || draftRow.context_packet?.generation_debug?.model_used || "-"} />
        <DebugItem label="Status" value={draftRow.status || "-"} />
        <DebugItem label="Variation" value={draftRow.context_packet?.selected_variation?.label || draftRow.context_packet?.selected_variation?.key || "-"} />
        <DebugItem label="Voice mode" value={draftRow.context_packet?.prompt_config?.voiceMode || "-"} />
        <DebugItem label="Intensity" value={draftRow.context_packet?.prompt_config?.intensity || "-"} />
      </div>
      {draftRow.generation_error ? <p className={styles.debugError}>{draftRow.generation_error}</p> : null}
      {docs.length ? (
        <div className={styles.docsList}>
          <span>Editorial docs included</span>
          <ul>
            {docs.map((doc) => (
              <li key={doc.id}>
                <strong>{doc.id}</strong>
                <small>{doc.included ? `${doc.charCount} chars` : doc.error || "not included"}</small>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={styles.debugMuted}>No editorial docs manifest saved for this draft.</p>
      )}
      {guide ? (
        <div className={styles.docsList}>
          <span>Session magic guide</span>
          <ul>
            <li>
              <strong>{guide.id}</strong>
              <small>{guide.included ? `${guide.charCount} chars` : guide.error || "not included"}</small>
            </li>
          </ul>
        </div>
      ) : (
        <p className={styles.debugMuted}>No session magic guide saved for this draft.</p>
      )}
      {plan ? (
        <div className={styles.storyPlan}>
          <span>Story plan</span>
          <pre>{JSON.stringify(plan, null, 2)}</pre>
        </div>
      ) : (
        <p className={styles.debugMuted}>No story plan saved for this draft.</p>
      )}
      {promptConfig ? (
        <div className={styles.storyPlan}>
          <span>Prompt config</span>
          <pre>{JSON.stringify({ prompt_config: promptConfig, prompt_config_instructions: promptInstructions }, null, 2)}</pre>
        </div>
      ) : (
        <p className={styles.debugMuted}>No prompt config saved for this draft.</p>
      )}
      {rows.length ? (
        <ol className={styles.traceList}>
          {rows.map((item, index) => (
            <li key={`${item.model || "model"}-${index}`}>
              <strong>{item.model || "Unknown model"}</strong>
              <span>{item.status || "attempt"}</span>
              <p>{item.message || "No message."}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.debugMuted}>No fallback trace saved for this draft.</p>
      )}
    </details>
  );
}

function DebugItem({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function JsonTextarea({ label, value, onChange }) {
  const [raw, setRaw] = useState(JSON.stringify(value || [], null, 2));
  const [jsonError, setJsonError] = useState("");

  function handleChange(nextRaw) {
    setRaw(nextRaw);
    const parsed = parseJsonList(nextRaw, null);
    if (!parsed) {
      setJsonError("Use a JSON array.");
      return;
    }
    setJsonError("");
    onChange(parsed);
  }

  return (
    <label className={styles.field}>
      <span>{label}</span>
      <textarea rows={8} value={raw} onChange={(event) => handleChange(event.target.value)} />
      {jsonError ? <small className={styles.inlineError}>{jsonError}</small> : null}
    </label>
  );
}
