import Link from "next/link";
import Image from "next/image";
import { categories,statuses } from "@/lib/hub/catalog.mjs";
export function ProjectVisual({project,large=false}) {
 const c=project.content;
 return <div className={"hub-visual hub-visual-"+c.category+(large?" hub-visual-large":"")} aria-hidden="true">
  {c.asset==="para"?<Image src="/images/para-wordmark.svg" alt="" width={320} height={110} />:<><span className="hub-visual-mark">{c.title.split(" ").filter(Boolean).slice(0,2).map(s=>s[0]).join("")}</span><span className="hub-visual-line" /></>}
  <span className="hub-visual-caption">{categories[c.category]}</span>
 </div>;
}
export function ProjectCard({project}) {
 const c=project.content;
 return <article className="hub-project-card"><Link href={"/projects/"+project.slug} className="hub-card-art" aria-label={"Explore "+c.title}><ProjectVisual project={project}/></Link>
  <div className="hub-card-copy"><span className="hub-chip">{statuses[c.status]}</span><h3><Link href={"/projects/"+project.slug}>{c.title}</Link></h3><p>{c.summary}</p>
  <Link className="eggs-text-link" href={"/projects/"+project.slug}>Explore project <span aria-hidden="true">↗</span></Link></div></article>;
}
export function ProjectShowcase({project,preview=false}) {
 const c=project.content;
 return <><div className="hub-showcase-heading"><p className="eggs-eyebrow">{categories[c.category]} / EGGS</p><span className="hub-chip">{statuses[c.status]}</span><h1>{c.title}</h1><p className="hub-lede">{c.summary}</p></div>
  <div className="hub-showcase-body"><ProjectVisual project={project} large/><div><h2>About the project</h2><p className="hub-description">{c.description}</p>
   {c.destination?<a className="eggs-button" href={c.destination} rel="noopener noreferrer">{c.destination.startsWith("/")?"Explore the league":"Visit project"} <span aria-hidden="true">↗</span></a>:<p className="eggs-help">No public destination has been announced.</p>}
   {c.destination.startsWith("https:")?<p className="eggs-help">Opens the project’s own site. Its sign-in and availability are managed there.</p>:null}
  </div></div>
  <div className="hub-showcase-notes"><section><p className="eggs-eyebrow">Take part</p><h2>Find your way in.</h2><p>{c.participation||"Participation details have not been announced."}</p>{!preview?<Link className="eggs-text-link" href="/profile">Make it one of your favorites ↗</Link>:null}</section>
   <section><p className="eggs-eyebrow">From the project</p><h2>Reading &amp; records</h2>{c.publication_url?<a className="eggs-text-link" href={c.publication_url} rel="noopener noreferrer">{c.publication_label} ↗</a>:<p>No public reading link is listed yet.</p>}</section></div></>;
}
