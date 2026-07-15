"use client";

import { useMemo, useState } from "react";

function dateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formFromSession(session = {}) {
  return {
    sessionCode: session.sessionCode || "",
    seasonCode: session.seasonCode || "S0",
    sessionNumber: session.sessionNumber || "",
    tableName: session.tableName || "",
    playedAt: dateTimeLocal(session.playedAt),
    format: session.format || "Imported hand history",
    status: session.status || "processed",
    handsCount: session.declaredHands || session.handsImported || 0,
    playersCount: session.playersCount || "",
  };
}

export function ImportSessionManager({ sessions = [] }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(sessions[0]?.id || "");
  const selected = sessions.find((session) => session.id === selectedId) || sessions[0] || null;
  const [form, setForm] = useState(() => formFromSession(selected));
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const filteredSessions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sessions;
    return sessions.filter((session) =>
      [session.sessionCode, session.seasonCode, session.tableName, session.status, session.importStatus]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [query, sessions]);

  function selectSession(session) {
    setSelectedId(session.id);
    setForm(formFromSession(session));
    setMessage("");
    setError("");
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  async function saveSession() {
    if (!selected?.id) return;
    setBusy("save");
    setMessage("");
    setError("");

    const response = await fetch(`/api/admin/imports/sessions/${encodeURIComponent(selected.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error || "Session update failed.");
      setBusy("");
      return;
    }

    setMessage("Session import updated. Refreshing coverage...");
    setBusy("");
    window.location.reload();
  }

  async function deleteSession() {
    if (!selected?.id) return;
    const confirmed = window.confirm(
      `Delete ${selected.sessionCode}? This removes the session row plus its hands, actions, notable hands, result rows, player stats, and session recap drafts.`
    );
    if (!confirmed) return;

    setBusy("delete");
    setMessage("");
    setError("");

    const response = await fetch(`/api/admin/imports/sessions/${encodeURIComponent(selected.id)}`, {
      method: "DELETE",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error || "Session delete failed.");
      setBusy("");
      return;
    }

    setMessage(`${result.result?.sessionCode || selected.sessionCode} deleted. Refreshing coverage...`);
    setBusy("");
    window.location.reload();
  }

  if (!sessions.length) return null;

  return (
    <section className="mt-8 rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Import library</p>
          <h2 className="mt-1 text-2xl font-black">Manage imported sessions</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Edit session metadata or remove an imported session and its evidence rows. New CSV commits create sessions by default; replacement is an explicit action in the import panel.
          </p>
        </div>
        <p className="text-sm font-bold text-zinc-500">{sessions.length} sessions</p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
        <aside className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter sessions..."
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          />
          <div className="mt-3 max-h-[420px] overflow-auto pr-1">
            {filteredSessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => selectSession(session)}
                className={`mb-2 block w-full rounded-md border p-3 text-left text-sm ${
                  selected?.id === session.id ? "border-amber-500 bg-amber-50" : "border-zinc-200 bg-white hover:border-zinc-400"
                }`}
              >
                <span className="block font-black">{session.sessionCode}</span>
                <span className="mt-1 block text-xs text-zinc-500">
                  {session.seasonCode} / {session.handsImported} hands / {session.importStatus}
                </span>
              </button>
            ))}
            {!filteredSessions.length ? <p className="p-3 text-sm font-bold text-zinc-500">No sessions match.</p> : null}
          </div>
        </aside>

        <div className="rounded-md border border-zinc-200 p-4">
          {selected ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Input label="Session code" value={form.sessionCode} onChange={(value) => update("sessionCode", value)} />
                <Input label="Season" value={form.seasonCode} onChange={(value) => update("seasonCode", value)} />
                <Input label="Session number" value={form.sessionNumber} onChange={(value) => update("sessionNumber", value)} />
                <Input label="Table name" value={form.tableName} onChange={(value) => update("tableName", value)} />
                <Input label="Format" value={form.format} onChange={(value) => update("format", value)} />
                <Input label="Status" value={form.status} onChange={(value) => update("status", value)} />
                <Input label="Hands count" value={form.handsCount} onChange={(value) => update("handsCount", value)} />
                <Input label="Players count" value={form.playersCount} onChange={(value) => update("playersCount", value)} />
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Played at</span>
                  <input
                    type="datetime-local"
                    value={form.playedAt}
                    onChange={(event) => update("playedAt", event.target.value)}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="mt-5 rounded-md bg-zinc-100 p-3 text-sm text-zinc-700">
                <strong className="text-zinc-950">Evidence attached:</strong> {selected.handsImported} hands, {selected.actionRows} actions, {selected.notableHands} moments, {selected.resultRows} result rows, {selected.statRows} stat rows.
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={saveSession}
                  disabled={Boolean(busy)}
                  className="rounded-md bg-zinc-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
                >
                  {busy === "save" ? "Saving..." : "Save Session Metadata"}
                </button>
                <button
                  type="button"
                  onClick={deleteSession}
                  disabled={Boolean(busy)}
                  className="rounded-md border border-red-300 px-4 py-3 text-sm font-black text-red-700 disabled:opacity-50"
                >
                  {busy === "delete" ? "Deleting..." : "Delete Imported Session"}
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm font-bold text-zinc-500">Select a session to manage.</p>
          )}
        </div>
      </div>

      {message ? <p className="mt-4 rounded-md bg-green-100 p-3 font-bold text-green-800">{message}</p> : null}
      {error ? <p className="mt-4 rounded-md bg-red-100 p-3 font-bold text-red-800">{error}</p> : null}
    </section>
  );
}

function Input({ label, value, onChange }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">{label}</span>
      <input value={value || ""} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm" />
    </label>
  );
}
