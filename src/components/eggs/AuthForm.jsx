"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { accountFetch } from "./accountFetch";

export function AuthForm({ confirmationFailed = false }) {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [error, setError] = useState(confirmationFailed ? "That email link could not be completed. Open the newest link in the browser where you requested it, or sign in with your password." : "");
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const body = { action: mode, email: form.get("email") };
      if (mode !== "email-link") body.password = form.get("password");
      const result = await accountFetch("/api/eggs/auth", { method: "POST", body });
      if (result.redirect) { router.replace(result.redirect); router.refresh(); }
      else setMessage(result.message);
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <div className="eggs-form-card">
    <div className="eggs-mode-buttons" aria-label="Account action">
      <button type="button" disabled={busy} aria-pressed={mode !== "register"} onClick={() => { setMode("login"); setError(""); setMessage(""); }}>Sign in</button>
      <button type="button" disabled={busy} aria-pressed={mode === "register"} onClick={() => { setMode("register"); setError(""); setMessage(""); }}>Create account</button>
    </div>
    <form className="eggs-form" onSubmit={submit}>
      <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
      {mode !== "email-link" ? <label>Password<input name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? 8 : 1} maxLength={128} required /></label> : <p className="eggs-help">For an existing EGGS account. Open the new email link in this browser to sign in. Your password stays unchanged.</p>}
      {mode === "register" ? <p className="eggs-help">Use at least 8 characters. After confirming your email, you’ll choose a handle. A name and bio are optional.</p> : null}
      {error ? <p role="alert" className="eggs-error">{error}</p> : null}
      {message ? <p role="status" className="eggs-notice">{message}</p> : null}
      <button className="eggs-button" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create EGGS account" : mode === "email-link" ? "Send sign-in link" : "Sign in"}</button>
      {mode !== "register" ? <button type="button" className="eggs-text-link" disabled={busy} onClick={() => { setMode(mode === "email-link" ? "login" : "email-link"); setError(""); setMessage(""); }}>{mode === "email-link" ? "Use my password instead" : "Email me a sign-in link instead"}</button> : null}
    </form>
  </div>;
}
