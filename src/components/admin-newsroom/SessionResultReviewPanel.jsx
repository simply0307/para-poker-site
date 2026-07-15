"use client";

import { useState } from "react";

function pointsForFinish(rules, finish) {
  const pointsByFinish = rules?.pointsByFinish || rules?.points_by_finish || {};
  return Number(pointsByFinish[String(finish)] || 0) + Number(rules?.participationPoints || rules?.participation_points || 0);
}

function rowsFromReview(review = {}) {
  const sourceRows = review.existingResults?.length ? review.existingResults : review.suggestions || [];
  return sourceRows.map((row, index) => ({
    player_id: row.player_id || "",
    player_name: row.player_name || "",
    finish: Number(row.finish || index + 1),
    league_points: Number(row.league_points || row.points || pointsForFinish(review.rules, row.finish || index + 1)),
    final_stack: Number(row.final_stack || 0),
    confidence: row.confidence || "admin_confirmed",
    notes: row.notes || "",
  }));
}

export function SessionResultReviewPanel({ sessions = [] }) {
  const [selectedId, setSelectedId] = useState(sessions[0]?.id || "");
  const [review, setReview] = useState(null);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadReview(sessionId = selectedId) {
    if (!sessionId) return;
    setBusy("load");
    setError("");
    setMessage("");
    const response = await fetch(`/api/admin/imports/sessions/${encodeURIComponent(sessionId)}/results`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Could not load result review.");
      setBusy("");
      return;
    }
    setReview(payload);
    setRows(rowsFromReview(payload));
    setBusy("");
  }

  async function approveResults() {
    if (!selectedId || !rows.length) return;
    const confirmed = window.confirm("Approve these session results and recalculate season/career stats?");
    if (!confirmed) return;

    setBusy("approve");
    setError("");
    setMessage("");
    const response = await fetch(`/api/admin/imports/sessions/${encodeURIComponent(selectedId)}/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results: rows }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Could not approve session results.");
      setBusy("");
      return;
    }
    setMessage("Results approved. Season, career stats, and standings were recalculated.");
    setReview((current) => ({ ...current, existingResults: payload.results || rows }));
    setBusy("");
  }

  async function recalculate(action) {
    if (!selectedId) return;
    setBusy(action);
    setError("");
    setMessage("");
    const response = await fetch(`/api/admin/imports/sessions/${encodeURIComponent(selectedId)}/results`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "Could not recalculate stats.");
      setBusy("");
      return;
    }
    setMessage(action === "recalculate_season"
      ? "Session, season, career stats, and standings were recalculated."
      : "Session player stats were recalculated from hands/actions.");
    await loadReview(selectedId);
    setBusy("");
  }

  function updateRow(index, field, value) {
    setRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const next = { ...row, [field]: field === "finish" || field === "league_points" || field === "final_stack" ? Number(value || 0) : value };
        if (field === "finish") next.league_points = pointsForFinish(review?.rules, value);
        return next;
      })
    );
  }

  if (!sessions.length) return null;

  return (
    <section className="mt-8 rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Import review</p>
          <h2 className="mt-1 text-2xl font-black">Confirm official results</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Imported hand data can suggest a result order, but standings only update after admin confirmation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={selectedId}
            onChange={(event) => {
              setSelectedId(event.target.value);
              setReview(null);
              setRows([]);
              setMessage("");
              setError("");
            }}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-bold"
          >
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.sessionCode}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => loadReview()} disabled={Boolean(busy)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-black disabled:opacity-50">
            {busy === "load" ? "Loading..." : "Review"}
          </button>
          <button type="button" onClick={() => recalculate("recalculate_session")} disabled={Boolean(busy)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-black disabled:opacity-50">
            {busy === "recalculate_session" ? "Recalculating..." : "Recalc Session Stats"}
          </button>
          <button type="button" onClick={() => recalculate("recalculate_season")} disabled={Boolean(busy)} className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-black text-white disabled:opacity-50">
            {busy === "recalculate_season" ? "Recalculating..." : "Recalc Season + Career"}
          </button>
        </div>
      </div>

      {review ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="overflow-x-auto rounded-md border border-zinc-200">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-zinc-100 text-xs font-black uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Finish</th>
                  <th className="px-3 py-2">Player</th>
                  <th className="px-3 py-2">Points</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.player_id || row.player_name}-${index}`} className="border-t border-zinc-200">
                    <td className="px-3 py-2">
                      <input type="number" value={row.finish} onChange={(event) => updateRow(index, "finish", event.target.value)} className="w-20 rounded-md border border-zinc-300 px-2 py-1" />
                    </td>
                    <td className="px-3 py-2 font-bold">{row.player_name}</td>
                    <td className="px-3 py-2">
                      <input type="number" value={row.league_points} onChange={(event) => updateRow(index, "league_points", event.target.value)} className="w-24 rounded-md border border-zinc-300 px-2 py-1" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={row.notes} onChange={(event) => updateRow(index, "notes", event.target.value)} className="w-full rounded-md border border-zinc-300 px-2 py-1" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <aside className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Derived session stats</p>
            <div className="mt-3 grid gap-2">
              {(review.stats || []).map((stat) => (
                <div key={stat.player_id || stat.player_name} className="rounded-md bg-white p-3">
                  <p className="font-black text-zinc-950">{stat.player_name}</p>
                  <p>{stat.hands} hands / {stat.hands_won} won / {stat.biggest_pot_won_bb ? `${stat.biggest_pot_won_bb} BB` : stat.biggest_pot_won} biggest pot</p>
                  {stat.total_collected_bb ? <p>{Number(stat.total_collected_bb).toFixed(1)} BB collected</p> : null}
                  <p>VPIP {stat.vpip_pct ?? "pending"} / PFR {stat.pfr_pct ?? "pending"}</p>
                </div>
              ))}
            </div>
            <button type="button" onClick={approveResults} disabled={Boolean(busy) || !rows.length} className="mt-4 w-full rounded-md bg-amber-600 px-4 py-3 font-black text-white disabled:opacity-50">
              {busy === "approve" ? "Approving..." : "Approve Results + Recalculate"}
            </button>
          </aside>
        </div>
      ) : null}

      {message ? <p className="mt-4 rounded-md bg-green-100 p-3 font-bold text-green-800">{message}</p> : null}
      {error ? <p className="mt-4 rounded-md bg-red-100 p-3 font-bold text-red-800">{error}</p> : null}
    </section>
  );
}
