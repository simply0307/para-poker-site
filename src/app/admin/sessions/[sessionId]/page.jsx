import Link from "next/link";
import { notFound } from "next/navigation";
import { getLatestDraft } from "@/lib/newsroom/data";
import { getSessionNewsroomData, formatDate, text } from "@/lib/newsroom/data";
import { getSessionRecapVariationOptions } from "@/lib/newsroom/sessionRecapAssignment";
import { buildSessionViewModel } from "@/lib/newsroom/viewModels/session";
import { AppliedOverridesPanel } from "@/components/admin-newsroom/AppliedOverridesPanel";
import { AdminShell, AdminStat } from "@/components/admin-newsroom/AdminShell";
import { SessionRecapDraftEditor } from "@/components/admin-newsroom/SessionRecapDraftEditor";

export const dynamic = "force-dynamic";

export default async function AdminSessionNewsroomPage({ params }) {
  const { sessionId } = await params;
  const sessionData = await getSessionNewsroomData(sessionId);
  if (!sessionData) notFound();

  const [latestDraft, viewModel] = await Promise.all([
    getLatestDraft({ scope: "session", sourceSessionId: sessionData.session.id }),
    buildSessionViewModel(sessionData.session.id),
  ]);

  return (
    <AdminShell
      title={`${text(sessionData.session.session_code, "Session")} draft desk`}
      description="Generate, inspect, edit, publish, and unpublish session recap drafts. Public pages never generate directly."
      actions={
        <>
          <Link className="rounded-md border border-zinc-400 px-3 py-2 text-sm font-black" href="/admin">Admin home</Link>
          <Link className="rounded-md border border-zinc-400 px-3 py-2 text-sm font-black" href={`/sessions/${encodeURIComponent(text(sessionData.session.session_code || sessionId))}`}>Public session</Link>
          <Link className="rounded-md border border-zinc-400 px-3 py-2 text-sm font-black" href="/admin/newsroom">Prompt library</Link>
        </>
      }
    >

      <section className="mb-6 grid gap-3 md:grid-cols-4">
        <AdminStat label="Date" value={formatDate(sessionData.session.played_at)} />
        <AdminStat label="Players" value={String(sessionData.participants.length || "-")} />
        <AdminStat label="Hands" value={text(sessionData.session.hands_count, "-")} />
        <AdminStat label="Moments" value={String(sessionData.notableHands.length || 0)} />
      </section>

      <AppliedOverridesPanel overrides={viewModel?.appliedOverrides || []} />

      <SessionRecapDraftEditor
        sessionKey={text(sessionData.session.session_code || sessionId)}
        initialDraft={latestDraft}
        variationOptions={getSessionRecapVariationOptions()}
      />
    </AdminShell>
  );
}
