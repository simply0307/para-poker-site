"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OperatorSignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await fetch("/api/operator-session", { method: "DELETE" });
    router.push("/operator-login");
    router.refresh();
  }

  return (
    <button type="button" onClick={signOut} disabled={pending} className="rounded-sm border border-white/15 px-3 py-2 text-zinc-300 hover:border-amber-200/60 hover:text-white disabled:opacity-60">
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
