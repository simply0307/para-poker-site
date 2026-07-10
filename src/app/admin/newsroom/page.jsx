import { loadNewsroomEditorialDocs } from "@/lib/newsroom/editorialDocs";

export const dynamic = "force-dynamic";

export default async function AdminNewsroomPage() {
  const docs = await loadNewsroomEditorialDocs();

  return (
    <main className="min-h-screen bg-zinc-100 px-5 py-10 text-zinc-950 md:px-8">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Admin newsroom</p>
      <h1 className="mt-3 text-5xl font-black">Prompt library</h1>
      <p className="mt-4 max-w-3xl leading-7 text-zinc-600">
        These server-side markdown docs are loaded into generation packets. Public pages never expose this debug material.
      </p>
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
    </main>
  );
}
