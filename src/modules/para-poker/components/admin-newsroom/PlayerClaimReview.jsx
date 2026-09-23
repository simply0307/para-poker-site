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
  async function hold(event) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const until = form.get("release") === "yes" ? null : new Date(form.get("until")).toISOString();
      await accountFetch(`/api/admin/player-claims/${claim.id}/hold`, { method: "POST", body: { until, reason: form.get("reason") } });
      await onChange();
    } catch (failure) { setError(failure instanceof RangeError ? "Choose a valid future expiry." : failure.message); } finally { setBusy(false); }
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
      <p className="mt-2 whitespace-pre-wrap break-words text-sm">{claim.evidence_note || (claim.evidence_redacted_at || claim.evidence_expired ? "Evidence expired or was redacted. The decision record remains." : "No supporting evidence was submitted.")}</p>
      {claim.evidence_expires_at ? <p className="mt-3 text-xs text-zinc-600">90-day deadline: {date(claim.evidence_expires_at)}{claim.hold_active ? " · Active documented hold" : ""}</p> : null}
    </section>
    {claim.status === "pending" && claim.handle ? <form onSubmit={review} className="eggs-form">
      <label>Decision<select name="decision" required><option value="">Choose a decision</option><option value="approve">Approve ownership</option><option value="reject">Reject claim</option></select></label>
      <label>Durable decision reason<textarea name="reason" minLength={3} maxLength={500} rows={2} required /></label>
      <p className="eggs-help">Record the reason, not copies of private evidence. Names and emails alone are not proof. Approval cannot replace an existing owner.</p>
      <button className="eggs-button" disabled={busy}>{busy ? "Saving…" : "Record decision"}</button>
    </form> : null}
    <details className="mt-6"><summary className="cursor-pointer font-bold">Evidence holds and history</summary>
      {(claim.holds || []).map(item => <div key={item.id} className="my-3 border-l-2 border-amber-700 pl-3 text-sm"><p>{item.reason}</p><p className="text-xs text-zinc-600">{date(item.started_at)} to {date(item.expires_at)} · Operator {item.operator_profile_id}</p>
        {item.released_at ? <p className="text-xs text-zinc-600">Released {date(item.released_at)}: {item.release_reason}</p> : null}</div>)}
      {claim.evidence_note ? <form onSubmit={hold} className="eggs-form mt-4">
        <label>Hold expiry (your local time)<input name="until" type="datetime-local" /></label>
        <label>Documented dispute / hold reason<textarea name="reason" minLength={3} maxLength={500} rows={2} required /></label>
        <label className="eggs-check"><input type="checkbox" name="release" value="yes" /> Release the current hold instead</label>
        <p className="eggs-help">Include a dispute reference. A hold needs a future expiry; renewal records a new hold. Expired or redacted evidence cannot be restored.</p>
        <button className="eggs-button" disabled={busy}>Save hold decision</button>
      </form> : <p className="mt-4 text-sm text-zinc-600">There is no available supporting evidence to place on hold.</p>}
    </details>
    {error ? <p role="alert" className="eggs-error">{error}</p> : null}
  </article>;
}

export function PlayerClaimReview() {
  const [claims, setClaims] = useState([]); const [retention, setRetention] = useState(null);
  const [status, setStatus] = useState("pending"); const [offset, setOffset] = useState(0);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  async function reload() {
    setError(""); setLoading(true);
    try { const data = await accountFetch(`/api/admin/player-claims?status=${status}&offset=${offset}`); setClaims(data.claims); setRetention(data.retention); }
    catch (failure) { setError(failure.message); } finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    accountFetch(`/api/admin/player-claims?status=${status}&offset=${offset}`).then(data => {
      if (active) { setClaims(data.claims); setRetention(data.retention); setError(""); }
    }).catch(failure => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [status, offset]);
  return <>
    <div className="eggs-form mb-6 max-w-md"><label>Claim status<select value={status} onChange={event => { setStatus(event.target.value); setOffset(0); setLoading(true); }}>
      {["pending", "approved", "rejected", "withdrawn", "all"].map(value => <option key={value} value={value}>{value}</option>)}</select></label></div>
    {retention ? <aside className="mb-6 rounded border border-zinc-300 bg-white p-4 text-sm"><strong>Evidence retention</strong><p>Last successful batch: {date(retention.last_run_at)} · Total redacted: {retention.total_redacted_count} · Evidence overdue without a hold: {retention.overdue_count} · Claims past their review window: {retention.unreviewed_overdue_count || 0}</p>
      {retention.needs_attention ? <p className="mt-2 font-bold text-red-800">Retention needs attention. Verify the scheduled worker and its logs before accepting more claims.</p> : null}
    </aside> : null}
    {error ? <p role="alert" className="eggs-error">{error}</p> : null}
    {loading ? <p role="status">Loading claims…</p> : !error && !claims.length ? <p>No claims in this view.</p> : null}
    {!loading && !error ? <div className="grid gap-6">{claims.map(claim => <ReviewCard key={claim.id} claim={claim} onChange={reload} />)}</div> : null}
    <div className="mt-6 flex gap-4"><button disabled={loading || offset === 0} className="underline disabled:opacity-40" onClick={() => { setOffset(Math.max(0, offset - 50)); setLoading(true); }}>Previous</button>
      <button disabled={loading || claims.length < 50} className="underline disabled:opacity-40" onClick={() => { setOffset(offset + 50); setLoading(true); }}>Next</button></div>
  </>;
}
