import Link from "next/link";
import { formatDate, getSessionsIndex, text } from "@/lib/newsroom/data";

export const revalidate = 60;

export default async function AdminSessionsIndexPage() {
  const sessions = await getSessionsIndex();

  return (
    <main className="min-h-screen bg-zinc-100 px-5 py-10 text-zinc-950 md:px-8">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Admin newsroom</p>
      <h1 className="mt-3 text-5xl font-black">Session recap drafts</h1>
      <p className="mt-4 max-w-3xl leading-7 text-zinc-600">
        Pick a session to generate, inspect, edit, save, publish, or unpublish its public recap.
      </p>
      <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sessions.map((session) => (
          <Link key={session.id} href={`/admin/sessions/${encodeURIComponent(text(session.session_code || session.id))}`} className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm transition hover:border-amber-500">
            <h2 className="text-2xl font-black">{text(session.session_code, "Session")}</h2>
            <p className="mt-2 text-sm text-zinc-600">{formatDate(session.played_at)}{session.hands_count ? ` / ${session.hands_count} hands` : ""}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
