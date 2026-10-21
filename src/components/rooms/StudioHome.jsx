import Link from "next/link";
import { StudioShell } from "./StudioShell";
import { StudioProject } from "./StudioProject";
import { WorkCard } from "./WorkPresentation";
import { loreEnabled } from "@/lib/lore/core.mjs";
import { PublicationCard } from "@/components/reath/ReathDigest";
export function StudioHome({
  projects,
  works,
  unavailable,
  worksUnavailable,
  community = false,
  feed = null,
  releases = [],
}) {
  return (
    <StudioShell>
      <main className="studio-main">
        <section className="studio-banner">
          <div>
            <p className="studio-kicker">WELCOME TO YOUR CORNER OF THE WEB</p>
            <h1>
              Games. Stories.
              <br />
              <em>Your kind of people.</em>
            </h1>
            <p>
              Welcome to EGGS. Find your next game, read something from Reath,
              and make a little corner of the internet your own.
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
        <nav className="studio-channels" aria-label="Find your corner">
          <Link href="/games">
            <span>01 / PLAY</span>
            <h2>Pull up a chair.</h2>
            <p>Gauntlet, Poker, and competition with a story.</p>
            <b>Games & leagues ↗</b>
          </Link>
          <Link href="/reath-digest">
            <span>02 / READ & WATCH</span>
            <h2>Meet Reath Digest.</h2>
            <p>Our publications, Funnies, comics, and moving pictures.</p>
            <b>Open the reading room ↗</b>
          </Link>
          <Link href={community ? "/community" : "/profile"}>
            <span>03 / BELONG</span>
            <h2>A familiar face.</h2>
            <p>
              {community
                ? "A shared feed, public pages, and people who make things."
                : "A page that feels like you. Games, interests, and a place to begin."}
            </p>
            <b>
              {community
                ? "Join the conversation ↗"
                : "Make your EGGS page ↗"}
            </b>
          </Link>
        </nav>
        {loreEnabled() ? (
          <section className="studio-lore-invitation">
            <div>
              <p className="studio-kicker">
                BEYOND THE PAGE / THE WORLD ARCHIVE
              </p>
              <h2>Every world has its people.</h2>
              <p>
                Explore the factions, people, events, terms and places behind
                the stories.
              </p>
            </div>
            <Link href="/lore">Open the lore dossiers ↗</Link>
          </section>
        ) : null}
        <div className="bulletin-heading">
          <h2>Made around here.</h2>
          <span>THE EGGS PROJECTS & LIBRARY</span>
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
          {releases.map((release) => (
            <PublicationCard key={release.id} publication={release} />
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
        {community ? (
          <section className="studio-community-preview">
            <header>
              <div>
                <p className="studio-kicker">PEOPLE MAKE EGGS</p>
                <h2>From our little corner.</h2>
              </div>
              <Link href="/community">The community feed ↗</Link>
            </header>
            {feed?.posts?.length ? (
              <div className="studio-feed-previews">
                {feed.posts.map((post) => (
                  <article key={post.id}>
                    <Link href={"/profile/" + post.author.handle}>
                      @{post.author.handle}
                    </Link>
                    <p>{post.body}</p>
                    <Link href={"/community/" + post.id}>
                      Join the conversation ↗
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <div className="studio-community-welcome">
                <h3>Every good place starts with a hello.</h3>
                <p>
                  A thought, a question, something you made. There’s room for it
                  here.
                </p>
                <Link href="/community">Say hello ↗</Link>
                <Link href="/people">Find your people ↗</Link>
              </div>
            )}
          </section>
        ) : null}
      </main>
    </StudioShell>
  );
}
