"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { accountFetch } from "@/components/eggs/accountFetch";

const date = value => value ? new Date(value).toLocaleString() : "—";

function ReviewCard({ claim, onChange }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function review(event) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      await accountFetch(`/api/admin/player-claims/${claim.id}/review`, { method: "POST", body: { decision: form.get("decision"), reason: form.get("reason") } });
      await onChange();
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <article className="rounded-lg border border-zinc-300 bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-black">{claim.player_name}</h2>
      <p className="mt-2 text-sm text-zinc-600">{claim.handle ? `@${claim.handle}` : "Deleted profile"} · {claim.status}</p></div>
      <Link className="underline" href={`/para/poker/players/${claim.player_id}`} target="_blank" rel="noopener noreferrer">Full dossier ↗</Link>
    </div>
    <p className="mt-3 break-all text-xs text-zinc-500">Claim {claim.id} · Profile {claim.claimant_profile_id}</p>
    <p className="mt-2 text-sm text-zinc-600">Submitted {date(claim.submitted_at)}{claim.reviewed_at ? ` · Reviewed ${date(claim.reviewed_at)}` : ""}</p>
    {claim.decision_reason ? <p className="mt-4"><strong>Decision reason:</strong> {claim.decision_reason}</p> : null}
    {claim.reviewer_profile_id ? <p className="mt-2 break-all text-xs text-zinc-500">Reviewer operator record: {claim.reviewer_profile_id}</p> : null}
    <section className="my-5 rounded border border-zinc-200 bg-zinc-50 p-4"><h3 className="font-bold">Private supporting evidence</h3>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm">{claim.evidence_note || "No supporting evidence was submitted."}</p>
    </section>
    {claim.status === "pending" ? <form onSubmit={review} className="eggs-form">
      {!claim.handle ? <p className="eggs-help">The claimant deleted their profile. This claim remains pending until an operator rejects it; it cannot establish a connection to a deleted profile.</p> : null}
      <label>Decision<select name="decision" required><option value="">Choose a decision</option><option value="approve" disabled={!claim.handle}>Approve ownership</option><option value="reject">Reject claim</option></select></label>
      <label>Durable decision reason<textarea name="reason" minLength={3} maxLength={500} rows={2} required /></label>
      <p className="eggs-help">Record the reason, not copies of private evidence. Names and emails alone are not proof. Approval cannot replace an existing owner.</p>
      <button className="eggs-button" disabled={busy}>{busy ? "Saving…" : "Record decision"}</button>
    </form> : null}
    {error ? <p role="alert" className="eggs-error">{error}</p> : null}
  </article>;
}

export function PlayerClaimReview() {
  const [claims, setClaims] = useState([]);
  const [status, setStatus] = useState("pending"); const [offset, setOffset] = useState(0);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  async function reload() {
    setError(""); setLoading(true);
    try { const data = await accountFetch(`/api/admin/player-claims?status=${status}&offset=${offset}`); setClaims(data.claims); }
    catch (failure) { setError(failure.message); } finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    accountFetch(`/api/admin/player-claims?status=${status}&offset=${offset}`).then(data => {
      if (active) { setClaims(data.claims); setError(""); }
    }).catch(failure => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [status, offset]);
  return <>
    <div className="eggs-form mb-6 max-w-md"><label>Claim status<select value={status} onChange={event => { setStatus(event.target.value); setOffset(0); setLoading(true); }}>
      {["pending", "approved", "rejected", "withdrawn", "all"].map(value => <option key={value} value={value}>{value}</option>)}</select></label></div>
    {error ? <p role="alert" className="eggs-error">{error}</p> : null}
    {loading ? <p role="status">Loading claims…</p> : !error && !claims.length ? <p>No claims in this view.</p> : null}
    {!loading && !error ? <div className="grid gap-6">{claims.map(claim => <ReviewCard key={claim.id} claim={claim} onChange={reload} />)}</div> : null}
    <div className="mt-6 flex gap-4"><button disabled={loading || offset === 0} className="underline disabled:opacity-40" onClick={() => { setOffset(Math.max(0, offset - 50)); setLoading(true); }}>Previous</button>
      <button disabled={loading || claims.length < 50} className="underline disabled:opacity-40" onClick={() => { setOffset(offset + 50); setLoading(true); }}>Next</button></div>
  </>;
}
