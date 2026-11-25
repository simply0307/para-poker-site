import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import SuitFireFrame from "./SuitFireFrame";
import { approvedMatches } from "@/lib/suitfire/league";
import { seasonRecords } from "@/lib/suitfire/records.mjs";
import { divisions, eventHub, groupsByFaction, repeatedPairings, sectionUrl } from "@/lib/suitfire/division.mjs";
import SuitFirePublishedReports from "@/components/newsroom/SuitFirePublishedReports";
import AssignmentDesk from "@/components/newsroom/AssignmentDesk";

export const dynamic="force-dynamic";
const descriptions={
  events:"Find the next competition, check entry details, and follow your Prestige in the SuitFire event hub.",
  seasons:"Trace each season from its standings back to the approved duels that earned them.",
  vanguards:"Follow a competitor’s results, faction choices, and opponents across official play.",
  factions:"Compare faction appearances and results, then inspect the duels behind each record.",
  rivalries:"Follow returning opponents across multiple meetings, including changes in faction and the latest result.",
  reath:"Read published match stories, explore the season’s longer-running storylines, or bring a saved duel to the newsroom."
};

export async function generateMetadata({searchParams}) {
  const {section}=await searchParams;
  const label=divisions.find(d=>d.id===section)?.label;
  return {title:label?"SuitFire · "+label:"SuitFire Competitive League",description:descriptions[section] || "Competitive SuitFire on Para League."};
}
function DuelList({games}) {
  return <ul>{games.map(g=><li className="sf-entry" key={g.sessionId}><Link href={"/suitfire/match?sessionId="+encodeURIComponent(g.sessionId)}>{g.players.map(p=>p.name).join(" vs. ")}</Link><p>{[g.playedAt?.slice(0,10),g.season,g.players.map(p=>p.faction).filter(Boolean).join(" / ")].filter(Boolean).join(" · ")}</p></li>)}</ul>;
}
function RecordTable({games,season}) {
  const players=seasonRecords(games);
  return players.length>0 && <table className="sf-records"><caption className="text-left">Vanguard standings</caption><thead><tr>{["Vanguard","Wins","Losses","Draws"].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{players.map(p=><tr key={p.id}><td><Link className="underline" href={sectionUrl("vanguards",{player:p.id,...(season?{season}:{})})}>{p.name}</Link></td><td>{p.win}</td><td>{p.loss}</td><td>{p.draw}</td></tr>)}</tbody></table>;
}
function Card({section,title,children}) {
  return <Link className="sf-panel" href={sectionUrl(section)}><h2>{title} ↗</h2><p>{children}</p></Link>;
}
const initiative = [
  ["Rumin","The naga empire brings finance and imperial power to the field."],
  ["Sheen","The treant empire draws its identity from cultivation and healing."],
  ["Bizi","Rail networks and automata underpin the Bizi industrial order."],
  ["Frumo","Frozen waters are home to Frumo’s merfolk fleets and pirate crews."]
];
function InitiativeFieldGuide() {
  return <section aria-label="Initiative field guide"><h2 className="sf-sub mt-6">Initiative field guide</h2><div className="sf-grid">{initiative.map(([name,description])=><article className="sf-panel" key={name}><h3 className="text-xl font-bold">{name}</h3><p>{description}</p></article>)}</div></section>;
}
async function Archive({section,season,player}) {
  let matches;
  try { matches=await approvedMatches(); } catch { return <p className="sf-summary" role="status">Official records are temporarily unavailable.</p>; }
  const seasons=[...new Set(matches.map(g=>g.season).filter(Boolean))];
  const games=season?matches.filter(g=>g.season===season):matches;
  const players=seasonRecords(games);
  return <><nav className="sf-seasons" aria-label="Filter by season">{["",...seasons].map(s=><Link key={s} aria-current={s===(season||"")?"page":undefined} href={sectionUrl(section,{...(s?{season:s}:{}),...(player?{player}:{})})}>{s?"Season "+s:"All seasons"}</Link>)}</nav>
  {!games.length?<div className="sf-panel"><h2>{season?"No approved duels in this season":"The official archive is awaiting its first approved duel"}</h2><p>Reviewed results populate standings, Vanguard dossiers, faction records, and rivalry histories. Reath can cover saved games before a result enters the archive.</p><div className="sf-actions"><Link href={sectionUrl("events")}>Find an event</Link><Link href={sectionUrl("reath")}>Read Reath</Link></div></div>:
  section==="seasons"?<>{[...new Set(games.map(g=>g.season))].map(s=>{const rows=games.filter(g=>g.season===s);return <section className="sf-panel mb-4" key={s}><h2>{s?"Season "+s:"Unassigned season"}</h2><RecordTable games={rows} season={s}/><details><summary>{rows.length} approved duel{rows.length===1?"":"s"}</summary><DuelList games={rows}/></details></section>})}</>:
  section==="vanguards"?<>{player && <Link className="underline" href={sectionUrl(section,season?{season}:{})}>All Vanguards</Link>}{player && !players.some(p=>p.id===player) && <p>No Vanguard record in this selection.</p>}{players.filter(p=>!player || p.id===player).map(p=>{const history=games.filter(g=>g.players.some(v=>v.id===p.id));return <details key={p.id} open={player===p.id || undefined} className="sf-entry"><summary>{p.name} · {p.win} wins / {p.loss} losses / {p.draw} draws</summary><p className="sf-summary">Factions played · {[...new Set(history.flatMap(g=>g.players.filter(v=>v.id===p.id).map(v=>v.faction)).filter(Boolean))].join(", ") || "Unrecorded"}</p><DuelList games={history}/></details>})}{!players.length && <p>These duels have no mapped Vanguard identities yet.</p>}</>:
  section==="factions"?<>{groupsByFaction(games).map(f=><details className="sf-entry" key={f.name}><summary>{f.name} · {f.appearances} appearances</summary><p>{f.win} wins / {f.loss} losses / {f.draw} draws</p><DuelList games={[...f.games]}/></details>)}{!groupsByFaction(games).length && <p>Faction choices haven’t been recorded for these duels.</p>}</>:
  <>{repeatedPairings(games).map(history=><details className="sf-entry" key={history[0].sessionId}><summary>{history[0].players.map(p=>p.name).join(" vs. ")} · {history.length} meetings</summary><DuelList games={history}/></details>)}{!repeatedPairings(games).length && <p>A rivalry history opens once the same two Vanguards have two approved duels in this selection.</p>}</>}</>;
}
export default async function SuitFireLeague({searchParams}) {
  const query=await searchParams, section=query.section || "overview";
  const current=divisions.find(d=>d.id===section);
  if(!current) notFound();
  return <SuitFireFrame section={section}>{section==="overview"?<>
    <section className="sf-hero"><Image className="sf-landscape" src="/images/suitfire-journey.jpg" alt="" fill sizes="100vw" priority/><div><p className="sf-kicker">Para League · SuitFire</p><h1 className="sf-title">Competitive SuitFire</h1><p className="sf-dek">Enter league play, follow the Vanguards, and trace the rivalries that shape each season.</p><div className="sf-actions"><Link href={sectionUrl("events")}>Find an event</Link><Link href={sectionUrl("reath")}>Reath coverage</Link></div></div><Image className="sf-lockup" src="/images/suitfire-full.png" alt="SuitFire" width={340} height={260} priority/></section>
    <section id="records" aria-label="Explore the league" className="sf-grid">{divisions.slice(1).map(d=><Card key={d.id} section={d.id} title={d.label}>{descriptions[d.id]}</Card>)}</section></>:
    <><p className="sf-kicker">SuitFire / Para League</p><h1 className="sf-title">{current.label}</h1><p className="sf-dek">{descriptions[section]}</p>
    {section==="events"?<div className="sf-grid"><article className="sf-panel"><h2>Schedule and registration</h2><p>The game’s event hub carries the current schedule, free entry, and your Prestige record.</p><div className="sf-actions"><a href={eventHub}>Open the SuitFire event hub ↗</a></div></article><Card section="seasons" title="Competition results">Look up the season record after an organizer approves a duel.</Card></div>:
    section==="reath"?<><SuitFirePublishedReports/><nav aria-label="Reath research" className="sf-grid"><Card section="rivalries" title="Rivalry watch">Read the sequence of meetings behind a rematch.</Card><Card section="factions" title="Faction watch">Trace each faction’s record across the field.</Card></nav><AssignmentDesk division="SuitFire"/><Link className="underline" href="/admin/suitfire?view=reports">Open the operator report queue</Link></>:
    <>{section==="factions" && <InitiativeFieldGuide/>}<Archive section={section} season={query.season} player={query.player}/></>}</>}</SuitFireFrame>;
}
