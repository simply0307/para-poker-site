import LeagueDispatches from "@/components/newsroom/LeagueDispatches";
import { Suspense } from "react";
export const revalidate=60;
import Link from "next/link";
import AssignmentDesk from "@/components/newsroom/AssignmentDesk";
import { LeagueHero,NewsroomShell } from "@/components/newsroom/NewsroomShell";

export default async function Newsroom({searchParams}) {
  const poker=(await searchParams)?.division==="poker";
  return <NewsroomShell><LeagueHero eyebrow="Para League" title={poker?"Reath Poker desk":"Reath SuitFire desk"} dek={poker?"Read reports from the rail, follow standings, and revisit the hands that decided a session.":"Read official duel reports, follow Vanguard season records, and bring a saved match to the assignment desk."}/>
    <nav aria-label="Coverage desks" className="my-5 flex flex-wrap gap-6 underline"><Link aria-current={!poker?"page":undefined} href="/newsroom?division=suitfire">SuitFire coverage</Link><Link aria-current={poker?"page":undefined} href="/newsroom?division=poker">Poker coverage</Link><Link href={"/admin/newsroom?division="+(poker?"poker":"suitfire")}>Open operator desk</Link></nav>
    {poker ? <><nav className="my-6 flex flex-wrap gap-5 underline"><Link href="/sessions">Session recaps</Link><Link href="/moments">Notable hands</Link><Link href="/players">Player dossiers</Link><Link href="/standings">Season standings</Link></nav><Suspense fallback={<p>Loading Poker coverage…</p>}><LeagueDispatches division="Poker"/></Suspense></> : <><Link className="underline" href="/suitfire#records">Official SuitFire standings and reports</Link><AssignmentDesk division="SuitFire"/></>}</NewsroomShell>;
}
