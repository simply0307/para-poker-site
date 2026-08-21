import { DataTableShell, LeagueHero, NewsroomShell, PublishedArticle, StatCard, StatStrip } from "@/components/newsroom/NewsroomShell";
import { cleanName, formatNumber, getPublishedDraft, getStandingsRows, text } from "@/lib/newsroom/data";
import { getPageHero } from "@/lib/newsroom/pageHeroSettings";
import { draftHeadline, draftHtml, draftParagraphs, draftSubheadline, waitingCopy } from "@/lib/newsroom/rendering";
import { readSeasonSettings } from "@/lib/newsroom/seasonSettings";
import { readPlayerSeasonStats } from "@/lib/stats/statRepository";

export const revalidate = 60;

export default async function StandingsPage() {
  const seasonSettings = await readSeasonSettings();
  const [published, standingsRows, seasonStats, hero] = await Promise.all([
    getPublishedDraft({ scope: "season", seasonCode: seasonSettings.activeSeasonCode }),
    getStandingsRows(seasonSettings.activeSeasonCode),
    readPlayerSeasonStats(seasonSettings.activeSeasonCode),
    getPageHero("standings"),
  ]);
  const seasonStatsByPlayer = new Map((seasonStats || []).map((row) => [String(row.player_id || row.player_name), row]));
  const standings = (standingsRows || []).map((row) => ({
    ...seasonStatsByPlayer.get(String(row.player_id || row.player_name)),
    ...row,
  }));
  const leader = standings[0] || {};

  return (
    <NewsroomShell eyebrow="Standings Summary">
      <LeagueHero
        eyebrow={hero.eyebrow}
        title={hero.title}
        dek={hero.dek}
        aside={
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">Current leader</p>
            <p className="mt-2 text-2xl font-black text-white">{cleanName(leader.player_name || leader.display_name, "Pending")}</p>
          </div>
        }
      />
      <StatStrip>
        <StatCard label="Season" value={seasonSettings.activeSeasonCode} detail={seasonSettings.seasonStatus.replace(/_/g, " ")} />
        <StatCard label="Players ranked" value={standings.length} />
        <StatCard label="Top points" value={text(leader.points || leader.league_points || leader.total_points, "-")} />
      </StatStrip>
      <div className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#d8c087]/20 bg-[#061019]/82 px-4 py-3">
          <div>
            <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-[#d8c087]">Verified league record</p>
            <p className="mt-1 text-sm text-stone-400">The board advances only through approved session results.</p>
          </div>
          <span className="flex items-center gap-2 rounded-sm border border-[#d8c087]/30 bg-[#d8c087]/10 px-3 py-2 text-[0.62rem] font-black uppercase tracking-[0.16em] text-[#fff1bf]">
            <i className="h-1.5 w-1.5 rounded-full bg-[#d8c087] shadow-[0_0_12px_rgba(216,192,135,0.8)]" /> Current board
          </span>
        </div>
        <DataTableShell
          title="Live Standings"
          columns={["Rank", "Player", "Points", "Sessions", "Best", "Big Pot"]}
          rows={standings}
          empty="No standings rows are available yet."
          renderRow={(row, index) => (
            <tr key={`${row.player_id || row.player_name || "standing"}-${index}`} className="border-b border-white/10">
              <td className="para-data border-b border-white/10 px-3 py-3 text-lg font-black text-amber-200">{text(row.rank || row.current_rank, "-")}</td>
              <td className="border-b border-white/10 px-3 py-3 text-white">{cleanName(row.player_name || row.display_name, "Player")}</td>
              <td className="para-data border-b border-white/10 px-3 py-3 text-stone-300">{formatNumber(row.points || row.league_points || row.total_points, "-")}</td>
              <td className="para-data border-b border-white/10 px-3 py-3 text-stone-300">{formatNumber(row.sessions_played, "-")}</td>
              <td className="para-data border-b border-white/10 px-3 py-3 text-stone-300">{row.best_finish ? `#${row.best_finish}` : "-"}</td>
              <td className="para-data border-b border-white/10 px-3 py-3 text-stone-300">{formatNumber(row.biggest_pot_won, "-")}</td>
            </tr>
          )}
        />
      </div>
      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <PublishedArticle
          compact
          title={draftHeadline(published, "Current board")}
          subheadline={draftSubheadline(published)}
          paragraphs={draftParagraphs(published)}
          html={draftHtml(published)}
          placeholder={waitingCopy}
        />
        <div className="rounded-xl border border-white/10 bg-white/[0.045] p-5">
          <h2 className="text-2xl font-black text-white">What To Watch</h2>
          <p className="mt-3 leading-7 text-stone-300">The next session can change the read.</p>
        </div>
      </section>
    </NewsroomShell>
  );
}
