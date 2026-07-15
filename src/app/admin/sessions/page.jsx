import Link from "next/link";
import { AdminShell } from "@/components/admin-newsroom/AdminShell";
import { formatDate, getSessionsIndex, text } from "@/lib/newsroom/data";
import { readSeasonSettings } from "@/lib/newsroom/seasonSettings";

export const revalidate = 60;

export default async function AdminSessionsIndexPage() {
  const seasonSettings = await readSeasonSettings();
  const sessions = await getSessionsIndex(seasonSettings.activeSeasonCode);

  return (
    <AdminShell
      title="Session recap drafts"
      description={`Pick a ${seasonSettings.activeSeasonCode} session to generate, inspect, edit, save, publish, or unpublish its public recap.`}
    >
      <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sessions.map((session) => (
          <Link key={session.id} href={`/admin/sessions/${encodeURIComponent(text(session.session_code || session.id))}`} className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm transition hover:border-amber-500">
            <h2 className="text-2xl font-black">{text(session.session_code, "Session")}</h2>
            <p className="mt-2 text-sm text-zinc-600">{formatDate(session.played_at)}{session.hands_count ? ` / ${session.hands_count} hands` : ""}</p>
          </Link>
        ))}
      </section>
    </AdminShell>
  );
}
