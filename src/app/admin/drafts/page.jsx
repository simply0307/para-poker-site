import { AdminCard, AdminPlaceholder, AdminShell } from "@/components/admin-newsroom/AdminShell";

const draftDesks = [
  ["/admin/sessions", "Session recaps", "Generate and publish public session recap drafts."],
  ["/admin/players", "Player profiles", "Generate player dossier/profile drafts."],
  ["/admin/standings", "Standings summaries", "Generate current board and standings pulse drafts."],
  ["/admin/moments", "Moment blurbs", "Generate selected moment archive copy."],
  ["/admin/articles", "League articles", "Generate broader newsroom article drafts."],
];

export default function AdminDraftsPage() {
  return (
    <AdminShell title="Draft Studio" description="Unified entry point for Para League draft workflows. Full browse/edit queues can land here later.">
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {draftDesks.map(([href, title, body]) => (
          <AdminCard key={href} href={href} title={title}>
            <p>{body}</p>
          </AdminCard>
        ))}
      </section>
      <div className="mt-6">
        <AdminPlaceholder title="Draft queue pending">
          <p>
            The MVP keeps editing inside each draft desk. This page now gives admins one place to jump between draft types; the future
            version can list saved drafts by status, scope, model, and publish state.
          </p>
        </AdminPlaceholder>
      </div>
    </AdminShell>
  );
}
