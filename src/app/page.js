import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-6 py-16">
      <section className="mx-auto flex min-h-[70vh] max-w-5xl flex-col justify-center">
        <p className="text-amber-400 uppercase tracking-[0.2em] text-xs font-bold">
          Para Poker
        </p>

        <h1 className="mt-4 max-w-3xl text-5xl font-black leading-tight md:text-7xl">
          Player profiles from tracked PokerNow hands.
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
          Browse the preseason directory and open native player dossiers powered
          by Supabase data and recap archives.
        </p>

        <div className="mt-10">
          <Link
            href="/players-v2"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-amber-400 px-6 font-black text-zinc-950 transition hover:bg-amber-300"
          >
            View Players
          </Link>
        </div>
      </section>
    </main>
  );
}
