"use client";
import {useRouter} from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { candidateFromMatch, matchesFilters } from "@/lib/league/candidates.mjs";

export default function AssignmentDesk({ queueOnly = false, sessions = [], reports = [], operator = false, division = "SuitFire" }) {
  const router=useRouter();
  const [saved,setSaved] = useState([]);
  const poker=division==="Poker";
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
      setSaved(rows);
      const wanted=new URLSearchParams(location.search).get("match");
      const carried=operator && !poker && rows.find(row=>row.id===wanted);
      if(carried){setSelected(carried);setDraft(sessionStorage.getItem("para.draft."+carried.id)||"");}
      if (incoming && !poker) { setSelected(incoming); sessionStorage.setItem("para.editorial.candidates",JSON.stringify(rows)); history.replaceState(null,"",location.pathname+location.search); }
    } catch { setError("This match summary could not be opened."); }
  },[operator,poker]);
  const [report,setReport]=useState(null), [reportReady,setReportReady]=useState(false), [notice,setNotice]=useState("");
  const matchId=selected?.id;
  useEffect(()=>{
    let live=true;
    setReport(null);setReportReady(false);setNotice("");
    if(!operator || poker || !matchId) return;
    fetch("/api/admin/newsroom/reports?match="+encodeURIComponent(matchId),{cache:"no-store"}).then(async r=>{
      if(!r.ok) throw new Error("Could not load the league copy of this draft.");
      const {report}=await r.json();if(!live) return;
      setReport(report);setReportReady(true);if(report) setDraft(report.headline+"\n\n"+report.prose);
    }).catch(e=>{if(live)setError(e.message);});
    return ()=>{live=false;};
  },[matchId,operator,poker]);
  async function saveReport(action) {
    if(action==="publish" && !window.confirm("Publish this edited story on the public SuitFire desk?")) return;
    setBusy(true);setError("");setNotice("");
    try {
      const response=await fetch("/api/admin/newsroom/reports",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({match:matchId,action,text:draft,version:report?.version||0})});
      const data=await response.json();if(!response.ok) throw new Error(data.error||"Could not save.");
      setReport(data.report);router.refresh();setNotice(action==="publish"?"Published on the SuitFire desk.":action==="withdraw"?"Withdrawn from public coverage.":"Draft saved for both operators.");
    } catch(e){setError(e.message);} finally{setBusy(false);}
  }
  async function addFiles(event) {
    const input = event.target, files = Array.from(input.files), additions = [], failures = [];
    for (const file of files) {
      try { additions.push(candidateFromMatch(JSON.parse(await file.text()))); } catch { failures.push(file.name); }
    }
    const merged = [...new Map([...saved,...additions].map(r=>[r.id,r])).values()];
    setSaved(merged); input.value = ""; setError(failures.length ? "Could not read: "+failures.join(", ") : "");
    try { sessionStorage.setItem("para.editorial.candidates", JSON.stringify(merged)); } catch { setError("Tab storage is full. These selections are available until reload."); }
  }
  const rows = [...sessions,...saved].filter(row=>matchesFilters(row,division,finished,long) && (opponents==="All opponents" || row.opposition===opponents));
  const prior = selected?.game==="SuitFire" ? saved.filter(row =>
    row.id!==selected.id && Date.parse(row.date)<Date.parse(selected.date) &&
    row.players?.some(player=>player.name!=="Unknown Vanguard" && selected.players?.some(other=>other.name===player.name))
  ).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,3) : [];
  const winner=selected?.players?.find(p=>p.result==="win");
  const angles=selected && !poker ? [
    prior.length && "Compare this finish with the earlier meeting. Track which player won each game and how the factions changed.",
    winner && "Explain how "+winner.name+" secured the recorded result in "+(selected.turns || "the recorded")+" turns. Use final life and flag gaps in the combat record.",
    selected.players?.some(p=>p.faction) && "Report the faction matchup, each side's final life, and the last turn supported by the record.",
    "Write a short results column for readers following this season."
  ].filter(Boolean) : [];
  const brief=angle.trim() || angles[0] || "Report the session result and its decisive hands.";
  const prompt = selected ? ["Write a Reath sports desk assignment about "+selected.title+".",brief, "Use only the recorded details below. Attribute uncertainty and distinguish a saved game from an official league result.", JSON.stringify({selected,earlierSavedGames:prior},null,2)].filter(Boolean).join("\n\n") : "";
  async function generate() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/admin/newsroom/assignment",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({candidate:selected,angle:brief,history:prior})});
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "Generation failed.");
      const prose=[data.headline,data.subheadline,data.recap_body].filter(Boolean).join("\n\n");
      setDraft(prose);try { sessionStorage.setItem("para.draft."+selected.id,prose); } catch { /* The draft remains in the editor. */ }
    } catch(e) { setError(e.message); } finally {setBusy(false);}
  }
  return <section className="my-6 space-y-5 rounded border border-stone-400/50 p-5">
    {!queueOnly && <>
    <h2 className="text-2xl font-bold">{poker?"Choose a Poker session":"Choose a SuitFire match"}</h2>
    {!poker && <>
    <div className="flex flex-wrap gap-5"><a className="underline" href="https://gauntlet-online.vercel.app/?page=matches">Browse my SuitFire matches</a>
    <label className="cursor-pointer underline">Open saved match files <input className="block max-w-full text-sm" type="file" accept=".json,application/json" multiple onChange={addFiles}/></label></div></>}
    <fieldset className="flex flex-wrap items-center gap-5"><legend className="mb-2 font-bold">Filter candidates</legend>
      {!poker && <label>Opponents <select className="bg-white text-black" value={opponents} onChange={e=>setOpponents(e.target.value)}>{["All opponents","Human opponents","AI opponent"].map(v=><option key={v}>{v}</option>)}</select></label>}
      <label><input type="checkbox" checked={finished} onChange={e=>setFinished(e.target.checked)}/> Finished game</label>
      <label><input type="checkbox" checked={long} onChange={e=>setLong(e.target.checked)}/> Over 1 minute long</label>
    </fieldset>
    <p aria-live="polite">{rows.length} candidate{rows.length===1?"":"s"}</p>
    <ul className="divide-y divide-stone-400/30">{rows.map(row=><li key={row.game+row.id} className="flex flex-wrap items-center gap-4 py-3">
      {operator && row.sessionId ? <Link className="font-bold underline" href={poker?"/admin/sessions/"+encodeURIComponent(row.sessionId):"/suitfire/match?sessionId="+encodeURIComponent(row.sessionId)}>{row.title} · {poker?"Open recap editor":"View duel record"}</Link> : <button disabled={busy} className="text-left font-bold underline" onClick={()=>{setSelected(row);setAngle("");setDraft(operator ? sessionStorage.getItem("para.draft."+row.id)||"" : "");}}>{row.title}</button>}
      <small>{row.date && new Date(row.date).toLocaleString()+" · "}{row.players?.map(p=>p.faction).filter(Boolean).join(" vs. ")} {row.season || ""} · {row.finished ? "Finished" : "Finish unconfirmed"} · {row.durationMs == null ? "Duration unknown" : Math.floor(row.durationMs/1000)+"s"+(row.minimumDuration?" or longer":"")}</small>
    </li>)}</ul>
    </>}
    {queueOnly && !reports.length && <p>No SuitFire reports yet. Save a working draft from Duel intake to start the queue.</p>}
    {operator && !poker && queueOnly && reports.length>0 && <details open><summary className="cursor-pointer font-bold">Shared SuitFire reports</summary>
      <ul>{reports.map(r=><li key={r.match_id}><button className="underline" disabled={busy} onClick={()=>{
        if(matchId===r.match_id) return;
        setDraft(""); setSelected(saved.find(row=>row.id===r.match_id) || {id:r.match_id,title:r.headline,existingReport:true,game:"SuitFire"});
      }}>{r.headline}</button> · {r.published_at?"Published":"Private draft"}</li>)}</ul></details>}
    {selected && <div className="space-y-3"><h3 className="text-xl font-bold">Assignment · {selected.title}</h3>
      {winner && <p><b>{winner.name} won.</b> {selected.players.map(p=>p.name+" ("+(p.faction||"unknown faction")+", "+(p.life??"unknown")+" final life)").join(" vs. ")}{selected.turns ? " · "+selected.turns+" turns" : ""}{prior.length ? " · "+prior.length+" earlier meeting(s) available for context." : ""}</p>}
      <details><summary className="cursor-pointer underline">Customize the suggested angle</summary><div className="my-2 flex flex-wrap gap-2">{angles.map(option=><button type="button" key={option} className="rounded border p-2 text-left text-sm" onClick={()=>setAngle(option)}>{option}</button>)}</div><label className="block">Story angle<input className="block w-full rounded border bg-white p-2 text-black" value={angle} maxLength={1000} onChange={e=>setAngle(e.target.value)} placeholder={brief}/></label></details>
      <details><summary className="cursor-pointer underline">Review evidence and reporting prompt</summary><label className="block">Reporting prompt<textarea readOnly className="block w-full rounded border bg-white p-3 text-black" rows={7} value={prompt}/></label></details>
      {operator && selected.sessionId ? <Link className="underline" href={"/admin/sessions/"+encodeURIComponent(selected.sessionId)}>Open session evidence and recap editor</Link> : operator ? !selected.existingReport && <button disabled={busy || (!poker && !reportReady)} className="rounded bg-slate-900 px-4 py-2 text-white" onClick={generate}>{busy?"Drafting…":"Generate Reath draft"}</button> : <Link className="underline" href={"/admin/newsroom?division=suitfire&match="+encodeURIComponent(selected.id)}>Continue with this match in the operator desk</Link>}
      {operator && draft && <label className="block">Working draft<textarea disabled={busy || (!poker && !reportReady)} rows={10} className="block w-full rounded border bg-white p-3 text-black" value={draft} onChange={e=>{setDraft(e.target.value);try {sessionStorage.setItem("para.draft."+selected.id,e.target.value);} catch { /* Editor retains current text. */ }}}/></label>}
      {operator && !poker && draft && <div className="flex flex-wrap gap-4"><button disabled={busy||!reportReady} onClick={()=>saveReport("save")} className="underline">Save league draft</button><button disabled={busy||!reportReady} onClick={()=>saveReport("publish")} className="underline">{report?.published_at?"Update published story":"Publish reviewed story"}</button>{report?.published_at && <button disabled={busy||!reportReady} onClick={()=>saveReport("withdraw")} className="underline">Withdraw story</button>}</div>}
      {notice && <p role="status">{notice}</p>}
    </div>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
