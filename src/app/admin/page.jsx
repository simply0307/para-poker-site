import Link from "next/link";

const adminRoutes = [
  ["/admin/sessions", "Session Drafts", "Choose a session and generate public recap drafts."],
  ["/admin/players", "Player Drafts", "Choose a player and generate profile drafts."],
  ["/admin/player-session-recaps", "Player Session Drafts", "Generate player-specific session recap drafts."],
  ["/admin/standings", "Standings Drafts", "Standings summary generation workspace."],
  ["/admin/moments", "Moment Drafts", "Moment blurb generation workspace."],
  ["/admin/articles", "Article Drafts", "League article generation workspace."],
  ["/admin/newsroom", "Newsroom Library", "Prompt docs, assignment layers, and generation notes."],
];

export default function AdminHome() {
  return (
    <main className="min-h-screen bg-zinc-100 px-5 py-10 text-zinc-950 md:px-8">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Para League Admin</p>
      <h1 className="mt-3 text-5xl font-black">Newsroom control room</h1>
      <p className="mt-4 max-w-3xl leading-7 text-zinc-600">
        Admin pages generate editable drafts, expose context packets, show included editorial docs, and control publishing.
      </p>
      <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {adminRoutes.map(([href, title, body]) => (
          <Link key={href} href={href} className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm transition hover:border-amber-500">
            <h2 className="text-2xl font-black">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{body}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
