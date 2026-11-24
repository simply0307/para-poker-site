import LeagueDispatches from "@/components/newsroom/LeagueDispatches";
import { Suspense } from "react";
export const revalidate=60;
import Link from "next/link";
import AssignmentDesk from "@/components/newsroom/AssignmentDesk";
import { LeagueHero,NewsroomShell } from "@/components/newsroom/NewsroomShell";

export default function Newsroom() {
  return <NewsroomShell><LeagueHero eyebrow="Para League" title="Reath newsroom" dek="Coverage from the poker table and the SuitFire battlefield."/>
    <nav className="my-5 flex flex-wrap gap-6 underline"><Link href="/articles">Published articles</Link><Link href="/suitfire#records">SuitFire reports</Link><Link href="/sessions">Poker recaps</Link><Link href="/admin/newsroom">Operator newsroom</Link></nav>
    <AssignmentDesk/><Suspense fallback={<p>Loading coverage…</p>}><LeagueDispatches/></Suspense></NewsroomShell>;
}
