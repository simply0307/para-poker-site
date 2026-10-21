"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { categories,statuses } from "@/lib/hub/catalog.mjs";
import { accountFetch } from "@/components/eggs/accountFetch";
const blank={title:"",summary:"",description:"",category:"game",status:"concept",destination:"",participation:"",publication_label:"",publication_url:"",asset:"monogram",featured:false,sort_order:10};
export function ProjectEditor({project}) {
 const [content,setContent]=useState(project?.content||blank);const [slug,setSlug]=useState(project?.slug||"");const [dirty,setDirty]=useState(false);const [error,setError]=useState("");const [busy,setBusy]=useState(false);const router=useRouter();
 const update=(k,v)=>{setContent(c=>({...c,[k]:v}));setDirty(true);};
 async function save(e){e.preventDefault();setBusy(true);setError("");try{const {project:saved}=await accountFetch("/api/eggs/hub/projects",{method:"POST",body:{id:project?.id||null,slug,content,version:project?.version||0,action:"save"}});setDirty(false);router.replace("/eggs-admin/projects/"+saved.id);router.refresh();}catch(err){setError(err.message);}finally{setBusy(false);}}
 return <><form className="eggs-form hub-editor-form" onSubmit={save}><div className="hub-field-row"><label>Project name<input required maxLength={80} value={content.title} onChange={e=>update("title",e.target.value)}/></label><label>Stable slug<input required minLength={3} maxLength={64} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} readOnly={Boolean(project)} onChange={e=>{setSlug(e.target.value);setDirty(true);}}/><span className="eggs-help">Permanent after creation; used in the showcase URL.</span></label></div>
 <label>Short introduction<textarea required maxLength={240} rows={2} value={content.summary} onChange={e=>update("summary",e.target.value)}/></label>
 <label>Project description<textarea required maxLength={3000} rows={6} value={content.description} onChange={e=>update("description",e.target.value)}/></label>
 <div className="hub-field-row"><label>Category<select value={content.category} onChange={e=>update("category",e.target.value)}>{Object.entries(categories).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
 <label>Project status<select value={content.status} onChange={e=>update("status",e.target.value)}>{Object.entries(statuses).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label></div>
 <label>Official destination<input maxLength={500} placeholder="https://…" value={content.destination} onChange={e=>update("destination",e.target.value)}/><span className="eggs-help">HTTPS or a project/league path. No credentials, query strings or sign-in tokens.</span></label>
 <label>How to participate<textarea maxLength={500} rows={3} value={content.participation} onChange={e=>update("participation",e.target.value)}/></label>
 <div className="hub-field-row"><label>Publication link label<input maxLength={80} value={content.publication_label} onChange={e=>update("publication_label",e.target.value)}/></label><label>Publication URL<input maxLength={500} value={content.publication_url} onChange={e=>update("publication_url",e.target.value)}/></label></div>
 <div className="hub-field-row"><label>Approved visual<select value={content.asset} onChange={e=>update("asset",e.target.value)}><option value="monogram">Project initials</option><option value="para">Existing Para wordmark (league only)</option></select></label><label>Directory order<input type="number" min="0" max="9999" required value={content.sort_order} onChange={e=>update("sort_order",Number(e.target.value))}/></label></div>
 <label className="hub-inline-check"><input type="checkbox" checked={content.featured} onChange={e=>update("featured",e.target.checked)}/>Feature on the EGGS homepage</label>
 {error?<p role="alert" className="eggs-error">{error}</p>:null}<button className="eggs-button" disabled={busy}>{busy?"Saving…":"Save draft"}</button>
 </form>{project?<div className="hub-preview-action">{dirty?<p role="status">Save your changes to preview this revision.</p>:<><p>Saved revision {project.version}. Published content changes only after a publisher approves this preview.</p><Link className="eggs-button" href={"/eggs-admin/projects/"+project.id+"/preview"}>Preview saved draft ↗</Link></>}</div>:null}</>;
}
export function PublicationAction({project,action="publish"}) {
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [done,setDone]=useState(false);const router=useRouter();
 async function submit(){setBusy(true);setError("");try{await accountFetch("/api/eggs/hub/projects",{method:"POST",body:{id:project.id,slug:project.slug,version:project.version,action}});setDone(true);router.refresh();}catch(err){setError(err.message);}finally{setBusy(false);}}
 return <div>{done?<p role="status">{action==="publish"?"This revision is published.":"This project is archived."}</p>:<button className="eggs-button" onClick={submit} disabled={busy}>{busy?"Updating…":action==="publish"?"Publish this revision":"Archive project"}</button>}{error?<p role="alert" className="eggs-error">{error}</p>:null}</div>;
}
