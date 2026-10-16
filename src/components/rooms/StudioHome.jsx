import Link from "next/link";
import { StudioShell } from "./StudioShell";
import { StudioProject } from "./StudioProject";
import { WorkCard } from "./WorkPresentation";
export function StudioHome({ projects, works, unavailable, worksUnavailable }) {
  return (
    <StudioShell>
      <main className="studio-main">
        <section className="studio-banner">
          <div>
            <p className="studio-kicker">WELCOME TO YOUR CORNER OF THE WEB</p>
            <h1>
              A little strange.
              <br />
              <em>A lot of possibility.</em>
            </h1>
            <p>
              Games, stories, things we make. Find your people by starting with
              what you love.
            </p>
          </div>
          <Link className="studio-callout" href="/profile">
            <span aria-hidden="true">✳</span>
            <b>
              YOUR PAGE.
              <br />
              YOUR RULES.
            </b>
            <span>Make yourself at home ↗</span>
          </Link>
        </section>
        <div className="bulletin-heading">
          <h2>The bulletin board</h2>
          <span>GOOD THINGS, PINNED HERE.</span>
        </div>
        <div className="studio-bulletin">
          {unavailable ? (
            <p role="status">
              The project directory is temporarily unavailable.
            </p>
          ) : (
            projects.map((p) => <StudioProject key={p.id} project={p} />)
          )}
          {works.map((w) => (
            <WorkCard key={w.id} work={w} />
          ))}
          <aside className="studio-note">
            <span className="studio-stamp">NOTICE TO ALL VISITORS</span>
            <h2>You don’t have to be one thing.</h2>
            <p>
              A favorite game. A curious collection. A page that feels like you.
            </p>
            <Link href="/profile">Start with your EGGS profile ↗</Link>
          </aside>
          {worksUnavailable ? (
            <p role="status">The library is temporarily unavailable.</p>
          ) : null}
        </div>
      </main>
    </StudioShell>
  );
}
