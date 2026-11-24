import { Suspense } from "react";
import LeagueDispatches from "@/components/newsroom/LeagueDispatches";
export const revalidate=60;
import Link from "next/link";
import { NewsroomShell, LeagueHero } from "@/components/newsroom/NewsroomShell";

const divisions = [
  { name: "SuitFire", href: "/suitfire", description: "Enter official events, follow Vanguard records, and revisit the matches behind each season.", links: [["Event hub", "https://gauntlet-online.vercel.app/?page=compete&view=para"], ["Season records", "/suitfire#records"]] },
  { name: "Poker", href: "/poker", description: "Follow the season from the first hand through the final table, with player dossiers and reports from the rail.", links: [["Session archive", "/sessions"], ["Standings", "/standings"], ["Player dossiers", "/players"]] },
];

export default function LeagueHome() {
  return <NewsroomShell>
    <LeagueHero eyebrow="Competitive play" title="Para League" dek="Two games share a league and a newsroom. Follow a season, track a player, or read the story behind a result." />
    <section aria-label="League divisions" className="my-6 grid gap-5 md:grid-cols-2">{divisions.map(division =>
      <article key={division.href} className="rounded border border-amber-200/25 bg-slate-900/70 p-6">
        <h2 className="text-3xl font-black"><Link href={division.href}>{division.name}</Link></h2>
        <p className="my-4 text-stone-300">{division.description}</p>
        <nav aria-label={division.name} className="flex flex-wrap gap-4 text-amber-200">{division.links.map(([label,href]) => <Link key={href} href={href} className="underline">{label}</Link>)}</nav>
      </article>)}</section>
    <h2 className="text-2xl font-bold"><Link href="/newsroom">Reath newsroom →</Link></h2>
    <p className="mt-2 text-stone-300">Read published coverage or bring a saved game to the assignment desk.</p>
    <Suspense fallback={<p>Loading league bulletins…</p>}><LeagueDispatches/></Suspense>
  </NewsroomShell>;
}
