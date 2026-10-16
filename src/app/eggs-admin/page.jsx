import Link from "next/link";
import { workspace } from "@/lib/hub/workspace";
export default async function HubAdminPage() {
 const access=await workspace(); if(access.error)return <p className="hub-empty" role="alert">{access.error}</p>;
 let projects;try{projects=await access.repository.drafts();}catch{return <p role="alert" className="hub-empty">Projects could not be loaded. Please try again.</p>;}
 return <><div className="hub-page-heading"><p className="eggs-eyebrow">EGGS publishing / {access.role}</p><h1>A place for your projects.</h1><p className="hub-lede">Shape the directory. Save a draft, preview it, then publish with a publisher’s role.</p><Link className="eggs-button" href="/eggs-admin/projects/new">Create a project +</Link></div>
 <p className="eggs-help">This workspace manages EGGS project showcases. Para Poker’s newsroom and league records have their own operators and controls.</p>
 <div className="hub-admin-list">{projects.length?projects.map(p=><article key={p.id}><div><span className="hub-chip">{p.state}</span><h2><Link href={"/eggs-admin/projects/"+p.id}>{p.content.title}</Link></h2><p className="eggs-help">/{p.slug} · Saved revision {p.version}</p></div><Link className="eggs-text-link" href={"/eggs-admin/projects/"+p.id}>Edit &amp; preview ↗</Link></article>):<p className="hub-empty">No projects yet. Create your first draft.</p>}</div><p className="eggs-help">Showing the 100 most recently updated entries.</p></>;
}
