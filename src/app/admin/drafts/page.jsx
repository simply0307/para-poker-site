import { AdminCard, AdminPlaceholder, AdminShell } from "@/components/admin-newsroom/AdminShell";
import { DRAFT_TYPE_KEYS, getDraftTypes } from "@/lib/newsroom/draftTypes";

const deskOverrides = {
  [DRAFT_TYPE_KEYS.SESSION_RECAP]: "/admin/sessions",
  [DRAFT_TYPE_KEYS.PLAYER_PROFILE]: "/admin/players",
  [DRAFT_TYPE_KEYS.STANDINGS_SUMMARY]: "/admin/standings",
  [DRAFT_TYPE_KEYS.MOMENT_BLURB]: "/admin/moments",
  [DRAFT_TYPE_KEYS.LEAGUE_ARTICLE]: "/admin/articles",
  [DRAFT_TYPE_KEYS.SOCIAL_CAPTION]: "/admin/social-captions",
};

const visibleDraftDesks = getDraftTypes()
  .filter((type) => deskOverrides[type.key])
  .map((type) => ({
    href: deskOverrides[type.key],
    title: type.label,
    body: type.purpose,
    meta: type.sourceType,
  }));

export default function AdminDraftsPage() {
  return (
    <AdminShell title="Draft Studio" description="Unified entry point for Para League draft workflows. Full browse/edit queues can land here later.">
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visibleDraftDesks.map(({ href, title, body, meta }) => (
          <AdminCard key={href} href={href} title={title} meta={meta}>
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
