import { supabase } from "@/lib/supabase";
import { AdminShell } from "@/components/admin-newsroom/AdminShell";
import { loadNewsroomEditorialDocs } from "@/lib/newsroom/editorialDocs";

import AssignmentDesk from "@/components/newsroom/AssignmentDesk";
import { sessionCandidates } from "@/lib/league/sessionCandidates";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminNewsroomPage({ searchParams }) {
  const poker=(await searchParams)?.division==="poker";
  const division=poker?"Poker":"SuitFire";
  const [docs,result] = await Promise.all([loadNewsroomEditorialDocs(), sessionCandidates().then(rows=>({rows})).catch(error=>{console.error("Candidate sessions",error.message);return {error:true,rows:[]};})]);

  const reports = poker ? { data: [] } : await supabase.from("suitfire_editorial_reports")
    .select("match_id,headline,published_at,updated_at").order("updated_at",{ascending:false}).limit(60);

  return (
    <AdminShell
      title={division+" operator desk"}
      description={poker ? "Review table sessions, inspect hands and finishes, and edit a Poker recap for publication." : "Find a duel, compare earlier meetings, and draft a Reath match report. Approved results feed the season record."}
    >
      <AssignmentDesk key={division} division={division} operator sessions={result.rows} reports={reports.data || []}/>
      {reports.error && <p role="alert">The shared SuitFire draft queue could not be loaded.</p>}
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
