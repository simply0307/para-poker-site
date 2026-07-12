"use client";

import { useState, useTransition } from "react";
import { DEFAULT_LEAGUE_RULES } from "@/lib/league/rulesConstants";

function normalizePoints(points = {}) {
  return Object.fromEntries(Object.entries(points).sort((left, right) => Number(left[0]) - Number(right[0])));
}

export function LeagueRulesForm({ initialRules, initialStorage, initialWarning, initialStandings = [] }) {
  const [rules, setRules] = useState(initialRules || DEFAULT_LEAGUE_RULES);
  const [storage, setStorage] = useState(initialStorage || "default");
  const [warning, setWarning] = useState(initialWarning || "");
  const [standings, setStandings] = useState(initialStandings);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const points = normalizePoints(rules.pointsByFinish || {});

  function patch(patchValue) {
    setRules((current) => ({ ...current, ...patchValue }));
    setMessage("");
    setError("");
  }

  function updatePoint(finish, value) {
    patch({
      pointsByFinish: {
        ...(rules.pointsByFinish || {}),
        [String(finish)]: Number(value || 0),
      },
    });
  }

  function addFinish() {
    const nextFinish = Math.max(0, ...Object.keys(points).map(Number)) + 1;
    updatePoint(nextFinish, 0);
  }

  function removeFinish(finish) {
    const next = { ...(rules.pointsByFinish || {}) };
    delete next[String(finish)];
    patch({ pointsByFinish: next });
  }

  async function send(action) {
    setMessage("");
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/admin/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rules }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || "Rules update failed.");
        return;
      }
      if (payload.rules) setRules(payload.rules);
      if (payload.storage) setStorage(payload.storage);
      if (payload.warning !== undefined) setWarning(payload.warning);
      if (payload.standings) setStandings(payload.standings);
      setMessage(action === "apply" ? "Rules saved and standings recalculated." : action === "preview" ? "Preview updated." : "Rules saved.");
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">League rules</p>
            <h2 className="mt-1 text-2xl font-black">Active ruleset</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">Rules are tracked in the integrated league rules table when available. Applying rules updates approved session result points, then rebuilds the public standings table.</p>
          </div>
          <span className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-zinc-600">{storage}</span>
        </div>

        {warning ? <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">{warning}</p> : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Input label="Ruleset name" value={rules.name} onChange={(value) => patch({ name: value })} />
          <Input label="Season code" value={rules.seasonCode} onChange={(value) => patch({ seasonCode: value })} />
          <Input label="Participation points" type="number" value={rules.participationPoints} onChange={(value) => patch({ participationPoints: Number(value || 0) })} />
          <Input label="Minimum hands for points" type="number" value={rules.minimumHandsForPoints} onChange={(value) => patch({ minimumHandsForPoints: Number(value || 0) })} />
        </div>

        <section className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-black">Points by finish</h3>
            <button type="button" onClick={addFinish} className="rounded-sm border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-black uppercase tracking-[0.1em]">Add place</button>
          </div>
          <div className="mt-3 grid gap-2">
            {Object.entries(points).map(([finish, value]) => (
              <div key={finish} className="grid grid-cols-[90px_minmax(0,1fr)_80px] items-center gap-2">
                <span className="text-sm font-black">Finish {finish}</span>
                <input type="number" value={value} onChange={(event) => updatePoint(finish, event.target.value)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
                <button type="button" onClick={() => removeFinish(finish)} className="rounded-md border border-red-300 px-2 py-2 text-xs font-black text-red-700">Remove</button>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={() => send("preview")} disabled={isPending} className="rounded-md border border-zinc-300 px-4 py-3 font-black disabled:opacity-50">Preview Standings</button>
          <button type="button" onClick={() => send("save")} disabled={isPending} className="rounded-md bg-zinc-700 px-4 py-3 font-black text-white disabled:opacity-50">Save Rules</button>
          <button type="button" onClick={() => send("apply")} disabled={isPending} className="rounded-md bg-amber-600 px-4 py-3 font-black text-white disabled:opacity-50">Save + Recalculate Standings</button>
        </div>

        {message ? <p className="mt-4 rounded-md bg-green-100 p-3 font-bold text-green-800">{message}</p> : null}
        {error ? <p className="mt-4 rounded-md bg-red-100 p-3 font-bold text-red-800">{error}</p> : null}
      </section>

      <aside className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Preview</p>
        <h2 className="mt-1 text-2xl font-black">Calculated standings</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[360px] text-left text-sm">
            <thead className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">
              <tr>
                <th className="border-b border-zinc-200 py-2">Rank</th>
                <th className="border-b border-zinc-200 py-2">Player</th>
                <th className="border-b border-zinc-200 py-2 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {standings.length ? standings.map((row) => (
                <tr key={row.player_id || row.player_name} className="border-b border-zinc-100 last:border-0">
                  <td className="py-2 font-black">{row.rank}</td>
                  <td className="py-2">{row.player_name}</td>
                  <td className="py-2 text-right font-black">{row.total_points}</td>
                </tr>
              )) : (
                <tr><td colSpan={3} className="py-4 text-zinc-500">No approved session results available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </aside>
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">{label}</span>
      <input type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
    </label>
  );
}
