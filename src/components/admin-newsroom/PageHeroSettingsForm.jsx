"use client";

import { useState, useTransition } from "react";
import { DEFAULT_PAGE_HERO_SETTINGS, PAGE_HERO_DEFINITIONS } from "@/lib/newsroom/pageHeroSettingsConstants";

export function PageHeroSettingsForm({ initialSettings }) {
  const [settings, setSettings] = useState(initialSettings || { pages: DEFAULT_PAGE_HERO_SETTINGS });
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const pages = settings.pages || DEFAULT_PAGE_HERO_SETTINGS;

  function updateHero(pageKey, field, value) {
    setSettings((current) => ({
      ...current,
      pages: {
        ...(current.pages || {}),
        [pageKey]: {
          ...(current.pages?.[pageKey] || DEFAULT_PAGE_HERO_SETTINGS[pageKey]),
          [field]: value,
        },
      },
    }));
    setMessage("");
  }

  function saveSettings() {
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/admin/page-heroes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Could not save page hero settings.");
        return;
      }
      setSettings(payload.settings);
      setMessage("Page hero settings saved.");
    });
  }

  return (
    <section className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Public pages</p>
          <h2 className="mt-1 text-2xl font-black">Page hero copy</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Customize the eyebrow, title, and subtitle for the main public index pages.
          </p>
        </div>
        <button
          type="button"
          onClick={saveSettings}
          disabled={isPending}
          className="rounded-sm bg-zinc-950 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50"
        >
          {isPending ? "Saving" : "Save Page Heroes"}
        </button>
      </div>

      <div className="mt-5 grid gap-4">
        {PAGE_HERO_DEFINITIONS.map((definition) => {
          const hero = pages[definition.key] || DEFAULT_PAGE_HERO_SETTINGS[definition.key];
          return (
            <article key={definition.key} className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <h3 className="text-lg font-black">{definition.label}</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Eyebrow</span>
                  <input
                    value={hero.eyebrow}
                    onChange={(event) => updateHero(definition.key, "eyebrow", event.target.value)}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Title</span>
                  <input
                    value={hero.title}
                    onChange={(event) => updateHero(definition.key, "title", event.target.value)}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Subtitle</span>
                  <input
                    value={hero.dek}
                    onChange={(event) => updateHero(definition.key, "dek", event.target.value)}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </label>
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
  );
}
