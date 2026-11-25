import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-newsroom/AdminShell";
import { loadNewsroomEditorialDocs } from "@/lib/newsroom/editorialDocs";

import AssignmentDesk from "@/components/newsroom/AssignmentDesk";
import { sessionCandidates } from "@/lib/league/sessionCandidates";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminNewsroomPage({ searchParams }) {
  const query=await searchParams;
  if (query?.division==="suitfire" || query?.match) redirect("/admin/suitfire"+(query.match?"?match="+encodeURIComponent(query.match):""));
  if(query?.division!=="poker") return <AdminShell division="League" title="Choose an operator desk" eyebrow="Para League" description="Choose the competition you’re working on. Each desk has its own records and editorial workflow.">
    <div className="grid gap-5 md:grid-cols-2">
      <Link href="/admin/suitfire" className="rounded border-l-8 border-orange-500 bg-[#36201d] p-8 text-white"><h2 className="text-4xl font-black">SuitFire</h2><p className="my-4">Review saved duels, verify Vanguard results, and edit Reath match reports.</p><strong>Open SuitFire operations →</strong></Link>
      <Link href="/admin/newsroom?division=poker" className="rounded border-l-8 border-emerald-400 bg-[#112c29] p-8 text-white"><h2 className="font-serif text-4xl font-bold">Poker</h2><p className="my-4">Review table sessions, inspect hand histories, and publish session recaps.</p><strong>Open Poker newsroom →</strong></Link>
    </div></AdminShell>;
  const poker=true, division="Poker";
  const [docs,result] = await Promise.all([loadNewsroomEditorialDocs(), sessionCandidates().then(rows=>({rows})).catch(error=>{console.error("Candidate sessions",error.message);return {error:true,rows:[]};})]);

  return (
    <AdminShell
      title={division+" operator desk"}
      description={poker ? "Review table sessions, inspect hands and finishes, and edit a Poker recap for publication." : "Find a duel, compare earlier meetings, and draft a Reath match report. Approved results feed the season record."}
    >
      <AssignmentDesk key={division} division={division} operator sessions={result.rows}/>
      {result.error && <p role="alert">League session lookup is unavailable. Saved match files can still be opened above.</p>}
      <nav className="flex gap-4 underline"><Link href={"/admin/imports?division="+division.toLowerCase()}>Import official evidence</Link><Link href="/admin/drafts">Draft queue</Link><Link href="/admin/prompt-studio">Prompt Studio</Link></nav>
      <details className="mt-8"><summary className="cursor-pointer font-bold">Editorial source library</summary><section className="mt-8 grid gap-4 md:grid-cols-2">
        {docs.manifest.map((doc) => (
          <article key={doc.id} className="rounded-lg border border-zinc-300 bg-white p-5">
            <h2 className="text-xl font-black">{doc.title}</h2>
            <p className="mt-2 text-sm text-zinc-600">{doc.purpose}</p>
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-zinc-500">
              {doc.included ? `${doc.charCount} chars loaded` : `Missing: ${doc.error}`}
            </p>
          </article>
        ))}
      </section></details>
    </AdminShell>
  );
}
