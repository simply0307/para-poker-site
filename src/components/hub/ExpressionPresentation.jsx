import Link from "next/link";
import { affiliations } from "@/lib/hub/catalog.mjs";
import { emptyExpression } from "@/lib/hub/core.mjs";
export function ExpressionPresentation({profile,expression=emptyExpression,projects=[],preview=false}) {
 const value=expression||emptyExpression;
 const favorites=value.favorite_project_ids.map(id=>projects.find(p=>p.id===id)).filter(Boolean);
 const pinned=projects.find(p=>p.id===value.pinned_project_id);
 return <section className={"hub-profile hub-accent-"+value.accent} aria-label={preview?"Profile preview":"Player expression"}>
  {preview?<p className="eggs-eyebrow">{profile.visibility==="private"?"Only you can see this preview":"Public profile preview"}</p>:null}
  <div className="hub-profile-heading"><span className="hub-avatar" aria-hidden="true">{(profile.display_name||profile.handle).slice(0,1).toUpperCase()}</span><div><p className="eggs-eyebrow">EGGS / {affiliations[value.affiliation]||"Member"}</p><h2>{profile.display_name||profile.handle}</h2><p>@{profile.handle}</p></div></div>
  {profile.bio?<p className="hub-profile-bio">{profile.bio}</p>:null}
  {favorites.length?<div className="hub-favorites" aria-label="Favorite projects">{favorites.map(p=><Link key={p.id} href={"/projects/"+p.slug}>{p.content.title} <span aria-hidden="true">↗</span></Link>)}</div>:<p className="eggs-help">{preview?"Choose a few projects to make this space yours.":"A little room to grow."}</p>}
  {value.featured_note||pinned?<div className="hub-featured-note"><p className="eggs-eyebrow">In focus</p>{value.featured_note?<p>{value.featured_note}</p>:null}{pinned?<Link className="eggs-text-link" href={"/projects/"+pinned.slug}>{pinned.content.title} ↗</Link>:null}</div>:null}
 </section>;
}
