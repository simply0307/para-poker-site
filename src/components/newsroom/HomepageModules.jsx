import Link from "next/link";
import { CardGrid, LeagueHero, MomentCard, PlayerCard, SessionCard, StatCard, StatStrip } from "@/components/newsroom/NewsroomShell";
import { cleanName, formatNumber, text } from "@/lib/newsroom/data";

export function HomepageModuleRenderer({ viewModel }) {
  return (
    <>
      {viewModel.modules.map((module, index) => (
        <HomeModule key={`${module.type}-${index}`} module={module} viewModel={viewModel} />
      ))}
    </>
  );
}

function HomeModule({ module, viewModel }) {
  if (module.type === "hero_board") return <HeroBoard viewModel={viewModel} />;
  if (module.type === "stat_strip") return <HomeStatStrip viewModel={viewModel} />;
  if (module.type === "latest_session") return <LatestSessionModule viewModel={viewModel} />;
  if (module.type === "current_standings") return <CurrentStandingsModule viewModel={viewModel} />;
  if (module.type === "featured_players") return <FeaturedPlayersModule viewModel={viewModel} />;
  if (module.type === "featured_moments") return <FeaturedMomentsModule viewModel={viewModel} />;
  if (module.type === "latest_articles") return <LatestArticlesModule viewModel={viewModel} />;
  return null;
}

function HeroBoard({ viewModel }) {
  const { latest, winner, biggestPot } = viewModel;

  return (
    <LeagueHero
      eyebrow="Season 0 / Preseason / Current Board"
      title="Para League"
      dek="The first sessions are setting the board."
      aside={
        latest ? (
          <SessionCard
            href={`/sessions/${encodeURIComponent(text(latest.session_code || latest.id))}`}
            title={text(latest.session_code, "Latest Session")}
            meta="Latest session"
          >
            <p>{winner ? `${cleanName(winner.player_name)} finished #${winner.finish || 1}.` : "Result pending."}</p>
            <p>{latest.hands_count ? `${latest.hands_count} hands` : "Hands pending"}</p>
            <p>{biggestPot?.pot_collected ? `${formatNumber(biggestPot.pot_collected)} biggest pot` : "Biggest pot pending"}</p>
          </SessionCard>
        ) : (
          <p className="leading-7 text-stone-300">No verified sessions yet.</p>
        )
      }
    />
  );
}

function HomeStatStrip({ viewModel }) {
  return (
    <StatStrip>
      <StatCard label="Sessions" value={viewModel.sessions.length} />
      <StatCard label="Players" value={viewModel.players.length} />
      <StatCard label="Moments" value={viewModel.moments.length} />
      <StatCard label="Leader" value={cleanName(viewModel.standings[0]?.player_name, "Pending")} />
    </StatStrip>
  );
}

function LatestSessionModule({ viewModel }) {
  const { latest, winner, biggestPot } = viewModel;
  if (!latest) return null;

  return (
    <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.045] p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Latest Session</p>
          <h2 className="mt-2 text-3xl font-black text-white">{text(latest.session_code, "Session")}</h2>
        </div>
        <Link href={`/sessions/${encodeURIComponent(text(latest.session_code || latest.id))}`} className="font-bold text-amber-200 hover:text-amber-100">
          Open recap
        </Link>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <MiniFact label="Winner" value={winner ? cleanName(winner.player_name) : "Pending"} />
        <MiniFact label="Hands" value={latest.hands_count || "Pending"} />
        <MiniFact label="Biggest pot" value={biggestPot?.pot_collected ? `${formatNumber(biggestPot.pot_collected)} chips` : "Pending"} />
      </div>
    </section>
  );
}

function CurrentStandingsModule({ viewModel }) {
  return (
    <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.045] p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-2xl font-black text-white">Current Board</h2>
        <Link href="/standings" className="font-bold text-amber-200 hover:text-amber-100">Full standings</Link>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <tbody>
            {viewModel.standings.slice(0, 5).map((row) => (
              <tr key={row.id || row.player_id || row.player_name} className="border-b border-white/10 last:border-0">
                <td className="py-3 pr-3 font-black text-amber-200">{text(row.rank, "-")}</td>
                <td className="py-3 pr-3 text-white">{cleanName(row.player_name, "Player")}</td>
                <td className="py-3 text-right text-stone-300">{formatNumber(row.total_points || row.points || row.league_points, "-")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FeaturedPlayersModule({ viewModel }) {
  return (
    <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.045] p-5">
      <h2 className="text-2xl font-black text-white">Featured Players</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {viewModel.players.slice(0, 3).map((player) => {
          const standing = viewModel.standings.find((row) => String(row.player_id) === String(player.id)) || {};
          return (
            <PlayerCard
              key={player.id}
              href={`/players/${encodeURIComponent(text(player.slug || player.id))}`}
              name={cleanName(player.display_name || player.pokernow_name)}
              meta={standing.rank ? `Rank ${standing.rank}` : "Player"}
            >
              <p>{standing.total_points ? `${standing.total_points} points` : "The board is still forming."}</p>
            </PlayerCard>
          );
        })}
      </div>
    </section>
  );
}

function FeaturedMomentsModule({ viewModel }) {
  return (
    <CardGrid>
      {viewModel.moments.slice(0, 3).map((moment) => (
        <MomentCard
          key={moment.id || moment.hand_no}
          title={moment.hand_no ? `Hand #${moment.hand_no}` : "Table moment"}
          meta={cleanName(moment.winner_name, "Winner pending")}
          pot={moment.pot_collected ? `${formatNumber(moment.pot_collected)} chips` : ""}
        >
          <p>{text(moment.summary || moment.winning_hand || moment.board, "Moments pending.")}</p>
        </MomentCard>
      ))}
    </CardGrid>
  );
}

function LatestArticlesModule({ viewModel }) {
  if (!viewModel.articles.length) return null;

  return (
    <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.045] p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-2xl font-black text-white">Latest Articles</h2>
        <Link href="/articles" className="font-bold text-amber-200 hover:text-amber-100">All articles</Link>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {viewModel.articles.slice(0, 3).map((article) => (
          <Link key={article.id || article.slug} href={`/articles/${encodeURIComponent(text(article.slug || article.id))}`} className="rounded-md border border-white/10 bg-black/25 p-4 hover:border-amber-300/50">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">League coverage</p>
            <h3 className="mt-2 text-xl font-black text-white">{article.title}</h3>
          </Link>
        ))}
      </div>
    </section>
  );
}

function MiniFact({ label, value }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/25 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-stone-400">{label}</p>
      <p className="mt-2 text-xl font-black text-white">{value}</p>
    </div>
  );
}
