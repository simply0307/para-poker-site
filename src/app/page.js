import Link from "next/link";

export default function EggsHome() {
  return (
    <main className="eggs-page">
      <section className="eggs-hero">
        <div>
          <p className="eggs-eyebrow">The EGGS ecosystem</p>
          <h1>Many ways in.<br />One place to belong.</h1>
          <p className="eggs-intro">Games, competition, music, and the things you make. A growing home for everything you do with EGGS.</p>
          <Link className="eggs-button" href="/para">Explore Para <span aria-hidden="true">↗</span></Link>
        </div>
        <aside className="eggs-identity-note">
          <p className="eggs-eyebrow">On the way</p>
          <h2>Your identity,<br />across EGGS.</h2>
          <p>One account. Your chosen handle. A profile that connects your projects while each keeps its own story.</p>
          <Link className="eggs-text-link" href="/profile">About EGGS profiles <span aria-hidden="true">↗</span></Link>
        </aside>
      </section>

      <section aria-labelledby="projects-title" className="eggs-section">
        <div className="eggs-section-heading"><h2 id="projects-title">Find your next project.</h2><p>A place for every kind of participation.</p></div>
        <div className="eggs-project-grid">
          <article className="eggs-project eggs-project-featured">
            <p className="eggs-eyebrow">Para / Organized competition</p>
            <h3>Para Poker League</h3>
            <p>The league’s home for standings, session coverage, player dossiers, and the public record.</p>
            <Link className="eggs-text-link" href="/para/poker">Explore the league <span aria-hidden="true">↗</span></Link>
          </article>
          <article className="eggs-project">
            <p className="eggs-eyebrow">Games / Future connection</p>
            <h3>Gauntlet Online</h3>
            <p>A separate EGGS project. Shared account support and a connection to your profile are planned.</p>
            <span className="eggs-status">Integration coming later</span>
          </article>
        </div>
      </section>

      <section className="eggs-section eggs-explore" aria-label="More in EGGS">
        <Link href="/music"><span className="eggs-eyebrow">Coming later</span><h2>Music <span aria-hidden="true">↗</span></h2><p>An archive to explore. A song to make your profile yours.</p></Link>
        <Link href="/library"><span className="eggs-eyebrow">Coming later</span><h2>Your library <span aria-hidden="true">↗</span></h2><p>A personal place for saved content, publications, and artifacts.</p></Link>
      </section>
      <footer className="eggs-footer">EGGS <span>Projects, people &amp; play.</span></footer>
    </main>
  );
}
