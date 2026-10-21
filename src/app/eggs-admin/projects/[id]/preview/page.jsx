import Link from "next/link";
import { notFound } from "next/navigation";
import { workspace } from "@/lib/hub/workspace";
import { PublicationAction } from "@/components/hub/ProjectEditor";
import { ProjectShowcase } from "@/components/hub/ProjectPresentation";
export default async function PreviewProject({params}){
 const access=await workspace();if(access.error)return <p role="alert">{access.error}</p>;
 const {id}=await params;if(!/^[a-f0-9-]{36}$/iu.test(id))notFound();
 let project;try{project=await access.repository.draft(id);}catch{return <p role="alert">Preview is temporarily unavailable.</p>;}if(!project)notFound();
 return <><aside className="hub-preview-banner"><div><strong>Private preview · revision {project.version}</strong><p>Review the text, links and visual below before publishing.</p><Link href={"/eggs-admin/projects/"+id}>← Continue editing</Link></div>{access.role==="publisher"?<PublicationAction key={project.version} project={project}/>:<p>A publisher must approve this revision.</p>}</aside><ProjectShowcase project={project} preview/><Link className="eggs-text-link" href={"/projects/"+project.slug}>View published showcase ↗</Link></>;
}
