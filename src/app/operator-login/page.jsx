import Link from "next/link";
import { OperatorLoginForm } from "./OperatorLoginForm";

export const dynamic = "force-dynamic";

export default function OperatorLoginPage() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const configured = Boolean(supabaseUrl && supabasePublishableKey);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f0e8] px-5 text-zinc-950">
      <section className="w-full max-w-md rounded-lg border border-zinc-300 bg-white p-8 shadow-xl">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Para-Poker League</p>
        <h1 className="mt-3 text-4xl font-black">Operator sign-in</h1>
        <p className="mt-4 leading-7 text-zinc-600">Use your existing league operator account. Authorization is verified by the server on every privileged request.</p>
        {configured ? (
          <OperatorLoginForm supabaseUrl={supabaseUrl} supabasePublishableKey={supabasePublishableKey} />
        ) : (
          <p role="alert" className="mt-8 rounded border border-red-300 bg-red-50 p-4 font-bold text-red-800">Operator authentication is unavailable.</p>
        )}
        <Link href="/" className="mt-6 inline-block text-sm font-black uppercase tracking-wide text-zinc-600 underline">Return to public site</Link>
      </section>
    </main>
  );
}
