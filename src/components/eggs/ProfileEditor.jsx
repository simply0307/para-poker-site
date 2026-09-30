"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { accountFetch } from "./accountFetch";

export function ProfileEditor({ profile }) {
  const router = useRouter();
  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    const body = { display_name: form.get("display_name"), bio: form.get("bio"), visibility: form.get("visibility") };
    if (!profile) body.handle = form.get("handle");
    try {
      await accountFetch("/api/eggs/profile", { method: profile ? "PATCH" : "POST", body });
      // Navigation happens only after the session/profile response is persisted.
      if (!profile) router.replace("/profile");
      else setMessage("Profile saved.");
      router.refresh();
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  const presentation = <>
    <label>Display name <span className="eggs-help">{profile ? "" : "(optional)"}</span><input name="display_name" defaultValue={profile?.display_name || ""} maxLength={80} autoComplete="nickname" required={Boolean(profile)} /></label>
    <label>Short bio <span className="eggs-help">(optional)</span><textarea name="bio" defaultValue={profile?.bio || ""} maxLength={500} rows={3} /></label>
  </>;
  return <form onSubmit={submit} className="eggs-form eggs-form-card">
    {profile ? <p>Your handle is <strong>@{profile.handle}</strong>. Handles stay fixed.</p> : <>
      <label>Choose your handle<input name="handle" pattern="[a-z0-9_]{3,30}" minLength={3} maxLength={30} autoCapitalize="none" spellCheck={false} required aria-describedby="handle-help" /></label>
      <p id="handle-help" className="eggs-help">3–30 lowercase letters, numbers or underscores. Your handle can’t be changed or reused after deletion.</p>
    </>}
    {profile ? presentation : <details><summary>Add a name or short bio</summary><div className="eggs-form eggs-optional">{presentation}</div></details>}
    <label>Who can see your profile?<select name="visibility" defaultValue={profile?.visibility || "private"}><option value="private">Only me</option><option value="public">Anyone with the link</option></select></label>
    <p className="eggs-help">Poker records stay with the league. A Poker connection is only shown here when you choose to enable it.</p>
    {error ? <p role="alert" className="eggs-error">{error}</p> : null}{message ? <p role="status" className="eggs-notice">{message}</p> : null}
    <button className="eggs-button" disabled={busy}>{busy ? "Saving…" : profile ? "Save profile" : "Create profile"}</button>
  </form>;
}
