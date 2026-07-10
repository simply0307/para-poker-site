import Link from "next/link";
import { CardGrid, LeagueHero, MomentCard, NewsroomShell, PlayerCard, SessionCard, StatCard, StatStrip } from "@/components/newsroom/NewsroomShell";
import {
  cleanName,
  formatDate,
  formatNumber,
  getMomentsIndex,
  getPlayersIndex,
  getSessionNewsroomData,
  getSessionsIndex,
  getStandingsRows,
  text,
} from "@/lib/newsroom/data";

export const revalidate = 60;

export default async function Home() {
  const [sessions, standings, moments, players] = await Promise.all([
    getSessionsIndex(),
    getStandingsRows("S0"),
    getMomentsIndex(),
    getPlayersIndex(),
  ]);
  const latest = sessions[0] || null;
  const latestData = latest ? await getSessionNewsroomData(latest.session_code || latest.id) : null;
  const winner = latestData?.sessionResults?.[0] || null;
  const biggestPot = [...(latestData?.hands || []), ...(latestData?.notableHands || [])]
    .filter((hand) => hand?.pot_collected)
    .sort((left, right) => Number(right.pot_collected || 0) - Number(left.pot_collected || 0))[0];

  return (
    <NewsroomShell>
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
      <StatStrip>
        <StatCard label="Sessions" value={sessions.length} />
        <StatCard label="Players" value={players.length} />
        <StatCard label="Moments" value={moments.length} />
        <StatCard label="Leader" value={text(standings[0]?.player_name, "Pending")} />
      </StatStrip>

      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-xl border border-white/10 bg-white/[0.045] p-5">
          <h2 className="text-2xl font-black text-white">Current Board</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <tbody>
                {standings.slice(0, 5).map((row) => (
                  <tr key={row.id || row.player_id || row.player_name} className="border-b border-white/10 last:border-0">
                    <td className="py-3 pr-3 font-black text-amber-200">{text(row.rank, "-")}</td>
                    <td className="py-3 pr-3 text-white">{text(row.player_name, "Player")}</td>
                    <td className="py-3 text-right text-stone-300">{formatNumber(row.total_points || row.points || row.league_points, "-")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link href="/standings" className="mt-4 inline-block font-bold text-amber-200 hover:text-amber-100">
            Full standings
          </Link>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.045] p-5">
          <h2 className="text-2xl font-black text-white">Featured Players</h2>
          <div className="mt-4 grid gap-3">
            {players.slice(0, 3).map((player) => {
              const standing = standings.find((row) => String(row.player_id) === String(player.id)) || {};
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
        </div>
      </section>

      <CardGrid>
        {moments.slice(0, 3).map((moment) => (
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
    </NewsroomShell>
  );
}
