"use client";

import { useState, useTransition } from "react";
import { OVERRIDE_FIELD_SUGGESTIONS, OVERRIDE_SCOPES } from "@/lib/newsroom/dataOverridesConstants";

const emptyForm = {
  scope: "session",
  source_id: "",
  field_path: "",
  value: "",
  reason: "",
};

function valuePreview(value) {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function DataOverridesManager({ initialOverrides = [] }) {
  const [overrides, setOverrides] = useState(initialOverrides);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage("");
  }

  async function createOverride(event) {
    event.preventDefault();
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/admin/data-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || "Could not save override.");
        return;
      }
      setOverrides(payload.overrides || []);
      setForm(emptyForm);
      setMessage("Override recorded. It is not applied to public pages until wired into view models.");
    });
  }

  async function deleteOverride(id) {
    setMessage("");
    startTransition(async () => {
      const response = await fetch(`/api/admin/data-overrides/${encodeURIComponent(id)}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || "Could not delete override.");
        return;
      }
      setOverrides(payload.overrides || []);
      setMessage("Override deleted.");
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
      <form onSubmit={createOverride} className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Correction layer</p>
        <h2 className="mt-1 text-2xl font-black">Add override</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Record reviewed public corrections without changing imported rows. Use stable ids or codes like S0-001, a player id, or a hand id.
        </p>

        <label className="mt-5 block">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Scope</span>
          <select value={form.scope} onChange={(event) => update("scope", event.target.value)} className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm">
            {OVERRIDE_SCOPES.map((scope) => (
              <option key={scope} value={scope}>{scope}</option>
            ))}
          </select>
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Source id or code</span>
          <input
            value={form.source_id}
            onChange={(event) => update("source_id", event.target.value)}
            placeholder="S0-001, player id, hand id..."
            className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            required
          />
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Field path</span>
          <input
            value={form.field_path}
            onChange={(event) => update("field_path", event.target.value)}
            list="override-fields"
            placeholder="display_name"
            className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            required
          />
          <datalist id="override-fields">
            {OVERRIDE_FIELD_SUGGESTIONS.map((field) => (
              <option key={field} value={field} />
            ))}
          </datalist>
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Reviewed value</span>
          <textarea
            value={form.value}
            onChange={(event) => update("value", event.target.value)}
            rows={4}
            placeholder="Corrected public value. JSON is allowed."
            className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            required
          />
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Reason</span>
          <textarea
            value={form.reason}
            onChange={(event) => update("reason", event.target.value)}
            rows={3}
            placeholder="Why this correction exists."
            className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <button type="submit" disabled={isPending} className="mt-5 rounded-sm bg-zinc-950 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-50">
          {isPending ? "Saving" : "Record Override"}
        </button>

        {message ? (
          <p className={`mt-4 rounded-md border p-3 text-sm font-bold ${message.includes("Could not") ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {message}
          </p>
        ) : null}
      </form>

      <section className="rounded-lg border border-zinc-300 bg-white shadow-sm">
        <div className="border-b border-zinc-200 p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Reviewed overrides</p>
          <h2 className="mt-1 text-2xl font-black">{overrides.length} records</h2>
        </div>
        <div className="divide-y divide-zinc-200">
          {overrides.length ? overrides.map((override) => (
            <article key={override.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{override.scope} / {override.source_id}</p>
                  <h3 className="mt-1 text-xl font-black">{override.field_path}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => deleteOverride(override.id)}
                  disabled={isPending}
                  className="rounded-sm border border-rose-200 px-2.5 py-1.5 text-xs font-black uppercase tracking-[0.1em] text-rose-700 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
              <pre className="mt-3 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-zinc-700">{valuePreview(override.value)}</pre>
              {override.reason ? <p className="mt-3 text-sm leading-6 text-zinc-600">{override.reason}</p> : null}
              <p className="mt-3 text-xs text-zinc-400">Updated {new Date(override.updated_at).toLocaleString("en-US")}</p>
            </article>
          )) : (
            <p className="p-5 text-sm leading-6 text-zinc-600">No overrides recorded yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
