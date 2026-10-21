import { notFound } from "next/navigation";
import { StudioShell } from "@/components/rooms/StudioShell";
import { DossierCards } from "@/components/lore/LorePresentation";
import { loreEnabled } from "@/lib/lore/core.mjs";
import { publicDossiers } from "@/lib/lore/server";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Lore",
  description: "Worlds, factions, people, histories and places in EGGS.",
};
export default async function LorePage() {
  if (!loreEnabled()) notFound();
  const { entries, unavailable } = await publicDossiers();
  const worlds = entries.filter((row) => row.kind === "world");
  return (
    <StudioShell>
      <main className="studio-main lore-page">
        <header className="lore-front">
          <p className="studio-kicker">THE EGGS WORLD ARCHIVE</p>
          <h1>
            There’s a world
            <br />
            <em>behind every story.</em>
          </h1>
          <p className="studio-lede">
            Find the factions, meet the people, trace an event. Follow a word
            somewhere new.
          </p>
          <span aria-hidden="true" className="lore-seal">
            OPEN A<br />
            DOSSIER
            <br />↗
          </span>
        </header>
        <section aria-labelledby="lore-worlds">
          <div className="lore-section-heading">
            <h2 id="lore-worlds">Choose a world.</h2>
            <span>FACTIONS · PEOPLE · EVENTS · TERMS · PLACES</span>
          </div>
          {unavailable ? (
            <p role="status" className="lore-empty">
              The world archive is temporarily unavailable.
            </p>
          ) : worlds.length ? (
            <DossierCards entries={worlds} />
          ) : (
            <p className="lore-empty">
              The archive is ready for its first reviewed world dossiers.
            </p>
          )}
        </section>
        <aside className="lore-reader-note">
          <h2>Know which story you’re in.</h2>
          <p>
            Each world keeps its own continuity, voices and source notes. A
            comic, a player page and a lore dossier can all belong here without
            becoming the same kind of record.
          </p>
        </aside>
      </main>
    </StudioShell>
  );
}
