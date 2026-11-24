import Link from "next/link";
import { getPublishedArticlesIndex, getSessionsIndex } from "@/lib/newsroom/data";
import { approvedMatches } from "@/lib/suitfire/league";

export default async function LeagueDispatches() {
  const [articles,poker,duels] = await Promise.allSettled([getPublishedArticlesIndex(),getSessionsIndex(),approvedMatches()]);
  const lists=[["Reath dispatches","/articles",articles,a=>[a.title,"/articles/"+encodeURIComponent(a.slug||a.id)]],
    ["Poker sessions","/sessions",poker,s=>[s.session_code,"/sessions/"+encodeURIComponent(s.session_code||s.id)]],
    ["SuitFire results","/suitfire#records",duels,m=>[m.players.map(p=>p.name).join(" vs. "),"/suitfire/match?sessionId="+encodeURIComponent(m.sessionId)]]];
  return <section aria-label="League bulletins" className="my-8 grid gap-5 md:grid-cols-3">{lists.map(([title,href,result,item])=>{
    const entries=result.status==="fulfilled" ? result.value.filter(row=>title!=="Poker sessions" || (!/suitfire|gauntlet/i.test(row.format||"") && !/\b(?:PROOF|TEST|FIXTURE)\b/i.test(row.session_code||""))).slice(0,4) : null;
    return <section key={title} className="border-t border-amber-200/40 pt-4"><h2 className="mb-3 text-xl font-bold"><Link href={href}>{title}</Link></h2>
      {entries?.length ? <ul className="space-y-2">{entries.map(row=>{const [label,url]=item(row);return <li key={url}><Link href={url} className="underline">{label}</Link></li>;})}</ul> :
      <p className="text-stone-400">{entries ? (title==="SuitFire results" ? "Awaiting the first approved duel." : "No entries yet.") : "Archive temporarily unavailable."}</p>}
    </section>;})}</section>;
}
