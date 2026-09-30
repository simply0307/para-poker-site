"use client";

import { useMemo, useState } from "react";

function defaults(seasonCode) {
  return { sessionCode: "", seasonCode, sessionNumber: "", tableName: "", playedAt: "", format: "Gauntlet authoritative match", replaceExisting: false };
}

export function GauntletMatchImportPanel({ initialSeasonCode = "S0", leaguePlayers = [] }) {
  const [form, setForm] = useState(() => defaults(initialSeasonCode));
  const [file, setFile] = useState(null);
  const [sourceOverview, setSourceOverview] = useState(null);
  const [participantMappings, setParticipantMappings] = useState({});
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const mappingJson = useMemo(() => JSON.stringify(participantMappings), [participantMappings]);
  const unresolved = preview?.validation?.unresolvedPlayerMappings || [];
  const ready = preview?.status === "ready" && preview?.validation?.valid;

  function invalidate() {
    setPreview(null);
    setResult(null);
    setError("");
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    invalidate();
  }

  async function chooseFile(selected) {
    setFile(selected);
    setSourceOverview(null);
    invalidate();
    if (!selected) return;
    try {
      const value = JSON.parse(await selected.text());
      setSourceOverview({
        schemaVersion: value.schemaVersion,
        matchId: value.match?.matchId,
        mode: value.match?.mode,
        startedAt: value.match?.startedAt,
        completedAt: value.match?.completedAt,
        participants: value.participants || [],
        winnerPlayerNum: value.results?.winnerPlayerNum,
        evidenceCount: value.evidence?.entries?.length || 0,
        producer: value.source?.producerId,
        storage: value.source?.storage,
      });
    } catch {
      setError("The selected file is not valid JSON.");
    }
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
      const response = await fetch("/api/admin/imports/gauntlet-matches/preview", { method: "POST", body });
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
    if (!ready || !window.confirm("Commit this exact Gauntlet match as a league evidence revision?")) return;
    if (preview.replaceExisting && !window.confirm("Confirm replacement of the current evidence revision?")) return;
    setBusy("commit");
    setError("");
    try {
      const response = await fetch("/api/admin/imports/gauntlet-matches/commit", {
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
    <section className="mb-8 rounded-lg border border-indigo-300 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-700">Authoritative Gauntlet evidence</p>
          <h2 className="mt-1 text-2xl font-black">Import gauntlet.para-match.v2</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">Validates the producer, record/evidence versions, explicit outcomes, contiguous event ledger, timestamps, final checksum, and stable content hash. Exact source bytes are retained; canonical league rows are written only after explicit commit.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={!file || Boolean(busy)} onClick={createPreview} className="rounded-sm border border-zinc-300 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] disabled:opacity-50">{busy === "preview" ? "Persisting preview" : "Create immutable preview"}</button>
          <button type="button" disabled={!ready || Boolean(busy)} onClick={commit} className="rounded-sm bg-indigo-800 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50">{busy === "commit" ? "Committing" : "Commit Gauntlet evidence"}</button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Field label="League session code" value={form.sessionCode} onChange={(value) => update("sessionCode", value)} placeholder="Defaults to Gauntlet match ID" />
        <Field label="Season" value={form.seasonCode} onChange={(value) => update("seasonCode", value)} />
        <Field label="Session number (optional)" value={form.sessionNumber} onChange={(value) => update("sessionNumber", value)} placeholder="Auto" />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="grid gap-2"><span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Gauntlet v2 export</span><input type="file" accept=".json,application/json" onChange={(event) => chooseFile(event.target.files?.[0] || null)} className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm" /><span className="text-xs text-zinc-500">{file ? `${file.name} · ${file.size.toLocaleString()} exact bytes` : "No export selected."}</span></label>
        <label className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold"><input type="checkbox" checked={form.replaceExisting} onChange={(event) => update("replaceExisting", event.target.checked)} /> Explicit replacement preview</label>
      </div>

      {sourceOverview ? <SourceOverview value={sourceOverview} /> : null}
      {unresolved.length ? (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4">
          <p className="font-black text-amber-900">Map account-backed Gauntlet identities, then create a new preview</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {unresolved.map((row) => <label key={row.sourcePlayerId} className="grid gap-1 text-sm"><span className="font-bold">{row.displayName} · {row.identityType}<span className="block font-mono text-xs text-zinc-500">{row.gauntletAccountId || row.sourcePlayerId}</span></span><select value={participantMappings[row.sourcePlayerId] || ""} onChange={(event) => { setParticipantMappings((current) => ({ ...current, [row.sourcePlayerId]: event.target.value })); invalidate(); }} className="rounded-md border border-zinc-300 bg-white px-3 py-2"><option value="">Choose a stable league player ID</option>{leaguePlayers.map((player) => <option key={player.id} value={player.id}>{player.display_name} · {player.id}</option>)}</select></label>)}
          </div>
        </div>
      ) : null}
      {error ? <p className="mt-4 rounded-md bg-red-100 p-3 font-bold text-red-800">{error}</p> : null}
      {preview ? <Preview value={preview} /> : null}
      {result ? <p className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm font-black text-emerald-900">Committed {result.sessionCode} as evidence revision {result.revisionNumber}{result.idempotent ? " (idempotent retry)" : ""}.</p> : null}
    </section>
  );
}

function SourceOverview({ value }) {
  return <div className="mt-4 rounded-md border border-indigo-200 bg-indigo-50 p-4 text-sm"><p className="font-black">{value.schemaVersion} · {value.matchId}</p><p className="mt-1">{value.mode} · {value.evidenceCount} ordered evidence rows · winner player {value.winnerPlayerNum ?? "draw"}</p><p className="mt-1 text-xs text-zinc-600">{value.startedAt} → {value.completedAt} · producer {value.producer} · storage {value.storage?.completeRecordV2 || "unknown"}</p><ul className="mt-3 grid gap-2 md:grid-cols-2">{value.participants.map((participant) => <li key={participant.participantId} className="rounded border border-indigo-100 bg-white p-2"><span className="font-black">P{participant.playerNum} · {participant.displayName}</span><span className="block text-xs text-zinc-600">{participant.identityType} · {participant.faction?.name} · {participant.result} · life {participant.finalLife}</span></li>)}</ul></div>;
}

function Preview({ value }) {
  const rows = value.representativeRows || {};
  return <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><p className="font-black">Stored preview · {value.status}</p><p>{Object.entries(value.totals || {}).map(([key, count]) => `${count} ${key}`).join(" · ")}</p></div><p className="mt-2 break-all font-mono text-[11px]">Source SHA-256: {value.sourceChecksum}</p><p className={`mt-2 font-bold ${value.sourceMatchPreviouslyImported ? "text-amber-800" : "text-emerald-800"}`}>Source match: {value.sourceMatchPreviouslyImported ? `previously imported as session ${value.previousImport?.sessionId}` : "not previously imported"}</p>{value.validation?.warnings?.length ? <ul className="mt-2 list-disc pl-5 text-amber-800">{value.validation.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}{value.validation?.errors?.length ? <ul className="mt-2 list-disc pl-5 font-bold text-red-800">{value.validation.errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}<p className="mt-3 font-bold">{(rows.actions || []).length} representative ordered actions and {(rows.sessionResults || []).length} mapped authoritative result rows are ready for review.</p></div>;
}

function Field({ label, value, onChange, placeholder = "" }) {
  return <label className="grid gap-2"><span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">{label}</span><input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" /></label>;
}
