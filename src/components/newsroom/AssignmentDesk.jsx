"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { candidateFromMatch, matchesFilters } from "@/lib/league/candidates.mjs";

export default function AssignmentDesk({ sessions = [], operator = false }) {
  const [saved,setSaved] = useState([]), [game,setGame] = useState("All");
  const [opponents,setOpponents] = useState("All opponents");
  const [finished,setFinished] = useState(false), [long,setLong] = useState(false);
  const [error,setError] = useState(""), [selected,setSelected] = useState(null), [angle,setAngle] = useState("");
  const [draft,setDraft] = useState(""), [busy,setBusy] = useState(false);
  useEffect(() => {
    try {
      const prior = JSON.parse(sessionStorage.getItem("para.editorial.candidates") || "[]");
      const encoded = new URLSearchParams(location.hash.slice(1)).get("match");
      const incoming = encoded ? candidateFromMatch(JSON.parse(encoded)) : null;
      const rows = incoming ? [incoming,...prior.filter(r=>r.id !== incoming.id)] : prior;
      setSaved(rows); if (incoming) { setSelected(incoming); sessionStorage.setItem("para.editorial.candidates",JSON.stringify(rows)); history.replaceState(null,"",location.pathname); }
    } catch { setError("This match summary could not be opened."); }
  },[]);
  async function addFiles(event) {
    const input = event.target, files = Array.from(input.files), additions = [], failures = [];
    for (const file of files) {
      try { additions.push(candidateFromMatch(JSON.parse(await file.text()))); } catch { failures.push(file.name); }
    }
    const merged = [...new Map([...saved,...additions].map(r=>[r.id,r])).values()];
    setSaved(merged); input.value = ""; setError(failures.length ? "Could not read: "+failures.join(", ") : "");
    try { sessionStorage.setItem("para.editorial.candidates", JSON.stringify(merged)); } catch { setError("Tab storage is full. These selections are available until reload."); }
  }
  const rows = [...sessions,...saved].filter(row=>matchesFilters(row,game,finished,long) && (opponents==="All opponents" || row.opposition===opponents));
  const prior = selected?.game==="SuitFire" ? saved.filter(row =>
    row.id!==selected.id && Date.parse(row.date)<Date.parse(selected.date) &&
    row.players?.some(player=>player.name!=="Unknown Vanguard" && selected.players?.some(other=>other.name===player.name))
  ).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,3) : [];
  const prompt = selected ? ["Write a Reath sports desk assignment about "+selected.title+".",angle.trim(), "Use only the recorded details below. Attribute uncertainty and distinguish a saved game from an official league result.", JSON.stringify({selected,earlierSavedGames:prior},null,2)].filter(Boolean).join("\n\n") : "";
  async function generate() {
    setBusy(true); setError(""); setDraft("");
    try {
      const res = await fetch("/api/admin/newsroom/assignment",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({candidate:selected,angle,history:prior})});
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "Generation failed.");
      const prose=[data.headline,data.subheadline,data.recap_body].filter(Boolean).join("\n\n");
      setDraft(prose);try { sessionStorage.setItem("para.draft."+selected.id,prose); } catch { /* The draft remains in the editor. */ }
    } catch(e) { setError(e.message); } finally {setBusy(false);}
  }
  return <section className="my-6 space-y-5 rounded border border-stone-400/50 p-5">
    <h2 className="text-2xl font-bold">Assignment desk</h2>
    <p>Choose a saved game to build a reporting prompt. Device saves stay in the browser where you played.</p>
    <div className="flex flex-wrap gap-5"><a className="underline" href="https://gauntlet-online.vercel.app/?page=matches">Browse my SuitFire matches</a>
    <label className="cursor-pointer underline">Open saved match files <input className="block max-w-full text-sm" type="file" accept=".json,application/json" multiple onChange={addFiles}/></label></div>
    <fieldset className="flex flex-wrap items-center gap-5"><legend className="mb-2 font-bold">Filter candidates</legend>
      <label>Game <select className="bg-white text-black" value={game} onChange={e=>setGame(e.target.value)}>{["All","SuitFire","Poker"].map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Opponents <select className="bg-white text-black" value={opponents} onChange={e=>setOpponents(e.target.value)}>{["All opponents","Human opponents","AI opponent"].map(v=><option key={v}>{v}</option>)}</select></label>
      <label><input type="checkbox" checked={finished} onChange={e=>setFinished(e.target.checked)}/> Finished game</label>
      <label><input type="checkbox" checked={long} onChange={e=>setLong(e.target.checked)}/> Over 1 minute long</label>
    </fieldset>
    <p aria-live="polite">{rows.length} candidate{rows.length===1?"":"s"}</p>
    <ul className="divide-y divide-stone-400/30">{rows.map(row=><li key={row.game+row.id} className="flex flex-wrap items-center gap-4 py-3">
      <button disabled={busy} className="text-left font-bold underline" onClick={()=>{setSelected(row);setAngle("");setDraft(sessionStorage.getItem("para.draft."+row.id)||"");}}>{row.title}</button>
      <small>{row.game} · {row.finished ? "Finished" : "Finish unconfirmed"} · {row.durationMs == null ? "Duration unknown" : Math.floor(row.durationMs/1000)+"s"+(row.minimumDuration?" or longer":"")}</small>
    </li>)}</ul>
    {selected && <div className="space-y-3"><h3 className="text-xl font-bold">Assignment · {selected.title}</h3>
      <label className="block">Story angle<input className="block w-full rounded border bg-white p-2 text-black" value={angle} maxLength={1000} onChange={e=>setAngle(e.target.value)} placeholder="What decided this game?"/></label>
      <label className="block">Reporting prompt<textarea readOnly className="block w-full rounded border bg-white p-3 text-black" rows={7} value={prompt}/></label>
      {operator && selected.sessionId ? <Link className="underline" href={"/admin/sessions/"+encodeURIComponent(selected.sessionId)}>Open session evidence and recap editor</Link> : operator ? <button disabled={busy} className="rounded bg-slate-900 px-4 py-2 text-white" onClick={generate}>{busy?"Drafting…":"Generate Reath draft"}</button> : <Link className="underline" href="/admin/newsroom">Sign in for AI drafting and league sessions</Link>}
      {draft && <label className="block">Working draft<textarea rows={10} className="block w-full rounded border bg-white p-3 text-black" value={draft} onChange={e=>{setDraft(e.target.value);try {sessionStorage.setItem("para.draft."+selected.id,e.target.value);} catch { /* Editor retains current text. */ }}}/></label>}
    </div>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
