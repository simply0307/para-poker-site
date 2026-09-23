"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { accountFetch } from "./accountFetch";

export function ConsumerLogout() {
  const router = useRouter();
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true); setError("");
    try { await accountFetch("/api/eggs/auth/logout", { method: "POST" }); router.replace("/login"); router.refresh(); }
    catch (failure) { setError(failure.message); setBusy(false); }
  }
  return <div><button type="button" className="eggs-text-link" disabled={busy} onClick={logout}>{busy ? "Signing out…" : "Sign out of EGGS"}</button>{error ? <p role="alert" className="eggs-error">{error}</p> : null}</div>;
}
