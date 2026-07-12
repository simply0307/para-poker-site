import { AdminCard, AdminShell } from "@/components/admin-newsroom/AdminShell";

const adminRoutes = [
  ["/admin/imports", "Imports", "Review import health, hand/action coverage, and data pipeline status."],
  ["/admin/sessions", "Session Drafts", "Choose a session and generate public recap drafts."],
  ["/admin/players", "Player Drafts", "Choose a player and generate profile drafts."],
  ["/admin/standings", "Standings Drafts", "Standings summary generation workspace."],
  ["/admin/moments", "Moment Drafts", "Moment blurb generation workspace."],
  ["/admin/articles", "Article Drafts", "League article generation workspace."],
  ["/admin/social-captions", "Social Captions", "Generate short social/card copy from verified league data."],
  ["/admin/drafts", "Draft Studio", "Jump between draft queues and publishing workspaces."],
  ["/admin/prompt-studio", "Prompt Studio", "Build reusable prompt configs through form controls."],
  ["/admin/newsroom", "Newsroom Library", "Prompt docs, assignment layers, and generation notes."],
  ["/admin/settings", "Settings", "Season status, homepage modules, provider diagnostics, and defaults."],
];

export default function AdminHome() {
  return (
    <AdminShell
      eyebrow="Para League Admin"
      title="Newsroom control room"
      description="Admin pages generate editable drafts, expose context packets, show included editorial docs, and control publishing."
    >
      <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {adminRoutes.map(([href, title, body]) => (
          <AdminCard key={href} href={href} title={title}>
            <p>{body}</p>
          </AdminCard>
        ))}
      </section>
    </AdminShell>
  );
}
