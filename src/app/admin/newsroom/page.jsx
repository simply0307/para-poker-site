import { AdminShell } from "@/components/admin-newsroom/AdminShell";
import { loadNewsroomEditorialDocs } from "@/lib/newsroom/editorialDocs";

import AssignmentDesk from "@/components/newsroom/AssignmentDesk";
import { sessionCandidates } from "@/lib/league/sessionCandidates";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminNewsroomPage() {
  const [docs,result] = await Promise.all([loadNewsroomEditorialDocs(), sessionCandidates().then(rows=>({rows})).catch(error=>{console.error("Candidate sessions",error.message);return {error:true,rows:[]};})]);

  return (
    <AdminShell
      title="Reath operator newsroom"
      description="Find a game, choose a story angle, and draft coverage for either division."
    >
      <AssignmentDesk operator sessions={result.rows}/>
      {result.error && <p role="alert">League session lookup is unavailable. Saved match files can still be opened above.</p>}
      <nav className="flex gap-4 underline"><Link href="/admin/imports">Import official evidence</Link><Link href="/admin/drafts">Draft queue</Link><Link href="/admin/prompt-studio">Prompt Studio</Link></nav>
      <h2 className="mt-8 text-xl font-bold">Editorial source library</h2><section className="mt-8 grid gap-4 md:grid-cols-2">
        {docs.manifest.map((doc) => (
          <article key={doc.id} className="rounded-lg border border-zinc-300 bg-white p-5">
            <h2 className="text-xl font-black">{doc.title}</h2>
            <p className="mt-2 text-sm text-zinc-600">{doc.purpose}</p>
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-zinc-500">
              {doc.included ? `${doc.charCount} chars loaded` : `Missing: ${doc.error}`}
            </p>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}
