import {storyTypes} from "@/lib/suitfire/storyTypes.mjs";
import { supabase } from "@/lib/supabase";

export default async function SuitFirePublishedReports() {
  const {data,error}=await supabase.from("suitfire_editorial_reports").select("match_id,published_headline,published_prose,published_at,story_type").not("published_at","is",null).order("published_at",{ascending:false}).limit(30);
  return <section className="my-8"><h2 className="mb-3 text-2xl font-bold">Published by Reath</h2>
    {error ? <p>Stories are temporarily unavailable.</p> : !data.length ? <p>The first reviewed story will appear here after an editor publishes it.</p> :
    data.map(r=><details key={r.match_id} className="border-t border-amber-100/25 py-3">
      <summary className="cursor-pointer text-xl font-bold">{r.published_headline}</summary>
      <p className="my-2 text-sm text-stone-400">Reath SuitFire desk · {r.published_at.slice(0,10)} · {storyTypes[r.story_type] || "Match report"}</p>
      <div className="max-w-3xl space-y-4">{r.published_prose.split(/\n+/).filter(Boolean).map((line,i)=><p key={i}>{line}</p>)}</div>
    </details>)}</section>;
}
