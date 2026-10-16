import Link from "next/link";
import { notFound } from "next/navigation";
import { publicCatalog } from "@/lib/hub/server";
import { ProjectShowcase } from "@/components/hub/ProjectPresentation";
export const dynamic="force-dynamic";
export async function generateMetadata({params}) {
 const {slug}=await params; const {projects}=await publicCatalog(); const project=projects.find(p=>p.slug===slug);
 return {title:project?.content.title||"Project",description:project?.content.summary};
}
export default async function ShowcasePage({params}) {
 const {slug}=await params; const {projects,unavailable}=await publicCatalog();
 if(unavailable) return <main className="eggs-page hub-directory"><p className="hub-empty" role="status">This project is temporarily unavailable.</p></main>;
 const project=projects.find(p=>p.slug===slug); if(!project) notFound();
 return <main className="eggs-page hub-showcase"><Link className="eggs-text-link" href="/projects">← All projects</Link><ProjectShowcase project={project}/></main>;
}
