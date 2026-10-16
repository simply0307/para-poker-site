import Link from "next/link";
import { notFound } from "next/navigation";
import { workspace } from "@/lib/hub/workspace";
import { roomsEnabled } from "@/lib/rooms/core.mjs";
import { roomRepository } from "@/lib/rooms/repository.mjs";
import { WorkShowcase } from "@/components/rooms/WorkPresentation";
import { WorkPublication } from "@/components/rooms/WorkEditor";
export default async function PreviewWork({ params }) {
  if (!roomsEnabled()) notFound();
  const access = await workspace();
  if (access.error) return <p role="alert">{access.error}</p>;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/u.test(id)) notFound();
  let work, projects;
  try {
    [work, projects] = await Promise.all([
      roomRepository(access.client).draft(id),
      access.repository.published(),
    ]);
  } catch {
    return <p role="alert">Preview could not be loaded.</p>;
  }
  if (!work) notFound();
  return (
    <>
      <Link href={"/eggs-admin/works/" + id}>← Edit saved work</Link>
      <p>Saved revision {work.version}. This preview is private.</p>
      <WorkShowcase
        preview
        work={work}
        project={projects.find((p) => p.id === work.content.project_id)}
      />
      {access.role === "publisher" ? (
        <div className="hub-actions">
          <WorkPublication
            key={work.version + "publish"}
            work={work}
            action="publish"
          />
          <WorkPublication
            key={work.version + "archive"}
            work={work}
            action="archive"
          />
        </div>
      ) : (
        <p>A publisher can publish or archive this saved revision.</p>
      )}
    </>
  );
}
