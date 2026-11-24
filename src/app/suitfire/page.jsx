import Link from "next/link";
import { LeagueHero, NewsroomShell } from "@/components/newsroom/NewsroomShell";
import { approvedMatches } from "@/lib/suitfire/league";
import { seasonRecords } from "@/lib/suitfire/records.mjs";

export const dynamic = "force-dynamic";

export default async function SuitFireLeague() {
  const matches = await approvedMatches();
  const seasons = [...new Set(matches.map(match => match.season))];
  return <NewsroomShell eyebrow="Competitive SuitFire">
    <LeagueHero eyebrow="Para League" title="SuitFire Para League" dek="Official play, Vanguard records, and match coverage from the Reath desk." />
    <a className="inline-block rounded border border-amber-300 px-4 py-2" href="https://gauntlet-online.vercel.app/?page=compete&view=para">Enter the event hub in SuitFire →</a>
    <p className="mt-3 text-stone-300">Check the schedule, enter free, and track your Prestige in the event hub.</p>
    {!seasons.length && <p className="my-8">The first season record will appear here when a match result is approved.</p>}
    {seasons.map(season => {
      const games = matches.filter(match => match.season === season);
      return <section key={season} className="my-10 space-y-5">
        <h2 className="text-3xl font-bold">Season {season}</h2>
        <table className="w-full text-left"><caption className="pb-2 text-left font-semibold">Vanguard match records</caption>
          <thead><tr>{["Vanguard", "Wins", "Losses", "Draws"].map(label => <th key={label}>{label}</th>)}</tr></thead>
          <tbody>{seasonRecords(games).map(row => <tr key={row.id}><th scope="row"><details className="py-1 font-normal">
            <summary className="cursor-pointer font-semibold">{row.name}</summary>
            <ul className="py-2">{games.filter(game => game.players.some(player => player.id === row.id)).map(game => {
              const vanguard = game.players.find(player => player.id === row.id);
              const opponent = game.players.find(player => player.seat !== vanguard.seat);
              return <li key={game.sessionId}><Link className="underline" href={`/suitfire/match?sessionId=${game.sessionId}`}>{vanguard.result} vs. {opponent.name}</Link>{vanguard.faction && ` · ${vanguard.faction}`}</li>;
            })}</ul>
          </details></th><td>{row.win}</td><td>{row.loss}</td><td>{row.draw}</td></tr>)}</tbody>
        </table>
        <h3 className="text-xl font-bold">Results and Reath coverage</h3>
        <ul className="divide-y divide-stone-700">{games.map(match => <li className="py-3" key={match.sessionId}>
          <Link className="underline" href={`/suitfire/match?sessionId=${match.sessionId}`}>{match.players.map(player => player.name).join(" vs. ")}</Link>
          <p>{new Date(match.playedAt).toISOString().slice(0, 10)} · {match.players.find(player => player.result === "win")?.name ? `${match.players.find(player => player.result === "win").name} won` : "Draw"} · Final life {match.players.map(player => player.finalLife).join("–")}</p>
        </li>)}</ul>
      </section>;
    })}
  </NewsroomShell>;
}
