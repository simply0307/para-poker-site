"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { accountFetch } from "./accountFetch";

export function PokerVisibility({ enabled }) {
  const router = useRouter();
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function change(event) {
    setBusy(true); setError("");
    try { await accountFetch("/api/eggs/poker/link", { method: "PATCH", body: { show_on_profile: event.target.checked } }); router.refresh(); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <div className="eggs-form"><label className="eggs-check"><input type="checkbox" checked={enabled} disabled={busy} onChange={change} /> Show my Para Poker summary on my profile</label>
    <p className="eggs-help">Other people can see it only while your EGGS profile is public. Hiding it does not change your league record.</p>{error ? <p role="alert" className="eggs-error">{error}</p> : null}</div>;
}
