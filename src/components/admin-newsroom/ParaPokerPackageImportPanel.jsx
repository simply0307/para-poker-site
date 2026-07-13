"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const stateLabels = {
  uploaded: "Uploaded",
  validating: "Validating",
  invalid: "Invalid",
  "needs-mapping": "Needs mapping",
  ready: "Ready",
  imported: "Imported",
  duplicate: "Duplicate",
  failed: "Failed",
};

function emptyForm() {
  return {
    packageJson: "",
    fileName: "",
    participantMapping: {},
  };
}

function statusClass(state) {
  if (state === "ready" || state === "imported") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (state === "needs-mapping" || state === "duplicate") return "border-amber-300 bg-amber-50 text-amber-800";
  if (state === "invalid" || state === "failed") return "border-rose-300 bg-rose-50 text-rose-800";
  return "border-zinc-300 bg-zinc-50 text-zinc-700";
}

export function ParaPokerPackageImportPanel() {
  const [form, setForm] = useState(emptyForm);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const state = preview?.state || "uploaded";
  const canCommit = preview?.state === "ready" && !preview?.migrationMissing;

  const participantMapping = useMemo(() => form.participantMapping || {}, [form.participantMapping]);

  function update(patch) {
    setForm((current) => ({ ...current, ...patch }));
    setError("");
    setResult(null);
  }

  function updateMapping(seatId, patch) {
    update({
      participantMapping: {
        ...participantMapping,
        [seatId]: {
          ...(participantMapping[seatId] || {}),
          ...patch,
        },
      },
    });
  }

  async function runPreview(nextForm = form) {
    setBusy("preview");
    setError("");
    setResult(null);
    const response = await fetch("/api/admin/imports/parapoker/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextForm),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Preview failed.");
      setBusy("");
      return null;
    }
    setPreview(payload.preview);
    if (payload.preview?.participantMapping) {
      setForm((current) => ({
        ...current,
        participantMapping: payload.preview.participantMapping,
      }));
    }
    setBusy("");
    return payload.preview;
  }

  async function applyMappingAndPreview() {
    await runPreview(form);
  }

  async function commitImport() {
    if (!window.confirm("Commit this completed-session package to Supabase as imported evidence?")) return;
    setBusy("commit");
    setError("");
    const response = await fetch("/api/admin/imports/parapoker/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Commit failed.");
      setBusy("");
      return;
    }
    setResult(payload.result);
    setBusy("");
    await runPreview(form);
  }

  return (
    <section className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Versioned package import</p>
          <h2 className="mt-1 text-2xl font-black">Import completed ParaPoker session</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Upload or paste a completed-session JSON package from the official client. Validation and commit run server-side.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em] ${statusClass(state)}`}>
            {stateLabels[state] || state}
          </span>
          <button type="button" onClick={() => runPreview()} disabled={Boolean(busy) || !form.packageJson.trim()} className="rounded-sm border border-zinc-300 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] disabled:opacity-50">
            {busy === "preview" ? "Validating" : "Validate"}
          </button>
          <button type="button" onClick={commitImport} disabled={Boolean(busy) || !canCommit} className="rounded-sm bg-zinc-950 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50">
            {busy === "commit" ? "Committing" : "Commit Import"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="grid gap-4">
          <section className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">JSON upload</p>
            <input
              type="file"
              accept=".json,application/json"
              className="mt-3 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const packageJson = await file.text();
                const nextForm = { ...form, packageJson, fileName: file.name };
                setForm(nextForm);
                setPreview(null);
                setResult(null);
                setError("");
                await runPreview(nextForm);
              }}
            />
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              {form.fileName ? `Loaded ${form.fileName}. ` : ""}
              Upload does not publish or commit records until the explicit commit step.
            </p>
          </section>

          <label className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Paste package JSON</span>
            <textarea
              value={form.packageJson}
              onChange={(event) => update({ packageJson: event.target.value })}
              className="min-h-72 rounded-md border border-zinc-300 p-3 font-mono text-xs"
              placeholder="{ ... completed session package ... }"
            />
          </label>
        </aside>

        <div className="grid gap-4">
          {error ? <p className="rounded-md bg-rose-100 p-3 font-bold text-rose-800">{error}</p> : null}
          {preview?.migrationMissing ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
              The SQL migration/RPC is not installed yet. Apply <code>sql/20260713_game_session_imports.sql</code> before committing imports.
            </p>
          ) : null}
          {result ? (
            <p className="rounded-md bg-emerald-100 p-3 font-bold text-emerald-800">
              Import {result.status}. {result.sessionCode ? (
                <Link className="underline" href={`/sessions/${encodeURIComponent(result.sessionCode)}`}>Open {result.sessionCode}</Link>
              ) : null}
            </p>
          ) : null}

          {preview ? <PreviewSummary preview={preview} /> : <EmptyPreview />}
          {preview?.participants?.length ? (
            <ParticipantMapping
              participants={preview.participants}
              mapping={participantMapping}
              onChange={updateMapping}
              onRefresh={applyMappingAndPreview}
              busy={busy}
            />
          ) : null}
          {preview?.normalized ? <NormalizedPreview normalized={preview.normalized} /> : null}
        </div>
      </div>
    </section>
  );
}

function EmptyPreview() {
  return (
    <section className="rounded-md border border-dashed border-zinc-300 p-5">
      <h3 className="text-xl font-black">No package validated yet</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600">Upload JSON or paste a completed-session package to see schema, checksum, mapping, and record previews.</p>
    </section>
  );
}

function PreviewSummary({ preview }) {
  const validation = preview.validation || {};
  const schema = preview.schema || {};
  return (
    <section className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Fact label="Schema" value={schema.schemaVersion} />
        <Fact label="Source app" value={schema.sourceApp} />
        <Fact label="Event schema" value={schema.eventSchemaVersion} />
        <Fact label="Authority" value={schema.sourceAuthority} />
        <Fact label="Visibility" value={schema.visibility} />
        <Fact label="Checksum" value={validation.checksum} />
        <Fact label="Source match" value={schema.sourceMatchId} />
        <Fact label="Classification" value={preview.normalized?.classification?.classification} />
        <Fact label="Audit ID" value={preview.importRecord?.id || (preview.migrationMissing ? "migration pending" : "")} />
      </div>
      {validation.errors?.length ? (
        <MessageList tone="rose" title="Validation blockers" items={validation.errors} />
      ) : null}
      {validation.warnings?.length ? (
        <MessageList tone="amber" title="Warnings" items={validation.warnings} />
      ) : null}
      {preview.normalized?.classification?.publication ? (
        <p className="mt-4 rounded-md border border-zinc-200 bg-white p-3 text-sm font-bold text-zinc-700">
          {preview.normalized.classification.publication}
        </p>
      ) : null}
    </section>
  );
}

function ParticipantMapping({ participants, mapping, onChange, onRefresh, busy }) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">Participant mapping</p>
          <h3 className="text-xl font-black">Confirm humans, preserve NPCs</h3>
        </div>
        <button type="button" onClick={onRefresh} disabled={Boolean(busy)} className="rounded-sm border border-zinc-300 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] disabled:opacity-50">
          Apply Mapping
        </button>
      </div>
      <div className="mt-4 grid gap-3">
        {participants.map((participant) => {
          const current = mapping[participant.seatId] || participant.mapping || {};
          return (
            <article key={participant.seatId} className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-black">{participant.displayName}</p>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
                    {participant.kind} / {participant.seatId} / final {participant.finalStack}
                  </p>
                </div>
                {participant.kind === "npc" ? (
                  <span className="rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-black text-zinc-700">NPC preserved</span>
                ) : null}
              </div>
              {participant.kind === "human" ? (
                <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px] md:items-end">
                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Existing player</span>
                    <select
                      value={current.playerId || ""}
                      onChange={(event) => onChange(participant.seatId, { playerId: event.target.value || null, archiveOnly: false })}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">No linked league player</option>
                      {participant.suggestions?.map((suggestion) => (
                        <option key={suggestion.id} value={suggestion.id}>
                          {suggestion.display_name || suggestion.pokernow_name || suggestion.slug} ({suggestion.reason})
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-2">
                    <label className="flex items-center gap-2 text-sm font-bold">
                      <input
                        type="checkbox"
                        checked={Boolean(current.archiveOnly)}
                        onChange={(event) => onChange(participant.seatId, { archiveOnly: event.target.checked, playerId: event.target.checked ? null : current.playerId || null })}
                      />
                      Archive-only human
                    </label>
                    <label className="flex items-center gap-2 text-sm font-bold">
                      <input
                        type="checkbox"
                        checked={Boolean(current.confirmed)}
                        onChange={(event) => onChange(participant.seatId, { confirmed: event.target.checked })}
                      />
                      Confirm mapping
                    </label>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-zinc-600">NPCs are imported into session evidence but do not become league player profiles or receive standings points.</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function NormalizedPreview({ normalized }) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">Derived records</p>
      <div className="mt-3 grid gap-3 md:grid-cols-5">
        {Object.entries(normalized.totals || {}).map(([key, value]) => (
          <div key={key} className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">{key}</p>
            <p className="mt-1 text-2xl font-black">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 overflow-x-auto rounded-md border border-zinc-200">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-zinc-100 text-xs font-black uppercase tracking-[0.12em] text-zinc-500">
            <tr>
              <th className="px-3 py-2">Hand</th>
              <th className="px-3 py-2">Winner</th>
              <th className="px-3 py-2">Pot</th>
              <th className="px-3 py-2">Board</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(normalized.hands || []).slice(0, 16).map((hand) => (
              <tr key={hand.client_hand_id} className="border-t border-zinc-200 align-top">
                <td className="px-3 py-3 font-black">#{hand.hand_no}</td>
                <td className="px-3 py-3">{hand.winner_name || "-"}</td>
                <td className="px-3 py-3">{hand.pot_collected || "-"}</td>
                <td className="px-3 py-3">{hand.board || "-"}</td>
                <td className="px-3 py-3">{(normalized.actions || []).filter((action) => action.client_hand_id === hand.client_hand_id).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MessageList({ title, items = [], tone }) {
  const styles = tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800";
  return (
    <div className={`mt-4 rounded-md border p-3 text-sm ${styles}`}>
      <p className="font-black">{title}</p>
      <ul className="mt-2 list-disc pl-4">
        {items.slice(0, 10).map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function Fact({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-zinc-800">{value}</p>
    </div>
  );
}
