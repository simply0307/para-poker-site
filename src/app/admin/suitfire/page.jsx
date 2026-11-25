import Link from "next/link";
import { AdminShell } from "@/components/admin-newsroom/AdminShell";
import AssignmentDesk from "@/components/newsroom/AssignmentDesk";
import { sessionCandidates } from "@/lib/league/sessionCandidates";
import { approvedMatches } from "@/lib/suitfire/league";
import { seasonRecords } from "@/lib/suitfire/records.mjs";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function Ledger() {
  let matches;
  try { matches = await approvedMatches(); }
  catch { return <p role="alert">Season records could not be loaded.</p>; }
  if (!matches.length) return <p>No approved duels yet. <Link className="underline" href="/admin/imports?division=suitfire">Review a result</Link> to start the ledger.</p>;
  return [...new Set(matches.map(match=>match.season))].map(season=>{
    const games=matches.filter(match=>match.season===season);
    return <section className="mb-6 rounded border bg-white p-5" key={season}><h2 className="mb-4 text-2xl font-bold">Season {season}</h2>
      <table className="w-full text-left"><caption className="pb-2 text-left">Vanguard standings from {games.length} approved duels</caption><thead><tr>{["Vanguard","Wins","Losses","Draws"].map(label=><th key={label}>{label}</th>)}</tr></thead>
      <tbody>{seasonRecords(games).map(row=><tr className="border-t" key={row.id}><th className="py-2">{row.name}</th><td>{row.win}</td><td>{row.loss}</td><td>{row.draw}</td></tr>)}</tbody></table>
      <details className="mt-4"><summary>Inspect duel records</summary>{games.map(game=><Link className="block py-2 underline" key={game.sessionId} href={"/suitfire/match?sessionId="+encodeURIComponent(game.sessionId)}>{game.players.map(player=>player.name).join(" vs. ")}</Link>)}</details></section>;
  });
}

export default async function SuitFireOperations({searchParams}) {
  const requested=(await searchParams)?.view;
  const view=["reports","records"].includes(requested)?requested:"duels";
  const titles={duels:"Duel intake",reports:"Reath report queue",records:"Season ledger"};
  const descriptions={duels:"Open a saved match, check its finish and duration, then build an assignment from the duel evidence.",reports:"Reopen a working draft, review the match story, and control what appears on the public SuitFire desk.",records:"Inspect approved duels and the win, loss, and draw records they contribute to each season."};
  let sessions=[], reports=[], error;
  if(view==="duels") {
    try { sessions=(await sessionCandidates()).filter(row=>row.game==="SuitFire"); }
    catch { error="League sessions could not be loaded. Saved match files can still be opened."; }
  }
  if(view==="reports") {
    const result=await supabase.from("suitfire_editorial_reports").select("match_id,headline,published_at,updated_at").order("updated_at",{ascending:false}).limit(60);
    if(result.error) error="The report queue could not be loaded.";
    else reports=result.data;
  }
  return <AdminShell division="SuitFire" view={view} title={titles[view]} description={descriptions[view]}>
    {error && <p role="alert">{error}</p>}
    {view==="records"?<Ledger/>:(!error || view==="duels") && <AssignmentDesk key={view} operator division="SuitFire" sessions={sessions} reports={reports} queueOnly={view==="reports"}/>}
  </AdminShell>;
}
