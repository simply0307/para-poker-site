"use client";

import { useState } from "react";

function defaultPlayedAt() {
  return new Date().toISOString().slice(0, 16);
}

export function RawHandImportPanel({ initialSeasonCode = "S0", existingSessions = [] }) {
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
  const enteredSessionCode = form.sessionCode.trim().toLowerCase();
  const matchingSession = existingSessions.find((session) => String(session.sessionCode || "").trim().toLowerCase() === enteredSessionCode);
  const replacementAllowed = Boolean(matchingSession && form.replaceExisting);

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
    if (matchingSession && !form.replaceExisting) {
      setError("That session code already exists. Choose a new session code, or enable explicit replacement for that session.");
      return;
    }

    const confirmed = window.confirm(
      form.replaceExisting
        ? `Replace ${matchingSession?.sessionCode || form.sessionCode}? Existing hands, actions, moments, result rows, and player stats for that session will be rebuilt.`
        : "Commit this as a new Supabase session? Imported hand/action rows will become live evidence."
    );
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
            Upload a CSV, preview parsed hands/actions, then commit it as a new Supabase session. Replacing an existing session is explicit and guarded.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={runPreview} disabled={Boolean(busy)} className="rounded-sm border border-zinc-300 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] disabled:opacity-50">
            {busy === "preview" ? "Parsing" : "Preview"}
          </button>
          <button
            type="button"
            onClick={commitImport}
            disabled={Boolean(busy) || !preview?.totals?.hands || (Boolean(matchingSession) && !form.replaceExisting)}
            className="rounded-sm bg-zinc-950 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50"
          >
            {busy === "commit" ? "Committing" : form.replaceExisting ? "Replace Live Session" : "Commit New Session"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Session code</span>
          <input
            value={form.sessionCode}
            list="existing-session-codes"
            placeholder="S0-002"
            onChange={(event) => update("sessionCode", event.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <datalist id="existing-session-codes">
            {existingSessions.map((session) => (
              <option key={session.id} value={session.sessionCode} />
            ))}
          </datalist>
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
      <p className="mt-2 text-xs text-zinc-500">Leave session number blank to have it assigned automatically within the selected season.</p>

      <div className={`mt-4 rounded-md border p-3 text-sm ${matchingSession ? "border-amber-300 bg-amber-50 text-amber-900" : "border-zinc-200 bg-zinc-50 text-zinc-600"}`}>
        {matchingSession ? (
          <>
            <p className="font-black">Existing session found: {matchingSession.sessionCode}</p>
            <p className="mt-1">
              Current evidence: {matchingSession.handsImported} hands, {matchingSession.actionRows} actions, {matchingSession.notableHands} moment candidates.
            </p>
            <label className="mt-3 flex items-center gap-2 font-bold">
              <input type="checkbox" checked={form.replaceExisting} onChange={(event) => update("replaceExisting", event.target.checked)} />
              I want this CSV to replace that existing session evidence.
            </label>
          </>
        ) : (
          <p>New imports create a new live session. Use an existing session code only when you intentionally want to rebuild that session.</p>
        )}
      </div>

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
      {matchingSession && !replacementAllowed ? (
        <p className="mt-4 rounded-md bg-amber-100 p-3 font-bold text-amber-900">
          This session code already exists. Commit is blocked until replacement is explicitly enabled.
        </p>
      ) : null}

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
            {preview.blindSummary ? (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-black">Big-blind normalization</p>
                <dl className="mt-2 grid gap-1">
                  <div className="flex justify-between gap-3">
                    <dt>Hands with BB</dt>
                    <dd>{preview.blindSummary.handsWithPotBb || 0} / {preview.totals?.hands || 0}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Blind levels</dt>
                    <dd>{preview.blindSummary.blindLevels?.length ? preview.blindSummary.blindLevels.join(", ") : "pending"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Biggest normalized pot</dt>
                    <dd>{preview.blindSummary.biggestPotBb ? `${preview.blindSummary.biggestPotBb} BB` : "pending"}</dd>
                  </div>
                </dl>
              </div>
            ) : null}
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
                  <th className="px-3 py-2">BB</th>
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
                    <td className="px-3 py-3">{hand.pot_bb ? `${hand.pot_bb} BB` : "-"}</td>
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
