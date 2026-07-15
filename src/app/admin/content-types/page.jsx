import { AdminCard, AdminShell } from "@/components/admin-newsroom/AdminShell";
import { getDraftTypes } from "@/lib/newsroom/draftTypes";

export default function AdminContentTypesPage() {
  const types = getDraftTypes();

  return (
    <AdminShell
      title="Content Types"
      description="Canonical registry for newsroom content. Prompts, generators, editors, draft tables, and public slots should route through these definitions."
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {types.map((type) => (
          <AdminCard key={type.key} title={type.label} meta={type.key}>
            <div className="space-y-3">
              <p>{type.purpose}</p>
              <dl className="grid gap-2 text-xs">
                <RegistryRow label="Endpoint" value={type.endpoint} />
                <RegistryRow label="Draft table" value={type.draftTable} />
                <RegistryRow label="Scope" value={type.fallbackScope} />
                <RegistryRow label="Schema" value={type.schemaKey} />
                <RegistryRow label="Editor body" value={type.editor?.bodyField} />
                <RegistryRow label="Public slot" value={type.publishTarget?.slot} />
                <RegistryRow label="Season aware" value={type.seasonAware ? "yes" : "no"} />
              </dl>
              {type.variations?.length ? (
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-700">Variations</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {type.variations.map((variation) => (
                      <span key={variation.key} className="rounded-sm border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-bold text-zinc-700">
                        {variation.label}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </AdminCard>
        ))}
      </section>
    </AdminShell>
  );
}

function RegistryRow({ label, value }) {
  return (
    <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-2">
      <dt className="font-black uppercase tracking-[0.08em] text-zinc-500">{label}</dt>
      <dd className="min-w-0 break-words font-mono text-zinc-800">{value || "-"}</dd>
    </div>
  );
}
