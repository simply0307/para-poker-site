import Link from "next/link";

export default function OperatorDeniedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f0e8] px-5 text-zinc-950">
      <section className="w-full max-w-lg rounded-lg border border-zinc-300 bg-white p-8 shadow-xl">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-red-700">Access denied</p>
        <h1 className="mt-3 text-4xl font-black">Operator role required</h1>
        <p className="mt-4 leading-7 text-zinc-600">Your identity was authenticated, but it is not linked to an authorized admin or owner profile.</p>
        <div className="mt-8 flex gap-4">
          <Link href="/operator-login" className="rounded bg-zinc-950 px-4 py-3 font-black uppercase tracking-wide text-white">Use another account</Link>
          <Link href="/" className="px-4 py-3 font-black uppercase tracking-wide text-zinc-600">Public site</Link>
        </div>
      </section>
    </main>
  );
}
