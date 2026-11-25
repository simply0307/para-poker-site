import { withOperatorAuthorization } from "@/lib/auth/operatorAuthorization";
import { supabase } from "@/lib/supabase";

import {storyTypes} from "@/lib/suitfire/storyTypes.mjs";

const table="suitfire_editorial_reports";
const fields="match_id,headline,prose,version,published_at,story_type";
const valid=id=>typeof id==="string" && /^[a-zA-Z0-9-]{1,100}$/.test(id);
const reply=(body,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});

export const GET=withOperatorAuthorization(async request=>{
  const id=new URL(request.url).searchParams.get("match");
  if(!valid(id)) return reply({error:"Choose a match."},400);
  const {data,error}=await supabase.from(table).select(fields).eq("match_id",id).maybeSingle();
  return error ? reply({error:"Could not load this report."},503) : reply({report:data});
});

export const POST=withOperatorAuthorization(async request=>{
  const b=await request.json().catch(()=>null);
  if(!valid(b?.match) || !Number.isInteger(b.version) || b.version<0 || !["save","publish","withdraw"].includes(b.action)) return reply({error:"Invalid report or revision."},400);
  const kind=b.storyType ?? "match";
  if(!Object.hasOwn(storyTypes,kind)) return reply({error:"Unknown coverage type."},400);
  const text=typeof b.text==="string"?b.text.trim():"";
  const [title,...body]=text.split("\n");
  const prose=body.join("\n").trim();
  if(!title || title.length>240 || !prose || prose.length>40000) return reply({error:"Use a headline on the first line and a report underneath."},400);
  const now=new Date().toISOString();
  const values={headline:title,prose,updated_at:now,version:b.version+1};
  if(b.action==="publish") Object.assign(values,{published_headline:title,published_prose:prose,published_at:now});
  if(b.action==="withdraw") Object.assign(values,{published_headline:null,published_prose:null,published_at:null});
  const query=b.version===0 ? supabase.from(table).insert({...values,match_id:b.match,story_type:kind}) : supabase.from(table).update(values).eq("match_id",b.match).eq("version",b.version);
  const {data,error}=await query.select(fields).maybeSingle();
  if(error?.code==="23505" || (!error && !data)) return reply({error:"Another editor saved a newer version. Reopen the report before saving."},409);
  return error ? reply({error:"Could not save the report."},503) : reply({report:data});
});
