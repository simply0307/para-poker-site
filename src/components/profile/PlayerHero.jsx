import StatTile from "./StatTile";

export default function PlayerHero({ player, stats, standing }) {
  const displayName = player.display_name || stats.player_name || "Unknown Player";
  const initial = displayName?.[0]?.toUpperCase() || "P";

  return (
    <section className="rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-zinc-900 via-stone-950 to-black p-8 shadow-2xl">
      <div className="grid grid-cols-1 lg:grid-cols-[140px_1fr] gap-8 items-center">
        <div className="h-32 w-32 rounded-3xl bg-amber-400 text-zinc-950 grid place-items-center text-6xl font-black">
          {initial}
        </div>

        <div>
          <p className="text-amber-400 uppercase tracking-[0.22em] text-xs font-black">
            Para Poker Player Profile
          </p>

          <h1 className="text-5xl md:text-6xl font-black mt-3">
            {displayName}
          </h1>

          <p className="text-amber-300 text-lg font-semibold mt-2">
            {stats.primary_label || "Developing Profile"} /{" "}
            {stats.secondary_label || "Unscouted"}
          </p>

          <p className="text-zinc-400 mt-5 max-w-3xl leading-7">
            {player.bio ||
              `${displayName} has played ${stats.hands} tracked hands this season with a ${stats.vpip_pct}% VPIP and ${stats.pfr_pct}% PFR.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <StatTile label="Rank" value={standing?.rank ? `#${standing.rank}` : "-"} />
        <StatTile label="Points" value={standing?.total_points ?? 0} />
        <StatTile label="Hands" value={stats.hands} />
        <StatTile label="Biggest Pot" value={stats.biggest_pot_won} />
      </div>
    </section>
  );
}
