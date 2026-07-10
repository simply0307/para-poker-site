export default function PositionGrid({ stats }) {
  const rows = [
    ["BTN", stats.btn_vpip, stats.btn_pfr],
    ["CO", stats.co_vpip, stats.co_pfr],
    ["HJ", stats.hj_vpip, stats.hj_pfr],
    ["LJ", stats.lj_vpip, stats.lj_pfr],
    ["UTG", stats.utg_vpip, stats.utg_pfr],
    ["SB", stats.sb_vpip, stats.sb_pfr],
    ["BB", stats.bb_vpip, stats.bb_pfr],
  ];

  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
      <h2 className="text-2xl font-black mb-5">Position Snapshot</h2>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-left">
          <thead className="bg-white/5 text-zinc-500 uppercase text-xs tracking-widest">
            <tr>
              <th className="p-3">Position</th>
              <th className="p-3">VPIP</th>
              <th className="p-3">PFR</th>
            </tr>
          </thead>

          <tbody>
            {rows.map(([position, vpip, pfr]) => (
              <tr key={position} className="border-t border-white/10">
                <td className="p-3 font-bold text-white">{position}</td>
                <td className="p-3 text-zinc-300">{vpip}%</td>
                <td className="p-3 text-zinc-300">{pfr}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}