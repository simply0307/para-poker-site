import Link from "next/link";
import { notFound } from "next/navigation";
import { StudioShell } from "@/components/rooms/StudioShell";
import {
  LoreBreadcrumbs,
  LoreCategories,
} from "@/components/lore/LorePresentation";
import { loreEnabled } from "@/lib/lore/core.mjs";
import { loreSlug } from "@/lib/lore/presentation.mjs";
import { publicDossiers } from "@/lib/lore/server";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "World dossier",
  description: "Explore a world through its own reader dossiers.",
};
export default async function WorldPage({ params }) {
  const { world: slug } = await params;
  if (!loreEnabled() || !loreSlug(slug)) notFound();
  const { entries } = await publicDossiers();
  const world = entries.find(
    (row) => row.kind === "world" && row.world === slug,
  );
  if (!world) notFound();
  const dossiers = entries.filter(
    (row) => row.world === slug && row.kind !== "world",
  );
  return (
    <StudioShell>
      <main className="studio-main lore-page">
        <LoreBreadcrumbs world={world} />
        <header className="lore-front">
          <p className="studio-kicker">
            WORLD DOSSIER / {dossiers.length} ENTRIES
          </p>
          <h1>{world.content.title}</h1>
          <p className="studio-lede">{world.content.summary}</p>
        </header>
        <aside className="lore-continuity">
          <strong>Continuity &amp; scope</strong>
          <p>{world.content.continuity_note}</p>
        </aside>
        <div className="lore-world-intro">
          {world.content.body
            .split(/\n\s*\n/u)
            .filter(Boolean)
            .map((text, index) => (
              <p key={index}>{text}</p>
            ))}
        </div>
        <LoreCategories world={world} entries={dossiers} />
        <div className="lore-world-footer">
          <p>{world.content.attribution}</p>
          <Link href="/reath-digest">Read the publications ↗</Link>
        </div>
      </main>
    </StudioShell>
  );
}
