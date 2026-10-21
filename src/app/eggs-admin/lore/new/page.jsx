import { notFound } from "next/navigation";
import { workspace } from "@/lib/hub/workspace";
import { loreEnabled } from "@/lib/lore/core.mjs";
import { loreRepository } from "@/lib/lore/repository.mjs";
import { LoreEditor } from "@/components/lore/LoreEditor";
export default async function NewDossier() {
  if (!loreEnabled()) notFound();
  const access = await workspace();
  if (access.error) return <p role="alert">{access.error}</p>;
  let rows, projects;
  try {
    [rows, projects] = await Promise.all([
      loreRepository(access.client).published(),
      access.repository.published(),
    ]);
  } catch {
    return <p role="alert">The lore desk is unavailable.</p>;
  }
  return (
    <>
      <h1>Create a lore dossier</h1>
      <LoreEditor
        worlds={rows.filter((row) => row.kind === "world")}
        projects={projects}
      />
    </>
  );
}
