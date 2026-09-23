import Link from "next/link";

export const metadata = { title: "Para — Organized competition" };

export default function ParaPage() {
  return (
    <main className="eggs-page">
      <section className="eggs-hero eggs-hero-single">
        <p className="eggs-eyebrow">EGGS / Para</p>
        <h1>A home for<br />organized competition.</h1>
        <p className="eggs-intro">Para brings competition into EGGS. Each league keeps its players, results, and history.</p>
      </section>
      <section className="eggs-section" aria-labelledby="league-title">
        <article className="eggs-project eggs-project-featured">
          <p className="eggs-eyebrow">Explore the league</p>
          <h2 id="league-title">Para Poker League</h2>
          <p>Follow the season, explore the hands, and meet the players behind the results.</p>
          <div className="eggs-link-row">
            <Link className="eggs-button" href="/para/poker">League home ↗</Link>
            <Link className="eggs-text-link" href="/para/poker/players">Players</Link>
            <Link className="eggs-text-link" href="/para/poker/standings">Standings</Link>
            <Link className="eggs-text-link" href="/para/poker/sessions">Sessions</Link>
            <Link className="eggs-text-link" href="/para/poker/articles">Articles</Link>
          </div>
        </article>
      </section>
    </main>
  );
}
