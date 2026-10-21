import { notFound } from "next/navigation";
import { workspace } from "@/lib/hub/workspace";
import { ProjectEditor,PublicationAction } from "@/components/hub/ProjectEditor";
export default async function EditProject({params}){
 const access=await workspace();if(access.error)return <p role="alert">{access.error}</p>;
 const {id}=await params;if(!/^[a-f0-9-]{36}$/iu.test(id))notFound();
 let project,audit;try{project=await access.repository.draft(id);audit=await access.repository.audit(id);}catch{return <p role="alert">The project could not be loaded.</p>;}if(!project)notFound();
 return <><div className="hub-page-heading"><p className="eggs-eyebrow">{project.state} / revision {project.version}</p><h1>{project.content.title}</h1></div><ProjectEditor key={project.version} project={project}/>
 <section className="eggs-account-section"><h2>Publication history</h2><ol className="hub-audit">{audit.map(a=><li key={a.id}><strong>{a.action}</strong> · revision {a.version} · {new Date(a.occurred_at).toISOString()}<span className="eggs-help"> {a.actor_id?"Editor "+a.actor_id:"Initial portal catalog"}</span></li>)}</ol></section>
 {access.role==="publisher"&&project.state!=="archived"?<section className="eggs-account-section"><h2>Archive this project</h2><p>Removes the public showcase and profile references from presentation. Drafts and publication history are preserved.</p><PublicationAction key={project.version} project={project} action="archive"/></section>:null}</>;
}
