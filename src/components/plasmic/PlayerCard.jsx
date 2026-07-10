"use client";

export default function PlayerCard({
  name = "Para-Poker",
  label = "Loose Aggressive",
  secondaryLabel = "Pressure Player",
  hands = 14,
  vpip = "78.6%",
  pfr = "50%",
}) {
  return (
    <div className="rounded-3xl border border-amber-300/20 bg-gradient-to-br from-zinc-900 to-stone-950 p-6 shadow-xl text-white max-w-sm">
      <div className="h-16 w-16 rounded-2xl bg-amber-400 text-zinc-950 grid place-items-center text-3xl font-black">
        {name?.[0]?.toUpperCase() || "P"}
      </div>

      <h2 className="text-3xl font-black mt-5">{name}</h2>

      <p className="text-amber-300 mt-1">
        {label} / {secondaryLabel}
      </p>

      <div className="grid grid-cols-3 gap-3 mt-6">
        <Stat label="Hands" value={hands} />
        <Stat label="VPIP" value={vpip} />
        <Stat label="PFR" value={pfr} />
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/5 p-3">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
        {label}
      </div>
      <div className="text-xl font-black mt-1">{value}</div>
    </div>
  );
}