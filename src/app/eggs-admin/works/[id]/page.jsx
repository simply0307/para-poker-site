import { notFound } from "next/navigation";
import { workspace } from "@/lib/hub/workspace";
import { roomsEnabled } from "@/lib/rooms/core.mjs";
import { roomRepository } from "@/lib/rooms/repository.mjs";
import { WorkEditor } from "@/components/rooms/WorkEditor";
export default async function EditWork({ params }) {
  if (!roomsEnabled()) notFound();
  const access = await workspace();
  if (access.error) return <p role="alert">{access.error}</p>;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/u.test(id)) notFound();
  let work, projects, audit;
  try {
    const repo = roomRepository(access.client);
    [work, projects, audit] = await Promise.all([
      repo.draft(id),
      access.repository.published(),
      repo.audit(id),
    ]);
  } catch {
    return <p role="alert">This work could not be loaded.</p>;
  }
  if (!work) notFound();
  return (
    <>
      <h1>Edit work</h1>
      <WorkEditor key={work.version} work={work} projects={projects} />
      <section className="eggs-account-section">
        <h2>Editorial history</h2>
        <ul>
          {audit.map((a) => (
            <li key={a.id}>
              {a.action} · revision {a.version} · {a.occurred_at}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
