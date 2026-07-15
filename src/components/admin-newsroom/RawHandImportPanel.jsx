"use client";

import { useState } from "react";

function defaultPlayedAt() {
  return new Date().toISOString().slice(0, 16);
}

export function RawHandImportPanel({ initialSeasonCode = "S0" }) {
  const [form, setForm] = useState({
    sessionCode: "",
    seasonCode: initialSeasonCode,
    sessionNumber: "",
    tableName: "Imported Table",
    playedAt: defaultPlayedAt(),
    format: "Imported hand history",
    replaceExisting: false,
    csvText: "",
    fileName: "",
    rawText: "",
  });
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  async function runPreview() {
    setBusy("preview");
    setError("");
    setResult(null);
    const response = await fetch("/api/admin/imports/raw-hands/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Preview failed.");
      setBusy("");
      return;
    }
    setPreview(payload.preview);
    setBusy("");
  }

  async function commitImport() {
    const confirmed = window.confirm("Commit this import to Supabase? Imported hand/action rows will become live evidence.");
    if (!confirmed) return;
    setBusy("commit");
    setError("");
    const response = await fetch("/api/admin/imports/raw-hands/commit", {
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
  }

  return (
    <section className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Raw hand import</p>
          <h2 className="mt-1 text-2xl font-black">Import raw hand history</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Upload a CSV or paste hand history, preview parsed hands/actions, then commit to Supabase as live evidence.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={runPreview} disabled={Boolean(busy)} className="rounded-sm border border-zinc-300 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] disabled:opacity-50">
            {busy === "preview" ? "Parsing" : "Preview"}
          </button>
          <button type="button" onClick={commitImport} disabled={Boolean(busy) || !preview?.totals?.hands} className="rounded-sm bg-zinc-950 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50">
            {busy === "commit" ? "Committing" : "Commit Live"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Input label="Session code" value={form.sessionCode} onChange={(value) => update("sessionCode", value)} placeholder="S0-002" />
        <Input label="Season" value={form.seasonCode} onChange={(value) => update("seasonCode", value)} />
        <Input label="Session number" value={form.sessionNumber} onChange={(value) => update("sessionNumber", value)} placeholder="2" />
        <Input label="Table name" value={form.tableName} onChange={(value) => update("tableName", value)} />
        <Input label="Format" value={form.format} onChange={(value) => update("format", value)} />
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Played at</span>
          <input type="datetime-local" value={form.playedAt} onChange={(event) => update("playedAt", event.target.value)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm font-bold text-zinc-700">
        <input type="checkbox" checked={form.replaceExisting} onChange={(event) => update("replaceExisting", event.target.checked)} />
        Replace existing hands/actions/notable hands for this session code
      </label>

      <section className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">CSV upload</p>
        <input
          type="file"
          accept=".csv,text/csv"
          className="mt-3 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const csvText = await file.text();
            setForm((current) => ({
              ...current,
              csvText,
              fileName: file.name,
            }));
            setPreview(null);
            setResult(null);
            setError("");
          }}
        />
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          {form.fileName ? `Loaded ${form.fileName}. ` : ""}
          Supported CSVs can include either a raw line column (`raw_entry`, `line`) or normalized columns like `hand_no`, `player_name`, `action`, `amount`, and `street`.
        </p>
      </section>

      <label className="mt-4 grid gap-2">
        <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Paste fallback</span>
        <textarea
          value={form.rawText}
          onChange={(event) => update("rawText", event.target.value)}
          className="min-h-72 rounded-md border border-zinc-300 p-3 font-mono text-xs"
          placeholder='Optional fallback: paste PokerNow-style raw hand history with Hand # markers and quoted player actions.'
        />
      </label>

      {error ? <p className="mt-4 rounded-md bg-red-100 p-3 font-bold text-red-800">{error}</p> : null}
      {result ? <p className="mt-4 rounded-md bg-green-100 p-3 font-bold text-green-800">Import committed to {result.session?.session_code}. {result.totals.insertedHands} hands inserted.</p> : null}

      {preview ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Preview totals</p>
            <dl className="mt-3 grid gap-2 text-sm">
              {Object.entries(preview.totals || {}).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-3 border-b border-zinc-200 py-1 last:border-0">
                  <dt className="font-bold capitalize">{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {preview.warnings?.length ? (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-black">Warnings</p>
                <ul className="mt-2 list-disc pl-4">
                  {preview.warnings.slice(0, 8).map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              </div>
            ) : null}
          </aside>
          <div className="overflow-x-auto rounded-md border border-zinc-200">
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
                {preview.hands?.map((hand) => (
                  <tr key={hand.hand_no} className="border-t border-zinc-200 align-top">
                    <td className="px-3 py-3 font-black">#{hand.hand_no}</td>
                    <td className="px-3 py-3">{hand.winner_name || "-"}</td>
                    <td className="px-3 py-3">{hand.pot_collected || "-"}</td>
                    <td className="px-3 py-3">{hand.board || "-"}</td>
                    <td className="px-3 py-3">{hand.actions?.length || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Input({ label, value, onChange, placeholder = "" }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">{label}</span>
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
    </label>
  );
}
