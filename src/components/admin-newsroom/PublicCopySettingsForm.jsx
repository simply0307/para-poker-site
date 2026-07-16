"use client";

import { useMemo, useState, useTransition } from "react";
import { DEFAULT_PUBLIC_COPY_SETTINGS } from "@/lib/newsroom/publicCopySettingsConstants";

function entryWithDefaults(entry = {}, defaults = {}) {
  return {
    playerCardDek: entry.playerCardDek || defaults.playerCardDek || "",
    playerProfileDek: entry.playerProfileDek || defaults.playerProfileDek || "",
    sessionTableLabel: entry.sessionTableLabel || defaults.sessionTableLabel || "",
    sessionCardDek: entry.sessionCardDek || defaults.sessionCardDek || "",
  };
}

export function PublicCopySettingsForm({ initialSettings, players = [], sessions = [] }) {
  const [settings, setSettings] = useState(initialSettings || DEFAULT_PUBLIC_COPY_SETTINGS);
  const [selectedPlayer, setSelectedPlayer] = useState(players[0]?.id || "");
  const [selectedSession, setSelectedSession] = useState(sessions[0]?.id || "");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const defaults = settings.defaults || DEFAULT_PUBLIC_COPY_SETTINGS.defaults;
  const playerEntry = useMemo(() => entryWithDefaults(settings.players?.[selectedPlayer], {}), [settings.players, selectedPlayer]);
  const sessionEntry = useMemo(() => entryWithDefaults(settings.sessions?.[selectedSession], {}), [settings.sessions, selectedSession]);

  function updateDefaults(field, value) {
    setSettings((current) => ({
      ...current,
      defaults: {
        ...(current.defaults || {}),
        [field]: value,
      },
    }));
    setMessage("");
  }

  function updatePlayer(field, value) {
    if (!selectedPlayer) return;
    setSettings((current) => ({
      ...current,
      players: {
        ...(current.players || {}),
        [selectedPlayer]: {
          ...(current.players?.[selectedPlayer] || {}),
          [field]: value,
        },
      },
    }));
    setMessage("");
  }

  function updateSession(field, value) {
    if (!selectedSession) return;
    setSettings((current) => ({
      ...current,
      sessions: {
        ...(current.sessions || {}),
        [selectedSession]: {
          ...(current.sessions?.[selectedSession] || {}),
          [field]: value,
        },
      },
    }));
    setMessage("");
  }

  function clearPlayer() {
    if (!selectedPlayer) return;
    setSettings((current) => {
      const next = { ...(current.players || {}) };
      delete next[selectedPlayer];
      return { ...current, players: next };
    });
    setMessage("");
  }

  function clearSession() {
    if (!selectedSession) return;
    setSettings((current) => {
      const next = { ...(current.sessions || {}) };
      delete next[selectedSession];
      return { ...current, sessions: next };
    });
    setMessage("");
  }

  function saveSettings() {
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/admin/public-copy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Could not save public copy settings.");
        return;
      }
      setSettings(payload.settings);
      setMessage("Public copy settings saved.");
    });
  }

  return (
    <section className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Public copy</p>
          <h2 className="mt-1 text-2xl font-black">Fallback and entity copy</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Edit small public phrases that appear when a player, session, or card does not have published editorial copy yet.
          </p>
        </div>
        <button
          type="button"
          onClick={saveSettings}
          disabled={isPending}
          className="rounded-sm bg-zinc-950 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50"
        >
          {isPending ? "Saving" : "Save Public Copy"}
        </button>
      </div>

      <div className="mt-5 grid gap-5">
        <article className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
          <h3 className="text-lg font-black">Global fallbacks</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <TextInput label="Player directory card" value={defaults.playerCardDek} onChange={(value) => updateDefaults("playerCardDek", value)} />
            <TextInput label="Player profile fallback" value={defaults.playerProfileDek} onChange={(value) => updateDefaults("playerProfileDek", value)} />
            <TextInput label="Imported table label" value={defaults.sessionTableLabel} onChange={(value) => updateDefaults("sessionTableLabel", value)} />
            <TextInput label="Session card fallback" value={defaults.sessionCardDek} onChange={(value) => updateDefaults("sessionCardDek", value)} />
          </div>
        </article>

        <article className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-black">Player override</h3>
            <button type="button" onClick={clearPlayer} className="rounded-sm border border-zinc-300 px-3 py-2 text-xs font-black uppercase tracking-[0.12em]">
              Clear selected
            </button>
          </div>
          <Select label="Player" value={selectedPlayer} onChange={setSelectedPlayer} options={players} />
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <TextInput label="Directory card copy" value={playerEntry.playerCardDek} onChange={(value) => updatePlayer("playerCardDek", value)} />
            <TextInput label="Profile fallback line" value={playerEntry.playerProfileDek} onChange={(value) => updatePlayer("playerProfileDek", value)} />
          </div>
        </article>

        <article className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-black">Session override</h3>
            <button type="button" onClick={clearSession} className="rounded-sm border border-zinc-300 px-3 py-2 text-xs font-black uppercase tracking-[0.12em]">
              Clear selected
            </button>
          </div>
          <Select label="Session" value={selectedSession} onChange={setSelectedSession} options={sessions} />
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <TextInput label="Table label" value={sessionEntry.sessionTableLabel} onChange={(value) => updateSession("sessionTableLabel", value)} />
            <TextInput label="Session card fallback" value={sessionEntry.sessionCardDek} onChange={(value) => updateSession("sessionCardDek", value)} />
          </div>
        </article>
      </div>

      {message ? (
        <p className={`mt-4 rounded-md border p-3 text-sm font-bold ${message.includes("Could not") ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {message}
        </p>
      ) : null}
    </section>
  );
}

function TextInput({ label, value, onChange }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">{label}</span>
      <input
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function Select({ label, value, onChange, options = [] }) {
  return (
    <label className="mt-3 block">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">{label}</span>
      <select
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
