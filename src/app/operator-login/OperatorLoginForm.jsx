"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export function OperatorLoginForm({ supabaseUrl, supabasePublishableKey }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  function emailClient() {
    // Retain the PKCE verifier across tabs, without retaining access or refresh tokens.
    const storage = {
      getItem: key => key.endsWith("-code-verifier") ? localStorage.getItem(key) : null,
      setItem: (key,value) => { if(key.endsWith("-code-verifier")) localStorage.setItem(key,value); },
      removeItem: key => localStorage.removeItem(key),
    };
    return createClient(supabaseUrl,supabasePublishableKey,{auth:{flowType:"pkce",storageKey:"para-operator-link",storage,autoRefreshToken:false,detectSessionInUrl:false}});
  }
  async function enter(token) {
    const response = await fetch("/api/operator-session",{method:"POST",headers:{Authorization:"Bearer "+token}});
    if (!response.ok) throw new Error(response.status===403 ? "This account is not an authorized league operator." : "Your operator session could not be established. Sign in again.");
    const current=new URLSearchParams(window.location.search);
    const desk=new URL("/admin/newsroom",window.location.origin);
    const division=current.get("division"), view=current.get("view");
    if(["suitfire","poker"].includes(division)) desk.searchParams.set("division",division);
    if(view==="imports") desk.pathname="/admin/imports";
    else if(division==="suitfire") {
      desk.pathname="/admin/suitfire"; desk.searchParams.delete("division");
      if(["reports","records"].includes(view)) desk.searchParams.set("view",view);
    }
    if (/^[a-zA-Z0-9-]{1,100}$/.test(current.get("match")||"")) desk.searchParams.set("match",current.get("match"));
    router.replace(desk.pathname+desk.search); router.refresh();
  }
  useEffect(() => {
    const url=new URL(location.href), code=url.searchParams.get("code");
    if(!code) return;
    url.searchParams.delete("code"); history.replaceState(null,"",url.pathname+url.search);
    setPending(true);
    emailClient().auth.exchangeCodeForSession(code).then(({data,error})=>{
      if(error || !data?.session) throw new Error("This link expired or was opened in a different browser. Request another link in this browser.");
      return enter(data.session.access_token);
    }).catch(e=>{setError(e.message);setPending(false);});
    // Handle the one-time return code only on entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  async function sendLink() {
    if(!email.trim()) {setError("Enter your operator email first.");return;}
    setPending(true);setError("");setNotice("");
    try {
      const {error}=await emailClient().auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:false,emailRedirectTo:location.origin+"/operator-login"+location.search}});
      if(error) throw error;
      setNotice("Check your operator email and open the link in this browser.");
    } catch(e) {setError(e.message);} finally {setPending(false);}
  }

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

      await enter(data.session.access_token);
    } catch (signInFailure) {
      setError(signInFailure?.message || "Sign-in failed.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={signIn} className="mt-8 space-y-5">
      <label className="block">
        <span className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Email</span>
        <input name="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required className="mt-2 w-full rounded border border-zinc-300 px-4 py-3 text-zinc-950" />
      </label>
      <label className="block">
        <span className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className="mt-2 w-full rounded border border-zinc-300 px-4 py-3 text-zinc-950" />
      </label>
      {notice && <p role="status">{notice}</p>}
      {error ? <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p> : null}
      <button disabled={pending} className="w-full rounded bg-zinc-950 px-4 py-3 font-black uppercase tracking-[0.14em] text-white disabled:opacity-60">
        {pending ? "Verifying…" : "Sign in as operator"}
      </button>
      <button type="button" disabled={pending} className="w-full underline" onClick={sendLink}>Email me a sign-in link</button>
    </form>
  );
}
