"use client";

import { useMemo, useState } from "react";

function defaultForm(seasonCode) {
  return {
    sessionCode: "",
    seasonCode,
    sessionNumber: "",
    tableName: "",
    playedAt: "",
    format: "EGGS authoritative heads-up",
    replaceExisting: false,
  };
}

export function EggsSessionImportPanel({ initialSeasonCode = "S0", existingSessions = [], leaguePlayers = [] }) {
  const [form, setForm] = useState(() => defaultForm(initialSeasonCode));
  const [file, setFile] = useState(null);
  const [mappings, setMappings] = useState({});
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const matchingSession = existingSessions.find((session) => session.sessionCode?.toLowerCase() === form.sessionCode.trim().toLowerCase());
  const unresolved = preview?.validation?.unresolvedPlayerMappings || [];
  const previewReady = preview?.status === "ready" && preview?.validation?.valid;
  const mappingJson = useMemo(() => JSON.stringify(mappings), [mappings]);

  function invalidate() {
    setPreview(null);
    setResult(null);
    setError("");
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    invalidate();
  }

  async function createPreview() {
    if (!file) return;
    setBusy("preview");
    setError("");
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file, file.name);
      for (const field of ["sessionCode", "seasonCode", "sessionNumber", "tableName", "playedAt", "format"]) body.append(field, form[field]);
      body.append("replaceExisting", String(form.replaceExisting));
      body.append("participantMappings", mappingJson);
      const response = await fetch("/api/admin/imports/eggs-sessions/preview", { method: "POST", body });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Preview failed.");
      setPreview(payload.preview);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy("");
    }
  }

  async function commit() {
    if (!previewReady || !window.confirm("Commit this exact EGGS authority package as a league evidence revision?")) return;
    if (preview.replaceExisting && !window.confirm("Confirm replacement of the current evidence revision?")) return;
    setBusy("commit");
    setError("");
    try {
      const response = await fetch("/api/admin/imports/eggs-sessions/commit", {
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
      setResult(payload.result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="mb-8 rounded-lg border border-emerald-300 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Authoritative EGGS evidence</p>
          <h2 className="mt-1 text-2xl font-black">Import completed-session JSON directly</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            This lane accepts only para-completed-session-v2 from durable EGGS authority. It validates the package checksum and typed public events, requires stable league-player IDs, stores exact bytes, and commits only the stored preview.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={!file || Boolean(busy)} onClick={createPreview} className="rounded-sm border border-zinc-300 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] disabled:opacity-50">
            {busy === "preview" ? "Persisting preview" : "Create immutable preview"}
          </button>
          <button type="button" disabled={!previewReady || Boolean(busy)} onClick={commit} className="rounded-sm bg-emerald-800 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50">
            {busy === "commit" ? "Committing transaction" : "Commit authority evidence"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Field label="League session code" value={form.sessionCode} onChange={(value) => update("sessionCode", value)} placeholder="Defaults to source match" />
        <Field label="Season" value={form.seasonCode} onChange={(value) => update("seasonCode", value)} />
        <Field label="Session number (optional)" value={form.sessionNumber} onChange={(value) => update("sessionNumber", value)} placeholder="Auto" />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Completed-session package</span>
          <input type="file" accept=".json,application/json" onChange={(event) => { setFile(event.target.files?.[0] || null); invalidate(); }} className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm" />
          <span className="text-xs text-zinc-500">{file ? `${file.name} · ${file.size.toLocaleString()} exact bytes` : "No package selected."}</span>
        </label>
        <div className={`rounded-md border p-3 text-sm ${matchingSession ? "border-amber-300 bg-amber-50" : "border-zinc-200 bg-zinc-50"}`}>
          <p className="font-black">{matchingSession ? `Existing session: ${matchingSession.sessionCode}` : "New evidence session"}</p>
          <label className="mt-2 flex items-center gap-2 font-bold">
            <input type="checkbox" checked={form.replaceExisting} onChange={(event) => update("replaceExisting", event.target.checked)} />
            Explicit replacement preview
          </label>
        </div>
      </div>

      {unresolved.length ? (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4">
          <p className="font-black text-amber-900">Resolve source identities, then create a new preview</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {unresolved.map((row) => (
              <label key={row.sourcePlayerId} className="grid gap-1 text-sm">
                <span className="font-bold">{row.displayName} <span className="font-mono text-xs text-zinc-500">{row.sourcePlayerId}</span></span>
                <select value={mappings[row.sourcePlayerId] || ""} onChange={(event) => { setMappings((current) => ({ ...current, [row.sourcePlayerId]: event.target.value })); setResult(null); setError(""); }} className="rounded-md border border-zinc-300 bg-white px-3 py-2">
                  <option value="">Choose a stable league player ID</option>
                  {leaguePlayers.map((player) => <option key={player.id} value={player.id}>{player.display_name} · {player.id}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-4 rounded-md bg-red-100 p-3 font-bold text-red-800">{error}</p> : null}
      {preview ? <Preview preview={preview} /> : null}
      {result ? (
        <div className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-black">Committed {result.sessionCode} as evidence revision {result.revisionNumber}{result.idempotent ? " (idempotent retry)" : ""}.</p>
          <p className="mt-1">{Object.entries(result.insertedCounts || {}).map(([key, value]) => `${value} ${key}`).join(", ")}</p>
        </div>
      ) : null}
    </section>
  );
}

function Preview({ preview }) {
  const rows = preview.representativeRows || {};
  const factionEvents = (rows.publicEvents || []).filter((event) => event.type === "factionAbilityUsed" || event.type === "factionAbilityEffectApplied");
  return (
    <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm">
      <div className="flex flex-wrap justify-between gap-2">
        <p className="font-black">Stored preview · {preview.status}</p>
        <p>{Object.entries(preview.totals || {}).map(([key, value]) => `${value} ${key}`).join(" · ")}</p>
      </div>
      <p className="mt-2 break-all font-mono text-[11px]">Package bytes SHA-256: {preview.sourceChecksum}</p>
      <p className="break-all font-mono text-[11px]">Immutable preview SHA-256: {preview.previewChecksum}</p>
      <p className={`mt-2 font-bold ${preview.sourceMatchPreviouslyImported ? "text-amber-800" : "text-emerald-800"}`}>
        Source match: {preview.sourceMatchPreviouslyImported ? `previously imported as session ${preview.previousImport?.sessionId}` : "not previously imported"}
      </p>
      {preview.validation?.errors?.length ? <ul className="mt-3 list-disc pl-5 font-bold text-red-800">{preview.validation.errors.map((message) => <li key={message}>{message}</li>)}</ul> : null}
      <p className="mt-2 font-bold">Results remain awaiting operator approval; no result can be entered or changed in this import lane.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <EvidenceList title="Hands" rows={(rows.hands || []).map((hand) => `#${hand.handNo} · ${hand.winnerName} · pot ${hand.potCollected} · ${hand.completionReason}`)} />
        <EvidenceList title="Ordered actions" rows={(rows.actions || []).map((action) => `#${action.handNo}.${action.logOrder} · ${action.playerName} ${action.action} ${action.amount} · target ${action.targetContribution}`)} />
        <EvidenceList title="Authoritative results" rows={(rows.sessionResults || []).map((result) => `${result.finish}. ${result.playerName} · stack ${result.finalStack} · pending approval`)} />
        <EvidenceList title="Player-session statistics" rows={(rows.playerSessionStats || []).map((stat) => `${stat.playerName} · ${stat.hands} hands · ${stat.handsWon} won · ${stat.totalCollected} collected`)} />
        <EvidenceList title="Faction evidence" rows={factionEvents.map((event) => `${event.sequenceNumber} · ${event.type} · ${event.eventId}`)} />
      </div>
    </div>
  );
}

function EvidenceList({ title, rows }) {
  return <section className="rounded-md border border-zinc-200 bg-white p-3"><h3 className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">{title}</h3>{rows.length ? <ul className="mt-2 space-y-1 font-mono text-xs">{rows.map((row) => <li key={row}>{row}</li>)}</ul> : <p className="mt-2 text-xs text-zinc-500">None</p>}</section>;
}

function Field({ label, value, onChange, placeholder = "" }) {
  return <label className="grid gap-2"><span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">{label}</span><input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" /></label>;
}
