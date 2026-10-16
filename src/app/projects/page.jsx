import Link from "next/link";
import { publicCatalog } from "@/lib/hub/server";
import { categories } from "@/lib/hub/catalog.mjs";
import { ProjectCard } from "@/components/hub/ProjectPresentation";
export const dynamic="force-dynamic";
export const metadata={title:"Discover projects"};
export default async function ProjectsPage({searchParams}) {
 const query=await searchParams; const category=Object.hasOwn(categories,query.category)?query.category:"all";
 const {projects,unavailable}=await publicCatalog();
 const visible=projects.filter(p=>category==="all"||p.content.category===category);
 return <main className="eggs-page hub-directory"><header className="hub-page-heading"><p className="eggs-eyebrow">The EGGS collection</p><h1>Follow your curiosity.</h1><p className="hub-lede">Games to get into. Competitions to follow. Ideas to spend time with.</p></header>
 <nav className="hub-filters" aria-label="Project categories">{[["all","All projects"],...Object.entries(categories)].map(([key,label])=><Link key={key} href={key==="all"?"/projects":"/projects?category="+key} aria-current={key===category?"page":undefined}>{label}</Link>)}</nav>
 {unavailable?<p role="status" className="hub-empty">The project directory is temporarily unavailable. Please try again later.</p>:visible.length?<div className="hub-card-grid">{visible.map(p=><ProjectCard key={p.id} project={p}/>)}</div>:<p className="hub-empty">Nothing published in this collection yet. Explore another category.</p>}
 <footer className="eggs-footer">EGGS <span>Independent projects. A shared home.</span></footer></main>;
}
