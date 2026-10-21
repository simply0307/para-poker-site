import { roomsEnabled } from "@/lib/rooms/core.mjs";
import { publicWorks } from "@/lib/rooms/server";
import { StudioShell } from "@/components/rooms/StudioShell";
import { WorkCard } from "@/components/rooms/WorkPresentation";
import { FuturePage } from "@/components/eggs/FuturePage";
export const dynamic = "force-dynamic";
export const metadata = { title: "Library" };
export default async function Library() {
  if (!roomsEnabled())
    return (
      <FuturePage eyebrow="EGGS / Library" title="Keep what matters to you.">
        <p>The EGGS library will open here when it is ready.</p>
      </FuturePage>
    );
  const { works, unavailable } = await publicWorks();
  return (
    <StudioShell>
      <main className="studio-main">
        <div className="studio-page-title">
          <p className="studio-kicker">COLLECTED WITH INTENTION</p>
          <h1>The library.</h1>
          <p>
            Original works, curious artifacts, and things worth a second look.
          </p>
        </div>
        {unavailable ? (
          <p role="status">The library is temporarily unavailable.</p>
        ) : works.length ? (
          <div className="studio-bulletin">
            {works.map((w) => (
              <WorkCard key={w.id} work={w} />
            ))}
          </div>
        ) : (
          <p className="studio-empty">
            The shelves are ready. Works appear here after editorial
            publication.
          </p>
        )}
      </main>
    </StudioShell>
  );
}
