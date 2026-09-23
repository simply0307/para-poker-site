"use client";

import { useState, useTransition } from "react";

const statusOptions = ["draft", "scheduled", "live", "complete", "cancelled"];

function emptyEvent() {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `event-${Date.now()}`,
    title: "Future table",
    dek: "This event is staged by the newsroom and will connect to the game site later.",
    displayDate: "",
    startsAt: "",
    venue: "",
    status: "draft",
    enabled: true,
    publicVisible: true,
    ctaLabel: "Event details",
    ctaHref: "",
    source: "admin_draft",
    notes: "",
  };
}

export function UpcomingEventsForm({ initialSettings }) {
  const [settings, setSettings] = useState(initialSettings || { events: [] });
  const [selectedId, setSelectedId] = useState(settings.events?.[0]?.id || "");
  const [message, setMessage] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const events = Array.isArray(settings.events) ? settings.events : [];
  const selectedEvent = events.find((event) => event.id === selectedId) || events[0] || null;

  function markDirty() {
    setIsDirty(true);
    setMessage("");
  }

  function updateEvent(id, patch) {
    setSettings((current) => ({
      ...current,
      events: (current.events || []).map((event) => (event.id === id ? { ...event, ...patch } : event)),
    }));
    markDirty();
  }

  function addEvent() {
    const nextEvent = emptyEvent();
    setSettings((current) => ({
      ...current,
      events: [nextEvent, ...(current.events || [])],
    }));
    setSelectedId(nextEvent.id);
    markDirty();
  }

  function deleteEvent(id) {
    const nextEvents = events.filter((event) => event.id !== id);
    setSettings((current) => ({ ...current, events: nextEvents }));
    setSelectedId(nextEvents[0]?.id || "");
    markDirty();
  }

  async function saveSettings() {
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/admin/upcoming-events", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || "Could not save upcoming events.");
        return;
      }
      setSettings(payload.settings);
      setSelectedId(payload.settings.events?.find((event) => event.id === selectedId)?.id || payload.settings.events?.[0]?.id || "");
      setIsDirty(false);
      setMessage("Upcoming event drafts saved.");
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <section className="rounded-lg border border-zinc-300 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Draft room</p>
            <h2 className="text-2xl font-black">Future events</h2>
          </div>
          <button type="button" onClick={addEvent} className="rounded-sm bg-zinc-950 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white">
            Add
          </button>
        </div>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Stage upcoming table cards for the public homepage. This is manual for now and can later be replaced by a live game-site feed.
        </p>
        <div className="mt-4 max-h-[560px] overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-2">
          {events.length ? events.map((event) => (
            <button
              type="button"
              key={event.id}
              onClick={() => setSelectedId(event.id)}
              className={`mb-2 block w-full rounded-sm border p-3 text-left text-sm last:mb-0 ${
                selectedEvent?.id === event.id ? "border-amber-700 bg-amber-50" : "border-zinc-200 bg-white hover:border-amber-500"
              }`}
            >
              <span className="block font-black text-zinc-950">{event.title}</span>
              <span className="mt-1 block text-xs font-bold uppercase tracking-wide text-zinc-500">
                {[event.status, event.displayDate || event.startsAt || "date pending"].filter(Boolean).join(" / ")}
              </span>
              {event.publicVisible && event.enabled ? <span className="mt-2 inline-flex rounded-sm bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-800">Homepage eligible</span> : null}
            </button>
          )) : (
            <p className="p-3 text-sm font-bold text-zinc-500">No event drafts yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
        {selectedEvent ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Event card</p>
                <h2 className="mt-1 text-3xl font-black">{selectedEvent.title}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                  Public visibility makes the event eligible for homepage modules. It does not create a public event route yet.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => deleteEvent(selectedEvent.id)}
                  className="rounded-sm border border-rose-300 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-rose-700"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={saveSettings}
                  disabled={isPending}
                  className="rounded-sm bg-zinc-950 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50"
                >
                  {isPending ? "Saving" : "Save Events"}
                </button>
              </div>
            </div>

            {isDirty ? (
              <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                Unsaved event changes. The public homepage only reads saved events.
              </p>
            ) : null}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <TextInput label="Title" value={selectedEvent.title} onChange={(value) => updateEvent(selectedEvent.id, { title: value })} />
              <TextInput label="Display date" value={selectedEvent.displayDate} onChange={(value) => updateEvent(selectedEvent.id, { displayDate: value })} />
              <TextInput label="Start timestamp" value={selectedEvent.startsAt} onChange={(value) => updateEvent(selectedEvent.id, { startsAt: value })} />
              <TextInput label="Venue / table" value={selectedEvent.venue} onChange={(value) => updateEvent(selectedEvent.id, { venue: value })} />
              <Select label="Status" value={selectedEvent.status} options={statusOptions} onChange={(value) => updateEvent(selectedEvent.id, { status: value })} />
              <TextInput label="CTA label" value={selectedEvent.ctaLabel} onChange={(value) => updateEvent(selectedEvent.id, { ctaLabel: value })} />
              <TextInput label="CTA href" value={selectedEvent.ctaHref} onChange={(value) => updateEvent(selectedEvent.id, { ctaHref: value })} />
              <div className="flex flex-wrap items-end gap-4 pb-2">
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input type="checkbox" checked={selectedEvent.enabled !== false} onChange={(event) => updateEvent(selectedEvent.id, { enabled: event.target.checked })} />
                  Active draft
                </label>
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input type="checkbox" checked={selectedEvent.publicVisible !== false} onChange={(event) => updateEvent(selectedEvent.id, { publicVisible: event.target.checked })} />
                  Homepage eligible
                </label>
              </div>
            </div>

            <Textarea label="Dek" value={selectedEvent.dek} onChange={(value) => updateEvent(selectedEvent.id, { dek: value })} />
            <Textarea label="Admin notes" value={selectedEvent.notes} onChange={(value) => updateEvent(selectedEvent.id, { notes: value })} />

            {message ? (
              <p className={`mt-4 rounded-md border p-3 text-sm font-bold ${message.includes("Could not") ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                {message}
              </p>
            ) : null}
          </>
        ) : (
          <div className="rounded-md border border-dashed border-zinc-300 p-6">
            <h2 className="text-2xl font-black">No event selected</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">Add a future event draft to stage the homepage placeholder lane.</p>
            <button type="button" onClick={addEvent} className="mt-4 rounded-sm bg-zinc-950 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white">
              Add event draft
            </button>
          </div>
        )}
      </section>
    </div>
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

function Textarea({ label, value, onChange }) {
  return (
    <label className="mt-4 block">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">{label}</span>
      <textarea value={value || ""} onChange={(event) => onChange(event.target.value)} rows={4} className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm leading-6" />
    </label>
  );
}

function Select({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">{label}</span>
      <select value={value || ""} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm capitalize">
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
