import Link from "next/link";
import { notFound } from "next/navigation";
import { workspace } from "@/lib/hub/workspace";
import { loreEnabled } from "@/lib/lore/core.mjs";
import { loreRepository } from "@/lib/lore/repository.mjs";
import { DossierBody } from "@/components/lore/LorePresentation";
import { LorePublication } from "@/components/lore/LoreEditor";
export default async function PreviewDossier({ params }) {
  if (!loreEnabled()) notFound();
  const access = await workspace();
  if (access.error) return <p role="alert">{access.error}</p>;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/u.test(id)) notFound();
  let entry;
  try {
    entry = await loreRepository(access.client).draft(id);
  } catch {
    return <p role="alert">This saved preview is unavailable.</p>;
  }
  if (!entry) notFound();
  return (
    <>
      <Link href={"/eggs-admin/lore/" + id}>← Edit saved dossier</Link>
      <p>Saved revision {entry.version}. This preview is private.</p>
      <DossierBody entry={entry} preview />
      {access.role === "publisher" ? (
        <div className="hub-actions">
          <LorePublication
            key={entry.version + "publish"}
            entry={entry}
            action="publish"
          />
          <LorePublication
            key={entry.version + "archive"}
            entry={entry}
            action="archive"
          />
        </div>
      ) : (
        <p>A publisher can publish or archive this saved revision.</p>
      )}
      {entry.kind === "world" ? (
        <p>
          Archiving a world hides its dossiers from readers; their stored drafts
          and history remain.
        </p>
      ) : null}
    </>
  );
}
