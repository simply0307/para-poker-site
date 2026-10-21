import { notFound } from "next/navigation";
import { roomsEnabled } from "@/lib/rooms/core.mjs";
import { publicCatalog } from "@/lib/hub/server";
import { StudioShell } from "@/components/rooms/StudioShell";
import { StudioProject } from "@/components/rooms/StudioProject";
export const dynamic = "force-dynamic";
export const metadata = { title: "Games & leagues" };
export default async function Games() {
  if (!roomsEnabled()) notFound();
  const { projects, unavailable } = await publicCatalog();
  const games = projects.filter((p) =>
    ["game", "league"].includes(p.content.category),
  );
  return (
    <StudioShell>
      <main className="studio-main">
        <div className="studio-page-title">
          <p className="studio-kicker">PICK YOUR NEXT OBSESSION</p>
          <h1>Come out &amp; play.</h1>
          <p>Games with their own worlds. Leagues with a story to follow.</p>
        </div>
        {unavailable ? (
          <p role="status">The directory is temporarily unavailable.</p>
        ) : games.length ? (
          <div className="studio-bulletin">
            {games.map((p) => (
              <StudioProject key={p.id} project={p} />
            ))}
          </div>
        ) : (
          <p className="studio-empty">No published games or leagues yet.</p>
        )}
      </main>
    </StudioShell>
  );
}
