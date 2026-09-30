"use client";

import { useMemo, useState, useTransition } from "react";

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function cleanIds(value = []) {
  return [...new Set((value || []).map((item) => text(item).trim()).filter(Boolean))];
}

export function MomentCurationPanel({ moments = [], initialSettings = { featuredMomentId: "", majorMomentIds: [] } }) {
  const [settings, setSettings] = useState({
    featuredMomentId: text(initialSettings.featuredMomentId),
    majorMomentIds: cleanIds(initialSettings.majorMomentIds),
  });
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const filteredMoments = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return moments;
    return moments.filter((moment) =>
      [moment.id, moment.label, moment.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [moments, query]);

  function toggleMajor(momentId) {
    setSettings((current) => {
      const currentIds = new Set(current.majorMomentIds);
      if (currentIds.has(momentId)) currentIds.delete(momentId);
      else currentIds.add(momentId);
      return { ...current, majorMomentIds: [...currentIds] };
    });
    setMessage("");
  }

  async function saveSettings() {
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/admin/moment-curation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Could not save moment curation.");
        return;
      }
      setSettings(payload.settings);
      setMessage("Moment curation saved.");
    });
  }

  if (!moments.length) return null;

  return (
    <section className="rounded-lg border border-zinc-300 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Moment curation</p>
          <h2 className="text-2xl font-black">Feature and major markers</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Detected moments remain candidates. Use this panel to mark one featured moment and any major archive moments without changing imported hand rows.
          </p>
        </div>
        <button
          type="button"
          onClick={saveSettings}
          disabled={isPending}
          className="rounded-md bg-zinc-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Curation"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by hand, player, pot, session, or reason..."
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2.5 text-sm"
        />
        <button type="button" onClick={() => setSettings({ featuredMomentId: "", majorMomentIds: [] })} className="rounded-md border border-zinc-300 px-3 py-2.5 text-sm font-black">
          Clear
        </button>
      </div>

      <div className="mt-4 max-h-[26rem] overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredMoments.map((moment) => {
            const momentId = text(moment.id);
            const featured = settings.featuredMomentId === momentId;
            const major = settings.majorMomentIds.includes(momentId);
            return (
              <article key={momentId} className={`rounded-md border bg-white p-3 ${featured || major ? "border-amber-600" : "border-zinc-200"}`}>
                <p className="font-black text-zinc-950">{moment.label}</p>
                {moment.description ? <p className="mt-1 text-sm leading-6 text-zinc-600">{moment.description}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSettings((current) => ({ ...current, featuredMomentId: featured ? "" : momentId }))}
                    className={`rounded-md border px-3 py-2 text-xs font-black uppercase tracking-[0.1em] ${featured ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-300 bg-white text-zinc-800"}`}
                  >
                    {featured ? "Featured" : "Set Featured"}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleMajor(momentId)}
                    className={`rounded-md border px-3 py-2 text-xs font-black uppercase tracking-[0.1em] ${major ? "border-amber-600 bg-amber-100 text-amber-900" : "border-zinc-300 bg-white text-zinc-800"}`}
                  >
                    {major ? "Major" : "Mark Major"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {message ? (
        <p className={`mt-4 rounded-md p-3 font-bold ${message.includes("Could not") ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
          {message}
        </p>
      ) : null}
    </section>
  );
}
