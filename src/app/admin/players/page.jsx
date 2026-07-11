import Link from "next/link";
import { AdminShell } from "@/components/admin-newsroom/AdminShell";
import { cleanName, getPlayersIndex, text } from "@/lib/newsroom/data";

export const revalidate = 60;

export default async function AdminPlayersIndexPage() {
  const players = await getPlayersIndex();

  return (
    <AdminShell
      title="Player profile drafts"
      description="Pick a player to generate, edit, save, publish, or unpublish their public profile draft."
    >
      <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {players.map((player) => (
          <Link key={player.id} href={`/admin/players/${encodeURIComponent(text(player.slug || player.id))}`} className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm transition hover:border-amber-500">
            <h2 className="text-2xl font-black">{cleanName(player.display_name || player.pokernow_name)}</h2>
            <p className="mt-2 text-sm text-zinc-600">Generate player profile draft</p>
          </Link>
        ))}
      </section>
    </AdminShell>
  );
}
