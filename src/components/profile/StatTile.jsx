export default function StatTile({ label, value, subtext }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
        {label}
      </div>

      <div className="text-2xl font-black mt-1 text-white">
        {value ?? "-"}
      </div>

      {subtext ? (
        <div className="text-xs text-zinc-500 mt-1">{subtext}</div>
      ) : null}
    </div>
  );
}
