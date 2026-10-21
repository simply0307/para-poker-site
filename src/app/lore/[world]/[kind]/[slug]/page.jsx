import Link from "next/link";
import { notFound } from "next/navigation";
import { StudioShell } from "@/components/rooms/StudioShell";
import {
  LoreBreadcrumbs,
  DossierBody,
} from "@/components/lore/LorePresentation";
import { loreEnabled } from "@/lib/lore/core.mjs";
import { dossierKinds, loreSlug } from "@/lib/lore/presentation.mjs";
import { publicDossiers } from "@/lib/lore/server";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Lore dossier",
  description: "A reader dossier from an EGGS world.",
};
export default async function DossierPage({ params }) {
  const { world: name, kind, slug } = await params;
  if (
    !loreEnabled() ||
    !loreSlug(name) ||
    !loreSlug(slug) ||
    !Object.hasOwn(dossierKinds, kind)
  )
    notFound();
  const { entries } = await publicDossiers();
  const world = entries.find(
    (row) => row.world === name && row.kind === "world",
  );
  const entry = entries.find(
    (row) => row.world === name && row.kind === kind && row.slug === slug,
  );
  if (!world || !entry) notFound();
  return (
    <StudioShell>
      <main className="studio-main lore-page">
        <LoreBreadcrumbs world={world} kind={kind} entry={entry} />
        <DossierBody entry={entry} />
        <Link className="lore-back" href={`/lore/${name}/${kind}`}>
          ← All {dossierKinds[kind].title.toLowerCase()}
        </Link>
      </main>
    </StudioShell>
  );
}
