"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export function OperatorLoginForm({ supabaseUrl, supabasePublishableKey }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function signIn(event) {
    event.preventDefault();
    setError("");
    setPending(true);

    try {
      const form = new FormData(event.currentTarget);
      const auth = createClient(supabaseUrl, supabasePublishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data, error: signInError } = await auth.auth.signInWithPassword({
        email: String(form.get("email") || ""),
        password: String(form.get("password") || ""),
      });
      if (signInError || !data.session?.access_token) throw signInError || new Error("Sign-in failed.");

      const response = await fetch("/api/operator-session", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      if (response.status === 403) throw new Error("This account is not an authorized league operator.");
      if (!response.ok) throw new Error("The operator session could not be established.");
      router.push("/admin");
      router.refresh();
    } catch (signInFailure) {
      setError(signInFailure?.message || "Sign-in failed.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={signIn} className="mt-8 space-y-5">
      <label className="block">
        <span className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Email</span>
        <input name="email" type="email" autoComplete="username" required className="mt-2 w-full rounded border border-zinc-300 px-4 py-3 text-zinc-950" />
      </label>
      <label className="block">
        <span className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className="mt-2 w-full rounded border border-zinc-300 px-4 py-3 text-zinc-950" />
      </label>
      {error ? <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p> : null}
      <button disabled={pending} className="w-full rounded bg-zinc-950 px-4 py-3 font-black uppercase tracking-[0.14em] text-white disabled:opacity-60">
        {pending ? "Verifying…" : "Sign in as operator"}
      </button>
    </form>
  );
}
