import Image from "next/image";
import { Suspense } from "react";
import LeagueDispatches from "@/components/newsroom/LeagueDispatches";
export const revalidate=60;
import Link from "next/link";
import { NewsroomShell, LeagueHero } from "@/components/newsroom/NewsroomShell";

const divisions = [
  { name: "SuitFire", href: "/suitfire", description: "Enter official events, follow Vanguard records, and revisit the matches behind each season.", links: [["Event hub", "https://gauntlet-online.vercel.app/?page=compete&view=para"], ["Season records", "/suitfire?section=seasons"]] },
  { name: "Poker", href: "/poker", description: "Follow the season from the first hand through the final table, with player dossiers and reports from the rail.", links: [["Session archive", "/sessions"], ["Standings", "/standings"], ["Player dossiers", "/players"]] },
];

export default function LeagueHome() {
  return <NewsroomShell>
    <LeagueHero eyebrow="Competitive play" title="Para League" dek="Two games share a league and a newsroom. Follow a season, track a player, or read the story behind a result." />
    <section aria-label="League divisions" className="my-6 grid gap-5 md:grid-cols-2">{divisions.map(division =>
      <article key={division.href} className={division.name==="SuitFire"?"border-t-4 border-red-400 bg-[#311d24] p-6":"border-t-4 border-amber-300 bg-[#0c3027] p-6"}>
        <Link href={division.href} aria-label={"Enter "+division.name} className="mb-5 flex h-32 items-center"><Image src={division.name==="SuitFire"?"/images/suitfire-full.png":"/images/para-league-logo.png"} width={170} height={120} className="h-full w-auto object-contain" alt=""/></Link><h2 className="text-3xl font-black"><Link href={division.href}>{division.name}</Link></h2>
        <p className="my-4 text-stone-300">{division.description}</p>
        <nav aria-label={division.name} className="flex flex-wrap gap-4 text-amber-200">{division.links.map(([label,href]) => <Link key={href} href={href} className="underline">{label}</Link>)}</nav>
      </article>)}</section>
    <h2 className="text-2xl font-bold"><Link href="/newsroom">Reath newsroom →</Link></h2>
    <p className="mt-2 text-stone-300">Read published coverage or bring a saved game to the assignment desk.</p>
    <Suspense fallback={<p>Loading league bulletins…</p>}><LeagueDispatches/></Suspense>
  </NewsroomShell>;
}
