import Link from "next/link";
import { publicCatalog } from "@/lib/hub/server";
import { ProjectCard } from "@/components/hub/ProjectPresentation";
import { roomsEnabled } from "@/lib/rooms/core.mjs";
import { publicWorks } from "@/lib/rooms/server";
import { StudioHome } from "@/components/rooms/StudioHome";
import { communityEnabled } from "@/lib/community/core.mjs";
import { publicFeed } from "@/lib/community/server";
import { existingReathReleases } from "@/lib/reath/releases.mjs";
export const dynamic = "force-dynamic";
export default async function EggsHome() {
  const { projects, unavailable } = await publicCatalog();
  if (roomsEnabled()) {
    const [{ works, unavailable: worksUnavailable }, feed] = await Promise.all([
      publicWorks(),
      communityEnabled() ? publicFeed({ p_limit: 3 }) : Promise.resolve(null),
    ]);
    return (
      <StudioHome
        projects={projects}
        works={works}
        unavailable={unavailable}
        worksUnavailable={worksUnavailable}
        community={communityEnabled()}
        feed={feed}
        releases={existingReathReleases()}
      />
    );
  }
  const featured = projects.filter((p) => p.content.featured);
  const selection = [
    ...featured,
    ...projects.filter((p) => !p.content.featured),
  ].slice(0, 4);
  return (
    <main className="eggs-page hub-home">
      <section className="hub-hero">
        <div>
          <p className="eggs-eyebrow">EGGS / An independent creative studio</p>
          <h1>
            Good things
            <br />
            start with
            <br />
            <em>curiosity.</em>
          </h1>
          <p className="hub-lede">
            Games, competition, worlds and stories. A shared home for the things
            we make—and the people who make them their own.
          </p>
          <div className="hub-actions">
            <Link className="eggs-button" href="/projects">
              Discover the projects ↗
            </Link>
            <Link className="eggs-text-link" href="/profile">
              Find your place ↗
            </Link>
          </div>
        </div>
        <aside className="hub-studio-note">
          <span className="hub-note-number" aria-hidden="true">
            01 / ∞
          </span>
          <p className="eggs-eyebrow">One studio. Many ways in.</p>
          <h2>
            Play something.
            <br />
            Follow a story.
            <br />
            Make it yours.
          </h2>
          <p>
            Each project has its own character. EGGS brings them together, with
            a profile for your interests and a place to discover what comes
            next.
          </p>
          <Link className="eggs-text-link" href="/para">
            Meet Para competition ↗
          </Link>
        </aside>
      </section>
      <section className="eggs-section">
        <div className="eggs-section-heading">
          <div>
            <p className="eggs-eyebrow">From the studio</p>
            <h2>Worth a closer look.</h2>
          </div>
          <Link className="eggs-text-link" href="/projects">
            All projects ↗
          </Link>
        </div>
        {unavailable ? (
          <p role="status" className="hub-empty">
            The project directory is temporarily unavailable.
          </p>
        ) : selection.length ? (
          <div className="hub-card-grid">
            {selection.map((p) => (
              <ProjectCard project={p} key={p.id} />
            ))}
          </div>
        ) : (
          <p className="hub-empty">
            New projects will appear here when they’re published.
          </p>
        )}
      </section>
      <section className="hub-belong">
        <div>
          <p className="eggs-eyebrow">Your EGGS profile</p>
          <h2>A little more you.</h2>
        </div>
        <div>
          <p>
            Choose your favorites, share what you’re into, and decide who can
            see it. Your profile starts private. Your game records stay with the
            games that created them.
          </p>
          <Link className="eggs-text-link" href="/profile">
            Your EGGS account ↗
          </Link>
        </div>
      </section>
      <footer className="eggs-footer">
        EGGS <span>Projects, people &amp; play.</span>
        <Link href="/eggs-admin">Editor workspace</Link>
      </footer>
    </main>
  );
}
