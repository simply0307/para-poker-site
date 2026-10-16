import { notFound } from "next/navigation";
import { roomsEnabled } from "@/lib/rooms/core.mjs";
import { publicWorks } from "@/lib/rooms/server";
import { publicCatalog } from "@/lib/hub/server";
import { StudioShell } from "@/components/rooms/StudioShell";
import { WorkShowcase } from "@/components/rooms/WorkPresentation";
export const dynamic = "force-dynamic";
export const metadata = { title: "Library work" };
export default async function WorkPage({ params }) {
  if (!roomsEnabled()) notFound();
  const { slug } = await params;
  const { works, unavailable } = await publicWorks();
  if (unavailable)
    return (
      <StudioShell>
        <main className="studio-main">
          <p role="status">This work is temporarily unavailable.</p>
        </main>
      </StudioShell>
    );
  const work = works.find((w) => w.slug === slug);
  if (!work) notFound();
  const { projects } = await publicCatalog();
  return (
    <StudioShell>
      <main className="studio-main">
        <WorkShowcase
          work={work}
          project={projects.find((p) => p.id === work.content.project_id)}
        />
      </main>
    </StudioShell>
  );
}
