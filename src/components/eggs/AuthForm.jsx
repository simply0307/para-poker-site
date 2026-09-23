"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { accountFetch } from "./accountFetch";

export function AuthForm({ confirmationFailed = false }) {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [error, setError] = useState(confirmationFailed ? "That confirmation link could not be completed. Open it in the browser where you registered, or try signing in if your email is already confirmed." : "");
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(""); setMessage(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await accountFetch("/api/eggs/auth", { method: "POST", body: { action: mode, email: form.get("email"), password: form.get("password") } });
      if (result.redirect) { router.replace(result.redirect); router.refresh(); }
      else setMessage(result.message);
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <div className="eggs-form-card">
    <div className="eggs-mode-buttons" aria-label="Account action">
      <button type="button" aria-pressed={mode === "login"} onClick={() => { setMode("login"); setError(""); setMessage(""); }}>Sign in</button>
      <button type="button" aria-pressed={mode === "register"} onClick={() => { setMode("register"); setError(""); setMessage(""); }}>Create account</button>
    </div>
    <form className="eggs-form" onSubmit={submit}>
      <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
      <label>Password<input name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? 8 : 1} maxLength={128} required /></label>
      {mode === "register" ? <p className="eggs-help">Use at least 8 characters. After confirming your email, you’ll choose a handle. A name and bio are optional.</p> : null}
      {error ? <p role="alert" className="eggs-error">{error}</p> : null}
      {message ? <p role="status" className="eggs-notice">{message}</p> : null}
      <button className="eggs-button" disabled={busy}>{busy ? "Please wait…" : mode === "register" ? "Create EGGS account" : "Sign in"}</button>
    </form>
  </div>;
}
