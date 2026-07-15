"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { DEFAULT_HOME_SETTINGS, HOMEPAGE_MODULE_DEFINITIONS } from "@/lib/newsroom/homepageSettingsConstants";

function move(list, index, direction) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}

function definitionFor(type) {
  return HOMEPAGE_MODULE_DEFINITIONS.find((module) => module.type === type) || {
    type,
    label: type,
    description: "",
    allowedVariants: ["standard"],
    defaultVariant: "standard",
    allowedSourceModes: ["automatic"],
    defaultItemLimit: 3,
    minItems: 1,
    maxItems: 6,
    allowSectionHeader: true,
  };
}

function defaultModule(definition) {
  return {
    type: definition.type,
    enabled: true,
    variant: definition.defaultVariant,
    sourceMode: definition.allowedSourceModes?.[0] || "automatic",
    selectedIds: [],
    title: definition.defaultTitle || definition.label,
    dek: definition.defaultDek || "",
    itemLimit: definition.defaultItemLimit || definition.maxItems || 3,
    showSectionHeader: Boolean(definition.allowSectionHeader),
  };
}

function optionForMode(mode) {
  const labels = {
    automatic: "Automatic",
    latest: "Latest",
    manual: "Manual selection",
    league_board: "Current league board",
  };
  return labels[mode] || mode;
}

function heroOptions(selectionOptions = {}) {
  return [
    ...(selectionOptions.sessions || []).map((option) => ({ ...option, id: `session:${option.id}`, group: "Sessions" })),
    ...(selectionOptions.articles || []).map((option) => ({ ...option, id: `article:${option.id}`, group: "Articles" })),
  ];
}

function optionsFor(definition, selectionOptions = {}) {
  if (definition.type === "hero_board") return heroOptions(selectionOptions);
  if (definition.manualSelectionType === "sessions") return selectionOptions.sessions || [];
  if (definition.manualSelectionType === "players") return selectionOptions.players || [];
  if (definition.manualSelectionType === "moments") return selectionOptions.moments || [];
  if (definition.manualSelectionType === "articles") return selectionOptions.articles || [];
  if (definition.manualSelectionType === "events") return selectionOptions.events || [];
  if (definition.manualSelectionType === "socialCaptions") return selectionOptions.socialCaptions || [];
  return [];
}

function missingSelections(module, options) {
  if (module.sourceMode !== "manual" || !module.selectedIds?.length) return [];
  const available = new Set(options.map((option) => option.id));
  return module.selectedIds.filter((id) => !available.has(id));
}

function clamp(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

export function HomepageSettingsForm({ initialSettings, selectionOptions = {} }) {
  const [settings, setSettings] = useState(initialSettings || DEFAULT_HOME_SETTINGS);
  const [message, setMessage] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [openPanels, setOpenPanels] = useState(() => new Set([settings.modules?.[0]?.type].filter(Boolean)));
  const [isPending, startTransition] = useTransition();
  const enabledCount = useMemo(() => settings.modules.filter((module) => module.enabled !== false).length, [settings.modules]);

  function markDirty() {
    setIsDirty(true);
    setMessage("");
  }

  function updateHero(field, value) {
    setSettings((current) => ({
      ...current,
      hero: {
        ...current.hero,
        [field]: value,
      },
    }));
    markDirty();
  }

  function updateModule(index, patch) {
    setSettings((current) => ({
      ...current,
      modules: current.modules.map((module, moduleIndex) => (moduleIndex === index ? { ...module, ...patch } : module)),
    }));
    markDirty();
  }

  function moveModule(index, direction) {
    setSettings((current) => ({
      ...current,
      modules: move(current.modules, index, direction),
    }));
    markDirty();
  }

  function resetModule(index) {
    const definition = definitionFor(settings.modules[index]?.type);
    updateModule(index, defaultModule(definition));
  }

  async function saveSettings() {
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/admin/homepage-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || "Could not save homepage settings.");
        return;
      }
      setSettings(payload.settings);
      setIsDirty(false);
      setMessage("Homepage settings saved. Public visitors will see the saved presentation.");
    });
  }

  function resetSettings() {
    setSettings(DEFAULT_HOME_SETTINGS);
    setIsDirty(true);
    setMessage("Default settings loaded. Save to apply them.");
  }

  function togglePanel(type) {
    setOpenPanels((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Public homepage</p>
            <h2 className="mt-1 text-2xl font-black">Editorial presentation</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              Choose what the public homepage emphasizes. The code keeps layout, spacing, typography, and responsive behavior controlled.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="rounded-sm border border-zinc-300 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-700 hover:border-zinc-900">
              View homepage
            </Link>
            <button
              type="button"
              onClick={resetSettings}
              className="rounded-sm border border-zinc-300 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-700 hover:border-zinc-900"
            >
              Reset all
            </button>
            <button
              type="button"
              onClick={saveSettings}
              disabled={isPending}
              className="rounded-sm bg-zinc-950 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50"
            >
              {isPending ? "Saving" : "Save Settings"}
            </button>
          </div>
        </div>

        {isDirty ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
            Unsaved changes. Public visitors only see saved settings.
          </p>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <TextInput label="Hero eyebrow" value={settings.hero.eyebrow} onChange={(value) => updateHero("eyebrow", value)} />
          <TextInput label="Hero title" value={settings.hero.title} onChange={(value) => updateHero("title", value)} />
          <TextInput label="Hero dek" value={settings.hero.dek} onChange={(value) => updateHero("dek", value)} />
        </div>

        <div className="mt-6 space-y-3">
          {settings.modules.map((module, index) => {
            const definition = definitionFor(module.type);
            const isOpen = openPanels.has(module.type);
            const options = optionsFor(definition, selectionOptions);
            const missing = missingSelections(module, options);
            return (
              <article key={module.type} className="rounded-md border border-zinc-200 bg-zinc-50">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <button type="button" onClick={() => togglePanel(module.type)} className="text-left">
                    <p className="text-lg font-black">{definition.label}</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">{definition.description}</p>
                    {missing.length ? (
                      <p className="mt-2 text-xs font-bold text-amber-700">
                        Some selected content is unavailable; the public page will fall back safely.
                      </p>
                    ) : null}
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => moveModule(index, -1)}
                      disabled={index === 0}
                      className="rounded-sm border border-zinc-300 px-2.5 py-1.5 text-xs font-black disabled:opacity-35"
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      onClick={() => moveModule(index, 1)}
                      disabled={index === settings.modules.length - 1}
                      className="rounded-sm border border-zinc-300 px-2.5 py-1.5 text-xs font-black disabled:opacity-35"
                    >
                      Down
                    </button>
                    <label className="flex cursor-pointer items-center gap-2 rounded-sm border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-black uppercase tracking-[0.1em]">
                      <input
                        type="checkbox"
                        checked={module.enabled !== false}
                        onChange={(event) => updateModule(index, { enabled: event.target.checked })}
                      />
                      Live
                    </label>
                    <button type="button" onClick={() => togglePanel(module.type)} className="rounded-sm border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-black">
                      {isOpen ? "Close" : "Configure"}
                    </button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="grid gap-4 border-t border-zinc-200 bg-white p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Select
                        label="Presentation variant"
                        value={module.variant || definition.defaultVariant}
                        options={(definition.allowedVariants || []).map((variant) => ({ value: variant, label: variant.replace(/_/g, " ") }))}
                        onChange={(value) => updateModule(index, { variant: value })}
                      />
                      <Select
                        label="Source mode"
                        value={module.sourceMode || definition.allowedSourceModes?.[0] || "automatic"}
                        options={(definition.allowedSourceModes || ["automatic"]).map((mode) => ({ value: mode, label: optionForMode(mode) }))}
                        onChange={(value) => updateModule(index, { sourceMode: value, selectedIds: value === "manual" ? module.selectedIds || [] : [] })}
                      />
                      {definition.allowSectionHeader ? (
                        <>
                          <TextInput label="Section title" value={module.title || definition.defaultTitle || definition.label} onChange={(value) => updateModule(index, { title: value })} />
                          <TextInput label="Section dek" value={module.dek || definition.defaultDek || ""} onChange={(value) => updateModule(index, { dek: value })} />
                        </>
                      ) : null}
                      <Select
                        label="Item count"
                        value={String(module.itemLimit || definition.defaultItemLimit || definition.maxItems || 3)}
                        options={Array.from({ length: (definition.maxItems || 6) - (definition.minItems || 0) + 1 }, (_, offset) => {
                          const value = (definition.minItems || 0) + offset;
                          return { value: String(value), label: String(value) };
                        })}
                        onChange={(value) => updateModule(index, { itemLimit: clamp(value, definition.minItems || 0, definition.maxItems || 6) })}
                      />
                      {definition.allowSectionHeader ? (
                        <label className="flex items-end gap-2 pb-3 text-sm font-bold">
                          <input
                            type="checkbox"
                            checked={module.showSectionHeader !== false}
                            onChange={(event) => updateModule(index, { showSectionHeader: event.target.checked })}
                          />
                          Show section header
                        </label>
                      ) : null}
                    </div>

                    {module.sourceMode === "manual" && definition.supportsManualSelection ? (
                      <ManualSelector
                        definition={definition}
                        module={module}
                        options={options}
                        onChange={(selectedIds) => updateModule(index, { selectedIds })}
                      />
                    ) : null}

                    <div>
                      <button type="button" onClick={() => resetModule(index)} className="rounded-sm border border-zinc-300 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-700">
                        Reset module
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>

        {message ? (
          <p className={`mt-4 rounded-md border p-3 text-sm font-bold ${message.includes("Could not") ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {message}
          </p>
        ) : null}
      </section>

      <aside className="space-y-4">
        <section className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Current setup</p>
          <h2 className="mt-1 text-2xl font-black">{enabledCount} modules live</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Public pages display saved settings only. Manual selections use public sessions, public players, public moments, published articles, and staged events.
          </p>
          <Link href="/" className="mt-4 inline-flex rounded-sm bg-zinc-950 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-zinc-800">
            View homepage
          </Link>
        </section>

        <details className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer text-sm font-black uppercase tracking-[0.16em] text-amber-700">Developer config preview</summary>
          <pre className="mt-3 max-h-[440px] overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-zinc-700">
            {JSON.stringify(settings, null, 2)}
          </pre>
        </details>
      </aside>
    </div>
  );
}

function ManualSelector({ definition, module, options, onChange }) {
  const selected = new Set(module.selectedIds || []);
  const max = definition.maxItems || 1;
  const isSingle = max === 1;

  function toggle(id) {
    if (isSingle) {
      onChange(selected.has(id) ? [] : [id]);
      return;
    }
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (next.size < max) next.add(id);
    onChange([...next]);
  }

  return (
    <section className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-black">Manual content</p>
        <p className="text-xs font-bold text-zinc-500">
          {selected.size} / {max} selected
        </p>
      </div>
      <div className="mt-3 max-h-72 overflow-y-auto rounded-md border border-zinc-200 bg-white p-2">
        {options.length ? options.map((option) => {
          const active = selected.has(option.id);
          return (
            <button
              type="button"
              key={option.id}
              onClick={() => toggle(option.id)}
              className={`mb-2 block w-full rounded-sm border p-3 text-left text-sm last:mb-0 ${
                active ? "border-amber-700 bg-amber-50" : "border-zinc-200 bg-white hover:border-amber-500"
              }`}
            >
              <span className="block font-black text-zinc-950">{option.label}</span>
              {option.group ? <span className="mt-1 block text-xs font-bold uppercase tracking-wide text-amber-700">{option.group}</span> : null}
              {option.description ? <span className="mt-1 block leading-6 text-zinc-600">{option.description}</span> : null}
            </button>
          );
        }) : (
          <p className="p-3 text-sm font-bold text-zinc-500">No public items are available for this selector yet.</p>
        )}
      </div>
    </section>
  );
}

function TextInput({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">{label}</span>
      <input
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function Select({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">{label}</span>
      <select
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm capitalize"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
