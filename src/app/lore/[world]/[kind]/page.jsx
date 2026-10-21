import { notFound } from "next/navigation";
import { StudioShell } from "@/components/rooms/StudioShell";
import { LoreBreadcrumbs } from "@/components/lore/LorePresentation";
import { DossierDirectory } from "@/components/lore/DossierDirectory";
import { loreEnabled } from "@/lib/lore/core.mjs";
import { dossierKinds, loreSlug } from "@/lib/lore/presentation.mjs";
import { publicDossiers } from "@/lib/lore/server";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Lore dossiers",
  description:
    "Factions, people, events, terms and places, organized by world.",
};
export default async function CategoryPage({ params }) {
  const { world: slug, kind } = await params;
  if (!loreEnabled() || !loreSlug(slug) || !Object.hasOwn(dossierKinds, kind))
    notFound();
  const { entries } = await publicDossiers();
  const world = entries.find(
    (row) => row.kind === "world" && row.world === slug,
  );
  if (!world) notFound();
  const info = dossierKinds[kind];
  return (
    <StudioShell>
      <main className="studio-main lore-page">
        <LoreBreadcrumbs world={world} kind={kind} />
        <header className="lore-section-heading">
          <div>
            <p className="studio-kicker">
              {world.content.title} / THE DOSSIERS
            </p>
            <h1>{info.title}</h1>
            <p>{info.description}</p>
          </div>
          <span className="lore-category-mark" aria-hidden="true">
            {info.mark}
          </span>
        </header>
        <DossierDirectory
          entries={entries.filter(
            (row) => row.world === slug && row.kind === kind,
          )}
        />
      </main>
    </StudioShell>
  );
}
