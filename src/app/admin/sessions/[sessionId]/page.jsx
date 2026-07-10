import Link from "next/link";
import { notFound } from "next/navigation";
import { getLatestDraft } from "@/lib/newsroom/data";
import { getSessionNewsroomData, formatDate, text } from "@/lib/newsroom/data";
import { getSessionRecapVariationOptions } from "@/lib/newsroom/sessionRecapAssignment";
import { SessionRecapDraftEditor } from "@/components/admin-newsroom/SessionRecapDraftEditor";

export const dynamic = "force-dynamic";

export default async function AdminSessionNewsroomPage({ params }) {
  const { sessionId } = await params;
  const sessionData = await getSessionNewsroomData(sessionId);
  if (!sessionData) notFound();

  const latestDraft = await getLatestDraft({ scope: "session", sourceSessionId: sessionData.session.id });

  return (
    <main className="min-h-screen bg-zinc-100 px-5 py-8 text-zinc-950 md:px-8">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Admin newsroom</p>
      <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">
        {text(sessionData.session.session_code, "Session")} draft desk
      </h1>
      <p className="mt-4 max-w-3xl leading-7 text-zinc-600">
        Generate, inspect, edit, publish, and unpublish session recap drafts. Public pages never generate directly.
      </p>

      <nav className="my-6 flex flex-wrap gap-4 text-sm font-bold">
        <Link href="/admin">Admin home</Link>
        <Link href={`/sessions/${encodeURIComponent(text(sessionData.session.session_code || sessionId))}`}>Public session</Link>
        <Link href="/admin/newsroom">Prompt library</Link>
      </nav>

      <section className="mb-6 grid gap-3 md:grid-cols-4">
        <Stat label="Date" value={formatDate(sessionData.session.played_at)} />
        <Stat label="Players" value={String(sessionData.participants.length || "-")} />
        <Stat label="Hands" value={text(sessionData.session.hands_count, "-")} />
        <Stat label="Moments" value={String(sessionData.notableHands.length || 0)} />
      </section>

      <SessionRecapDraftEditor
        sessionKey={text(sessionData.session.session_code || sessionId)}
        initialDraft={latestDraft}
        variationOptions={getSessionRecapVariationOptions()}
      />
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-zinc-300 bg-white p-4">
      <span className="block text-xs font-black uppercase tracking-wide text-zinc-500">{label}</span>
      <strong className="mt-2 block text-2xl">{value}</strong>
    </div>
  );
}
