import { AdminShell } from "@/components/admin-newsroom/AdminShell";
import { loadNewsroomEditorialDocs } from "@/lib/newsroom/editorialDocs";

export const dynamic = "force-dynamic";

export default async function AdminNewsroomPage() {
  const docs = await loadNewsroomEditorialDocs();

  return (
    <AdminShell
      title="Prompt library"
      description="These server-side markdown docs are loaded into generation packets. Public pages never expose this debug material."
    >
      <section className="mt-8 grid gap-4 md:grid-cols-2">
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
