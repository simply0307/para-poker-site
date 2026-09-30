export function AppliedOverridesPanel({ overrides = [] }) {
  if (!overrides.length) return null;

  return (
    <section className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-5 text-zinc-950">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-800">Active correction layer</p>
      <h2 className="mt-1 text-2xl font-black">{overrides.length} applied override{overrides.length === 1 ? "" : "s"}</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {overrides.map((override) => (
          <article key={`${override.id}-${override.field_path}`} className="rounded-md border border-amber-200 bg-white/70 p-3">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">
              {override.scope} / {override.source_id}
            </p>
            <p className="mt-1 font-black">{override.field_path}</p>
            {override.reason ? <p className="mt-1 text-sm leading-6 text-zinc-600">{override.reason}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
