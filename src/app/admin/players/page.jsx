import Link from "next/link";
import { cleanName, getPlayersIndex, text } from "@/lib/newsroom/data";

export const revalidate = 60;

export default async function AdminPlayersIndexPage() {
  const players = await getPlayersIndex();

  return (
    <main className="min-h-screen bg-zinc-100 px-5 py-10 text-zinc-950 md:px-8">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Admin newsroom</p>
      <h1 className="mt-3 text-5xl font-black">Player profile drafts</h1>
      <p className="mt-4 max-w-3xl leading-7 text-zinc-600">
        Pick a player to generate, edit, save, publish, or unpublish their public profile draft.
      </p>
      <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {players.map((player) => (
          <Link key={player.id} href={`/admin/players/${encodeURIComponent(text(player.slug || player.id))}`} className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm transition hover:border-amber-500">
            <h2 className="text-2xl font-black">{cleanName(player.display_name || player.pokernow_name)}</h2>
            <p className="mt-2 text-sm text-zinc-600">Generate player profile draft</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
