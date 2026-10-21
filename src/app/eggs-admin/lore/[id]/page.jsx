import { notFound } from "next/navigation";
import { workspace } from "@/lib/hub/workspace";
import { loreEnabled } from "@/lib/lore/core.mjs";
import { loreRepository } from "@/lib/lore/repository.mjs";
import { LoreEditor } from "@/components/lore/LoreEditor";
export default async function EditDossier({ params }) {
  if (!loreEnabled()) notFound();
  const access = await workspace();
  if (access.error) return <p role="alert">{access.error}</p>;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/u.test(id)) notFound();
  let entry, rows, projects, audit;
  try {
    const repo = loreRepository(access.client);
    [entry, rows, projects, audit] = await Promise.all([
      repo.draft(id),
      repo.published(),
      access.repository.published(),
      repo.audit(id),
    ]);
  } catch {
    return <p role="alert">This dossier could not be loaded.</p>;
  }
  if (!entry) notFound();
  return (
    <>
      <h1>Edit dossier</h1>
      <LoreEditor
        key={entry.version}
        entry={entry}
        worlds={rows.filter((row) => row.kind === "world")}
        projects={projects}
      />
      <section className="eggs-account-section">
        <h2>Editorial history</h2>
        <ul>
          {audit.map((row) => (
            <li key={row.id}>
              {row.action} · revision {row.version} · {row.occurred_at}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
