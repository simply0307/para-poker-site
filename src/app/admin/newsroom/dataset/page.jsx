import Link from "next/link";
import { AdminShell, AdminStat } from "@/components/admin-newsroom/AdminShell";
import { BulkSplitActions, DatasetReviewActions } from "@/components/admin-newsroom/DatasetReviewActions";
import { listTrainingExamples } from "@/lib/newsroom/trainingExamples";

export const dynamic = "force-dynamic";

function titleFor(output = {}) {
  return output.headline || output.title || output.subheadline || "Untitled example";
}

function bodyFor(output = {}) {
  return output.recap_body || output.profile_body || output.article_body || output.caption || output.long_body || "";
}

function warningsFor(output = {}, packet = {}) {
  return [
    ...(Array.isArray(output.confidence_notes) ? output.confidence_notes.map((note) => `Confidence: ${note}`) : []),
    ...(Array.isArray(output.missing_data_warnings) ? output.missing_data_warnings.map((note) => `Missing: ${note}`) : []),
    ...(Array.isArray(packet.warnings) ? packet.warnings : []),
  ];
}

function sourceHref(example = {}) {
  if (example.scope === "session" && example.source_session_id) return `/admin/sessions/${encodeURIComponent(example.source_session_id)}`;
  if (example.scope === "player" && example.source_player_id) return `/admin/players/${encodeURIComponent(example.source_player_id)}`;
  if (example.scope === "moment") return "/admin/moments";
  if (example.scope === "article") return "/admin/articles";
  return "/admin/drafts";
}

function datasetStats(examples = []) {
  return {
    total: examples.length,
    ready: examples.filter((row) => row.capture_status === "ready_for_review").length,
    included: examples.filter((row) => row.capture_status === "included").length,
    excluded: examples.filter((row) => row.capture_status === "excluded").length,
    undecided: examples.filter((row) => ["captured", "undecided"].includes(row.capture_status)).length,
    published: examples.filter((row) => row.approved_output).length,
    split: examples.filter((row) => row.capture_status === "included" && row.dataset_split).length,
  };
}

function differenceSummary(original = {}, approved = {}) {
  if (!Object.keys(approved || {}).length) return "No final published output has been captured yet.";
  const originalTitle = titleFor(original);
  const approvedTitle = titleFor(approved);
  const originalBody = bodyFor(original);
  const approvedBody = bodyFor(approved);
  const notes = [];
  if (originalTitle !== approvedTitle) notes.push("title changed");
  if (originalBody !== approvedBody) {
    const delta = approvedBody.length - originalBody.length;
    if (Math.abs(delta) > 80) notes.push(delta > 0 ? "body expanded" : "body tightened");
    else notes.push("body revised");
  }
  if (!notes.length) return "Final output matches the original generated draft closely.";
  return `Human edit summary: ${notes.join(", ")}.`;
}

export default async function DatasetPage() {
  const examples = await listTrainingExamples({ limit: 200 });
  const stats = datasetStats(examples);

  return (
    <AdminShell
      title="Newsroom dataset"
      description="Optional future review of passively captured generation examples. Normal recap publishing does not require touching this page."
    >
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <AdminStat label="Captured" value={stats.total} />
        <AdminStat label="Ready" value={stats.ready} />
        <AdminStat label="Included" value={stats.included} />
        <AdminStat label="Excluded" value={stats.excluded} />
        <AdminStat label="Published" value={stats.published} />
        <AdminStat label="Split assigned" value={stats.split} />
      </div>

      <div className="mt-6">
        <BulkSplitActions />
      </div>

      <section className="mt-8 grid gap-5">
        {examples.length ? examples.map((example) => {
          const original = example.original_output || {};
          const approved = example.approved_output || {};
          const warnings = warningsFor(original, example.context_packet);
          return (
            <article key={example.id} className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
                    {example.scope} / {example.draft_table}
                  </p>
                  <h2 className="mt-1 text-2xl font-black">{titleFor(approved) || titleFor(original)}</h2>
                  <p className="mt-2 text-sm font-bold text-zinc-600">
                    Review: {example.capture_status || "captured"} / Split: {example.dataset_split || "unassigned"} / {example.approved_output ? "Final output captured" : "No final output yet"}
                  </p>
                </div>
                <div className="grid gap-3">
                  <Link href={sourceHref(example)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-black">
                    Open source
                  </Link>
                  <DatasetReviewActions exampleId={example.id} currentStatus={example.capture_status === "ready_for_review" ? "undecided" : example.capture_status || "undecided"} />
                </div>
              </div>

              <p className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm font-bold text-zinc-700">
                {differenceSummary(original, approved)}
              </p>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <CompareBlock title="Original output" output={original} />
                <CompareBlock title="Approved output" output={approved} empty="No approved output captured yet." />
              </div>

              {warnings.length ? (
                <details className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                  <summary className="cursor-pointer text-sm font-black">Confidence and missing-data warnings</summary>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-700">
                    {warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
                  </ul>
                </details>
              ) : null}
            </article>
          );
        }) : (
          <article className="rounded-lg border border-dashed border-zinc-400 bg-white/70 p-6">
            <h2 className="text-2xl font-black">No examples captured yet</h2>
            <p className="mt-3 max-w-3xl leading-7 text-zinc-600">
              Generate and publish a draft after applying the passive capture schema. The normal editor will stay focused on recap work.
            </p>
          </article>
        )}
      </section>
    </AdminShell>
  );
}

function CompareBlock({ title, output = {}, empty = "" }) {
  const body = bodyFor(output);
  if (!Object.keys(output || {}).length) {
    return (
      <section className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
        <h3 className="font-black">{title}</h3>
        <p className="mt-3 text-sm text-zinc-500">{empty || "No output."}</p>
      </section>
    );
  }
  return (
    <section className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <h3 className="font-black">{title}</h3>
      <p className="mt-3 text-sm font-black text-zinc-950">{titleFor(output)}</p>
      {output.subheadline ? <p className="mt-2 text-sm leading-6 text-zinc-600">{output.subheadline}</p> : null}
      {body ? <p className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap text-sm leading-6 text-zinc-700">{body}</p> : null}
    </section>
  );
}
