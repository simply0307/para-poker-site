import Link from "next/link";

export function PokerIdentitySummary({ player }) {
  if (!player) return null;
  return <section className="eggs-project eggs-poker-summary" aria-label="Para Poker League summary">
    <p className="eggs-eyebrow">Para Poker League</p><h2>{player.display_name}</h2>
    {player.season_code ? <><p>Latest recorded standings · {player.season_code}</p><dl className="eggs-summary-stats">
      {[["Rank", player.rank], ["Points", player.points], ["Sessions", player.sessions_played]].map(([name, value]) => value === null || value === undefined ? null : <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}
    </dl></> : <p>League results will appear as they are recorded.</p>}
    <Link href={`/para/poker/players/${player.player_id}`} className="eggs-text-link">View full league dossier <span aria-hidden="true">↗</span></Link>
  </section>;
}
