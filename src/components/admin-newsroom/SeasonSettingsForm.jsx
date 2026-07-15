"use client";

import { useState, useTransition } from "react";
import { DEFAULT_SEASON_SETTINGS } from "@/lib/newsroom/seasonSettingsConstants";

const PHASE_OPTIONS = ["preseason", "regular_season", "postseason", "offseason"];
const STATUS_OPTIONS = ["in_progress", "complete", "paused", "archived"];

export function SeasonSettingsForm({ initialSettings }) {
  const [settings, setSettings] = useState(initialSettings || DEFAULT_SEASON_SETTINGS);
  const [message, setMessage] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isPending, startTransition] = useTransition();

  function markDirty() {
    setIsDirty(true);
    setMessage("");
  }

  function update(field, value) {
    setSettings((current) => ({ ...current, [field]: value }));
    markDirty();
  }

  function updateSeason(index, field, value) {
    setSettings((current) => ({
      ...current,
      availableSeasons: current.availableSeasons.map((season, seasonIndex) =>
        seasonIndex === index ? { ...season, [field]: value } : season
      ),
    }));
    markDirty();
  }

  function addSeason() {
    setSettings((current) => ({
      ...current,
      availableSeasons: [
        ...current.availableSeasons,
        { code: `S${current.availableSeasons.length}`, label: `Season ${current.availableSeasons.length}`, phase: "preseason", status: "in_progress" },
      ],
    }));
    markDirty();
  }

  async function saveSettings() {
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/admin/season-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || "Could not save season settings.");
        return;
      }
      setSettings(payload.settings);
      setIsDirty(false);
      setMessage("Season settings saved.");
    });
  }

  return (
    <section className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Multi-season foundation</p>
          <h2 className="mt-1 text-2xl font-black">Active season</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            These settings give public modules and generation packets a shared season frame. S0 remains the default until more seasons are added.
          </p>
        </div>
        <button
          type="button"
          onClick={saveSettings}
          disabled={isPending}
          className="rounded-sm bg-zinc-950 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50"
        >
          {isPending ? "Saving" : "Save Season"}
        </button>
      </div>

      {isDirty ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
          Unsaved season changes.
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Select label="Active season" value={settings.activeSeasonCode} options={(settings.availableSeasons || []).map((season) => season.code)} onChange={(value) => update("activeSeasonCode", value)} />
        <Select label="Season phase" value={settings.seasonPhase} options={PHASE_OPTIONS} onChange={(value) => update("seasonPhase", value)} />
        <Select label="Season status" value={settings.seasonStatus} options={STATUS_OPTIONS} onChange={(value) => update("seasonStatus", value)} />
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Lifecycle note</span>
        <textarea
          value={settings.lifecycleNote || ""}
          onChange={(event) => update("lifecycleNote", event.target.value)}
          className="mt-2 min-h-24 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>

      <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-black">Configured seasons</p>
          <button type="button" onClick={addSeason} className="rounded-sm border border-zinc-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.12em]">
            Add season
          </button>
        </div>
        <div className="mt-3 grid gap-3">
          {(settings.availableSeasons || []).map((season, index) => (
            <div key={`${season.code}-${index}`} className="grid gap-3 rounded-md border border-zinc-200 bg-white p-3 md:grid-cols-4">
              <TextInput label="Code" value={season.code} onChange={(value) => updateSeason(index, "code", value)} />
              <TextInput label="Label" value={season.label} onChange={(value) => updateSeason(index, "label", value)} />
              <Select label="Phase" value={season.phase} options={PHASE_OPTIONS} onChange={(value) => updateSeason(index, "phase", value)} />
              <Select label="Status" value={season.status} options={STATUS_OPTIONS} onChange={(value) => updateSeason(index, "status", value)} />
            </div>
          ))}
        </div>
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
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">{label}</span>
      <input value={value || ""} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
    </label>
  );
}

function Select({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">{label}</span>
      <select value={value || ""} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm">
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
