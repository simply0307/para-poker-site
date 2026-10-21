import Link from "next/link";
import { notFound } from "next/navigation";
import { workspace } from "@/lib/hub/workspace";
import { loreEnabled } from "@/lib/lore/core.mjs";
import { loreRepository } from "@/lib/lore/repository.mjs";
export default async function LoreAdmin() {
  if (!loreEnabled()) notFound();
  const access = await workspace();
  if (access.error) return <p role="alert">{access.error}</p>;
  let entries;
  try {
    entries = await loreRepository(access.client).drafts();
  } catch {
    return <p role="alert">Dossiers could not be loaded.</p>;
  }
  return (
    <>
      <div className="hub-page-heading">
        <p className="eggs-eyebrow">EGGS world archive / {access.role}</p>
        <h1>The lore desk.</h1>
        <p>
          World overviews, then their factions, people, events, terms and
          places. Save, preview, deliberately publish.
        </p>
        <Link className="eggs-button" href="/eggs-admin/lore/new">
          Create a dossier +
        </Link>
      </div>
      <div className="hub-admin-list">
        {entries.map((entry) => (
          <article key={entry.id}>
            <div>
              <span className="hub-chip">{entry.state}</span>
              <h2>
                <Link href={"/eggs-admin/lore/" + entry.id}>
                  {entry.content.title}
                </Link>
              </h2>
              <p>
                {entry.world} / {entry.kind} / {entry.slug} · revision{" "}
                {entry.version}
              </p>
            </div>
          </article>
        ))}
      </div>
      {!entries.length ? (
        <p>No dossiers yet. Begin with a world overview.</p>
      ) : null}
    </>
  );
}
