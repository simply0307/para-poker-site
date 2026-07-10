import StatTile from "./StatTile";

export default function CoreHud({ stats }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
      <h2 className="text-2xl font-black mb-5">Core HUD</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatTile label="VPIP" value={`${stats.vpip_pct}%`} />
        <StatTile label="PFR" value={`${stats.pfr_pct}%`} />
        <StatTile label="3Bet" value={`${stats.three_bet_pct}%`} />
        <StatTile label="Agg Factor" value={stats.agg_factor} />
        <StatTile label="WTSD" value={`${stats.wtsd_pct}%`} />
        <StatTile label="W$SD" value={`${stats.wsd_pct}%`} />
        <StatTile label="WWSF" value={`${stats.wwsf_pct}%`} />
        <StatTile label="Hands Won" value={stats.hands_won} />
        <StatTile label="All-Ins" value={stats.all_ins} />
      </div>
    </section>
  );
}