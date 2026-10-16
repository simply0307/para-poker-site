"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { affiliations,accents } from "@/lib/hub/catalog.mjs";
import { emptyExpression } from "@/lib/hub/core.mjs";
import { accountFetch } from "@/components/eggs/accountFetch";
import { ExpressionPresentation } from "./ExpressionPresentation";
export function ExpressionEditor({profile,expression,projects}) {
 const source=expression||emptyExpression;
 const available=new Set(projects.map(p=>p.id));
 const [value,setValue]=useState({...source,favorite_project_ids:source.favorite_project_ids.filter(id=>available.has(id)),pinned_project_id:available.has(source.pinned_project_id)?source.pinned_project_id:null}); const [error,setError]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const router=useRouter();
 const update=(key,next)=>{setValue(v=>({...v,[key]:next}));setMessage("");};
 function favorite(id,checked){update("favorite_project_ids",checked?[...value.favorite_project_ids,id]:value.favorite_project_ids.filter(x=>x!==id));}
 async function save(e){e.preventDefault();setBusy(true);setError("");setMessage("");try {await accountFetch("/api/eggs/expression",{method:"PUT",body:{favorite_project_ids:value.favorite_project_ids,affiliation:value.affiliation,pinned_project_id:value.pinned_project_id,featured_note:value.featured_note,accent:value.accent}});setMessage("Your expression is saved.");router.refresh();}catch(err){setError(err.message);}finally{setBusy(false);}}
 return <section className="eggs-account-section"><div className="eggs-section-heading"><div><p className="eggs-eyebrow">Make yourself at home</p><h2>Your corner of EGGS.</h2></div></div>
 <div className="hub-expression-layout"><form className="eggs-form eggs-form-card" onSubmit={save}>
  <fieldset><legend>Favorite projects <span className="eggs-help">(up to five)</span></legend><div className="hub-choice-list">{projects.map(p=><label key={p.id}><input type="checkbox" checked={value.favorite_project_ids.includes(p.id)} disabled={!value.favorite_project_ids.includes(p.id)&&value.favorite_project_ids.length>=5} onChange={e=>favorite(p.id,e.target.checked)}/>{p.content.title}</label>)}</div>{!projects.length?<p className="eggs-help">Favorites become available when projects are published.</p>:null}</fieldset>
  <label>Creative affiliation<select value={value.affiliation} onChange={e=>update("affiliation",e.target.value)}>{Object.entries(affiliations).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
  <label>Pin a project<select value={value.pinned_project_id||""} onChange={e=>update("pinned_project_id",e.target.value||null)}><option value="">No pinned project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.content.title}</option>)}</select></label>
  <label>A note for your featured section<textarea value={value.featured_note} onChange={e=>update("featured_note",e.target.value)} maxLength={160} rows={3}/></label>
  <label>Profile color<select value={value.accent} onChange={e=>update("accent",e.target.value)}>{Object.entries(accents).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
  <p className="eggs-help">These choices follow your profile visibility above. Favorites and affiliations are personal choices, not verified achievements or linked game accounts.</p>
  {source.favorite_project_ids.some(id=>!available.has(id))||(source.pinned_project_id&&!available.has(source.pinned_project_id))?<p className="eggs-help">A previously chosen project is no longer published. Saving removes that unavailable choice.</p>:null}
  {error?<p role="alert" className="eggs-error">{error}</p>:null}{message?<p role="status" className="eggs-notice">{message}</p>:null}
  <button className="eggs-button" disabled={busy}>{busy?"Saving…":"Save expression"}</button>
 </form><ExpressionPresentation profile={profile} expression={value} projects={projects} preview/></div></section>;
}
