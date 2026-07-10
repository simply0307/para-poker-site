export function PokerStatGrid({ stats = [] }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border border-white/10 bg-stone-950/55 p-4">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-stone-400">{stat.label}</p>
          <strong className="mt-2 block text-2xl text-white">{stat.value || stat.empty || "-"}</strong>
          {stat.detail ? <p className="mt-2 text-xs leading-5 text-stone-500">{stat.detail}</p> : null}
        </div>
      ))}
    </section>
  );
}
