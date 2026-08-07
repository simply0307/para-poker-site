"use client";

import { useReducer } from "react";
import { rawHandImportStateReducer } from "@/lib/imports/rawHandImportUiState";

function defaultPlayedAt() {
  return new Date().toISOString().slice(0, 16);
}

function initialState(initialSeasonCode) {
  return {
    form: {
      sessionCode: "",
      seasonCode: initialSeasonCode,
      sessionNumber: "",
      tableName: "Imported Table",
      playedAt: defaultPlayedAt(),
      format: "Imported hand history",
      replaceExisting: false,
      pastedText: "",
    },
    file: null,
    preview: null,
    result: null,
    busy: "",
    error: "",
  };
}

function Checksum({ label, value }) {
  return (
    <div className="grid gap-1 border-t border-zinc-200 py-2 first:border-0">
      <dt className="text-xs font-black uppercase tracking-[0.1em] text-zinc-500">{label}</dt>
      <dd className="break-all font-mono text-[11px] text-zinc-700">{value || "-"}</dd>
    </div>
  );
}

export function RawHandImportPanel({ initialSeasonCode = "S0", existingSessions = [] }) {
  const [state, dispatch] = useReducer(rawHandImportStateReducer, initialSeasonCode, initialState);
  const { form, file, preview, result, busy, error } = state;
  const matchingSession = existingSessions.find(
    (session) => String(session.sessionCode || "").trim().toLowerCase() === form.sessionCode.trim().toLowerCase()
  );
  const previewReady = preview?.status === "ready" && preview?.validation?.valid;

  function update(field, value) {
    dispatch({ type: "field_changed", field, value });
  }

  async function runPreview() {
    dispatch({ type: "request_started", operation: "preview" });
    const body = new FormData();
    if (file) body.append("file", file, file.name);
    body.append("pastedText", form.pastedText);
    for (const field of ["sessionCode", "seasonCode", "sessionNumber", "tableName", "format"]) {
      body.append(field, form[field]);
    }
    body.append("playedAt", form.playedAt ? new Date(form.playedAt).toISOString() : "");
    body.append("replaceExisting", String(form.replaceExisting));
    try {
      const response = await fetch("/api/admin/imports/raw-hands/preview", { method: "POST", body });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Preview failed.");
      dispatch({ type: "preview_received", preview: payload.preview });
    } catch (requestError) {
      dispatch({ type: "request_failed", error: requestError.message });
    }
  }

  async function commitImport() {
    if (!previewReady) return;
    if (!window.confirm("Commit this exact immutable preview as live evidence?")) return;
    if (preview.replaceExisting && !window.confirm(
      `Confirm replacement of ${matchingSession?.sessionCode || form.sessionCode}. The session ID will remain stable, official results will be invalidated, and published session recap prose will become stale.`
    )) return;

    dispatch({ type: "request_started", operation: "commit" });
    try {
      const response = await fetch("/api/admin/imports/raw-hands/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          importId: preview.importId,
          previewChecksum: preview.previewChecksum,
          confirm: true,
          confirmReplace: Boolean(preview.replaceExisting),
          expectedCurrentEvidenceRevisionId: preview.expectedCurrentEvidenceRevisionId || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Commit failed.");
      dispatch({ type: "commit_received", result: payload.result });
    } catch (requestError) {
      dispatch({ type: "request_failed", error: requestError.message });
    }
  }

  return (
    <section className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Raw hand evidence</p>
          <h2 className="mt-1 text-2xl font-black">Preview exact bytes, then commit</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Preview stores the exact upload and a versioned canonical manifest. Commit can only use that stored import; changing any source or session setting requires a new preview.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={runPreview} disabled={Boolean(busy) || (!file && !form.pastedText)} className="rounded-sm border border-zinc-300 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] disabled:opacity-50">
            {busy === "preview" ? "Persisting preview" : "Create immutable preview"}
          </button>
          <button type="button" onClick={commitImport} disabled={Boolean(busy) || !previewReady} className="rounded-sm bg-zinc-950 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50">
            {busy === "commit" ? "Committing transaction" : preview?.replaceExisting ? "Commit replacement" : "Commit new session"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Session code</span>
          <input value={form.sessionCode} list="existing-session-codes" placeholder="S0-002" onChange={(event) => update("sessionCode", event.target.value)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          <datalist id="existing-session-codes">{existingSessions.map((session) => <option key={session.id} value={session.sessionCode} />)}</datalist>
        </label>
        <Input label="Season" value={form.seasonCode} onChange={(value) => update("seasonCode", value)} />
        <Input label="Session number (optional)" value={form.sessionNumber} onChange={(value) => update("sessionNumber", value)} placeholder="Auto" />
        <Input label="Table name" value={form.tableName} onChange={(value) => update("tableName", value)} />
        <Input label="Format" value={form.format} onChange={(value) => update("format", value)} />
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Played at</span>
          <input type="datetime-local" value={form.playedAt} onChange={(event) => update("playedAt", event.target.value)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
      </div>

      <div className={`mt-4 rounded-md border p-3 text-sm ${matchingSession ? "border-amber-300 bg-amber-50 text-amber-900" : "border-zinc-200 bg-zinc-50 text-zinc-600"}`}>
        {matchingSession ? (
          <>
            <p className="font-black">Existing session: {matchingSession.sessionCode}</p>
            <p className="mt-1">Evidence: {matchingSession.evidenceLabel}; {matchingSession.handsImported} hands and {matchingSession.actionRows} actions.</p>
            <label className="mt-3 flex items-center gap-2 font-bold">
              <input type="checkbox" checked={form.replaceExisting} onChange={(event) => update("replaceExisting", event.target.checked)} />
              Preview this upload as an explicit replacement of the current evidence.
            </label>
          </>
        ) : <p>This session code will create a new session. Replacement intent is rejected when no target exists.</p>}
      </div>

      <section className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Primary source: raw CSV file</p>
        <input type="file" accept=".csv,text/csv" className="mt-3 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm" onChange={(event) => dispatch({ type: "file_changed", file: event.target.files?.[0] || null })} />
        <p className="mt-2 text-sm text-zinc-600">{file ? `${file.name} · ${file.size.toLocaleString()} exact bytes selected. The file takes precedence over pasted text.` : "No file selected."}</p>
      </section>

      <label className="mt-4 grid gap-2">
        <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Fallback source: pasted text</span>
        <textarea value={form.pastedText} onChange={(event) => update("pastedText", event.target.value)} className="min-h-48 rounded-md border border-zinc-300 p-3 font-mono text-xs" placeholder="Used only when no file is selected. Stored as UTF-8 text/plain bytes and parsed as raw PokerNow-style hand history." />
      </label>

      {error ? <p className="mt-4 rounded-md bg-red-100 p-3 font-bold text-red-800">{error}</p> : null}
      {result ? (
        <div className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-black">Evidence committed: {result.sessionCode} · revision {result.revisionNumber}</p>
          <p className="mt-1">Session {result.sessionId}; revision {result.revisionId}. {Object.entries(result.insertedCounts || {}).map(([key, value]) => `${value} ${key}`).join(", ")}.</p>
          <p className="mt-2 font-bold">Official results still require operator review and approval.</p>
          <p className="mt-2 break-all font-mono text-[11px]">Preview checksum: {result.previewChecksum}</p>
        </div>
      ) : null}

      {preview ? <PreviewDetails preview={preview} /> : null}
    </section>
  );
}

function PreviewDetails({ preview }) {
  const validation = preview.validation || {};
  const hands = preview.representativeRows?.hands || [];
  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Stored preview</p>
        <p className="mt-2 font-black">{preview.sourceFilename} · {Number(preview.sourceSizeBytes || 0).toLocaleString()} bytes</p>
        <p className="text-sm text-zinc-600">{preview.sourceMediaType} · parser {preview.parserVersion}</p>
        <p className={`mt-3 rounded-md p-2 text-sm font-black ${preview.status === "ready" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>State: {preview.status}</p>
        <dl className="mt-3">
          <Checksum label="Source" value={preview.sourceChecksum} />
          <Checksum label="Metadata" value={preview.metadataChecksum} />
          <Checksum label="Manifest" value={preview.manifestChecksum} />
          <Checksum label="Validation" value={preview.validationReportChecksum} />
          <Checksum label="Combined preview" value={preview.previewChecksum} />
        </dl>
        <p className="mt-3 text-sm"><strong>Replacement target:</strong> {preview.targetSessionId || "none"}</p>
        <p className="text-sm"><strong>Current revision:</strong> {preview.currentRevisionNumber || (preview.targetSessionId ? "legacy unversioned" : "none")}</p>
        <dl className="mt-4 grid gap-1 text-sm">{Object.entries(preview.totals || {}).map(([key, value]) => <div key={key} className="flex justify-between gap-3"><dt>{key}</dt><dd className="font-bold">{value}</dd></div>)}</dl>
        {validation.errors?.length ? <MessageList title="Blocking errors" rows={validation.errors} tone="red" /> : null}
        {validation.warnings?.length ? <MessageList title="Warnings" rows={validation.warnings} tone="amber" /> : null}
      </aside>
      <div className="overflow-x-auto rounded-md border border-zinc-200">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-zinc-100 text-xs font-black uppercase tracking-[0.12em] text-zinc-500"><tr><th className="px-3 py-2">Hand</th><th className="px-3 py-2">Winner</th><th className="px-3 py-2">Pot</th><th className="px-3 py-2">BB</th><th className="px-3 py-2">Board</th></tr></thead>
          <tbody>{hands.map((hand) => <tr key={hand.clientHandId} className="border-t border-zinc-200"><td className="px-3 py-3 font-black">#{hand.handNo}</td><td className="px-3 py-3">{hand.winnerName || "-"}</td><td className="px-3 py-3">{hand.potCollected || "-"}</td><td className="px-3 py-3">{hand.potBb || "-"}</td><td className="px-3 py-3">{hand.board || "-"}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function MessageList({ title, rows, tone }) {
  return <div className={`mt-4 rounded-md p-3 text-sm ${tone === "red" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}><p className="font-black">{title}</p><ul className="mt-2 list-disc pl-4">{rows.map((row) => <li key={row}>{row}</li>)}</ul></div>;
}

function Input({ label, value, onChange, placeholder = "" }) {
  return <label className="grid gap-2"><span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">{label}</span><input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" /></label>;
}
