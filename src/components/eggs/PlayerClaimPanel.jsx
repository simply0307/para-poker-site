"use client";
import Link from "next/link";
import { useState } from "react";
import { accountFetch } from "./accountFetch";

export function PlayerClaimPanel({ initialPlayers, initialClaims, linked }) {
  const [players, setPlayers] = useState(initialPlayers); const [claims, setClaims] = useState(initialClaims);
  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function search(event) {
    event.preventDefault(); setError(""); setBusy(true);
    try { const result = await accountFetch(`/api/eggs/poker/players?q=${encodeURIComponent(new FormData(event.currentTarget).get("q"))}`); setPlayers(result.players); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  async function refreshClaims() { setClaims((await accountFetch("/api/eggs/poker/claims")).claims); }
  async function submit(event) {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await accountFetch("/api/eggs/poker/claims", { method: "POST", body: { player_id: form.get("player"), evidence_note: form.get("evidence") } });
      setMessage("Claim submitted for operator review. No connection is made until it is approved."); await refreshClaims();
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  async function withdraw(id) {
    setError(""); setBusy(true);
    try { await accountFetch(`/api/eggs/poker/claims/${id}/withdraw`, { method: "POST" }); await refreshClaims(); setMessage("Claim withdrawn."); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <>
    {linked ? <p className="eggs-notice">Your account already has a reviewed Poker connection. Transfers are not available.</p> : <>
      <form onSubmit={search} className="eggs-form eggs-search"><label>Find a league player<input name="q" type="search" maxLength={80} placeholder="League display name" /></label><button className="eggs-button" disabled={busy}>Search</button></form>
      <form onSubmit={submit} className="eggs-form eggs-form-card">
        <fieldset><legend>Choose the record you’re claiming</legend><div className="eggs-player-options">
          {players.map(player => <label key={player.player_id} className="eggs-player-option"><input type="radio" name="player" value={player.player_id} required /><span>{player.display_name}</span><Link href={`/para/poker/players/${player.player_id}`} className="eggs-text-link" target="_blank" rel="noopener noreferrer">Dossier ↗</Link></label>)}
          {!players.length ? <p>No players found. Try another league display name.</p> : null}
        </div></fieldset>
        <label>Private supporting evidence <span className="eggs-help">(optional)</span><textarea name="evidence" rows={4} maxLength={2000} aria-describedby="evidence-help" /></label>
        <p id="evidence-help" className="eggs-help">Tell an operator how to verify ownership. Don’t include passwords, government IDs or payment details. Your claim stays pending until an operator decides or you withdraw it. Supporting evidence stays attached to the claim, including after a decision or withdrawal.</p>
        <button className="eggs-button" disabled={busy || !players.length}>{busy ? "Please wait…" : "Request player claim"}</button>
      </form>
    </>}
    {error ? <p role="alert" className="eggs-error">{error}</p> : null}{message ? <p role="status" className="eggs-notice">{message}</p> : null}
    <section className="eggs-account-section"><h2>Your claims</h2>{!claims.length ? <p className="eggs-help">No claims yet.</p> : <ul className="eggs-claim-list">{claims.map(claim => <li key={claim.id}>
      <div className="eggs-section-heading"><h3>{claim.player_name}</h3><span className="eggs-claim-status">{claim.status}</span></div>
      <p className="eggs-help">Submitted {claim.submitted_at.slice(0, 10)} (UTC)</p>
      {claim.decision_reason ? <p>Decision: {claim.decision_reason}</p> : null}
      {claim.evidence_note ? <details><summary>Your private supporting evidence</summary><p className="eggs-profile-bio">{claim.evidence_note}</p></details> : null}
      {claim.status === "pending" ? <button type="button" className="eggs-text-link" disabled={busy} onClick={() => withdraw(claim.id)}>Withdraw claim</button> : null}
    </li>)}</ul>}</section>
  </>;
}
