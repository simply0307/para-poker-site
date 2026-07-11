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
  return HOMEPAGE_MODULE_DEFINITIONS.find((module) => module.type === type) || { label: type, description: "" };
}

export function HomepageSettingsForm({ initialSettings }) {
  const [settings, setSettings] = useState(initialSettings || DEFAULT_HOME_SETTINGS);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const enabledCount = useMemo(() => settings.modules.filter((module) => module.enabled !== false).length, [settings.modules]);

  function updateHero(field, value) {
    setSettings((current) => ({
      ...current,
      hero: {
        ...current.hero,
        [field]: value,
      },
    }));
    setMessage("");
  }

  function updateModule(index, patch) {
    setSettings((current) => ({
      ...current,
      modules: current.modules.map((module, moduleIndex) => (moduleIndex === index ? { ...module, ...patch } : module)),
    }));
    setMessage("");
  }

  function moveModule(index, direction) {
    setSettings((current) => ({
      ...current,
      modules: move(current.modules, index, direction),
    }));
    setMessage("");
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
      setMessage("Homepage settings saved. The public homepage will refresh shortly.");
    });
  }

  function resetSettings() {
    setSettings(DEFAULT_HOME_SETTINGS);
    setMessage("Default settings loaded. Save to apply them.");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Public homepage</p>
            <h2 className="mt-1 text-2xl font-black">Mainpage modules</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetSettings}
              className="rounded-sm border border-zinc-300 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-700 hover:border-zinc-900"
            >
              Reset
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

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Eyebrow</span>
            <input
              value={settings.hero.eyebrow}
              onChange={(event) => updateHero("eyebrow", event.target.value)}
              className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Title</span>
            <input
              value={settings.hero.title}
              onChange={(event) => updateHero("title", event.target.value)}
              className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Deck</span>
            <input
              value={settings.hero.dek}
              onChange={(event) => updateHero("dek", event.target.value)}
              className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-6 space-y-3">
          {settings.modules.map((module, index) => {
            const definition = definitionFor(module.type);
            return (
              <article key={module.type} className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-black">{definition.label}</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">{definition.description}</p>
                  </div>
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
                  </div>
                </div>
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
            These controls affect the public homepage only. Public pages still do not generate drafts; they only display approved coverage and
            evidence.
          </p>
          <Link href="/" className="mt-4 inline-flex rounded-sm bg-amber-600 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-amber-700">
            View homepage
          </Link>
        </section>

        <section className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Config preview</p>
          <pre className="mt-3 max-h-[440px] overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-zinc-700">
            {JSON.stringify(settings, null, 2)}
          </pre>
        </section>
      </aside>
    </div>
  );
}
