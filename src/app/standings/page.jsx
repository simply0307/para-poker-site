import { DataTableShell, LeagueHero, NewsroomShell, PublishedArticle, StatCard, StatStrip } from "@/components/newsroom/NewsroomShell";
import { formatNumber, getPublishedDraft, getStandingsRows, text } from "@/lib/newsroom/data";
import { draftHeadline, draftParagraphs, draftSubheadline, waitingCopy } from "@/lib/newsroom/rendering";

export const revalidate = 60;

export default async function StandingsPage() {
  const [published, standings] = await Promise.all([getPublishedDraft({ scope: "season" }), getStandingsRows("S0")]);
  const leader = standings[0] || {};

  return (
    <NewsroomShell eyebrow="Standings Summary">
      <LeagueHero
        eyebrow="Season 0"
        title="Current Board"
        dek="The table has started to take shape."
        aside={
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">Current leader</p>
            <p className="mt-2 text-2xl font-black text-white">{text(leader.player_name || leader.display_name, "Pending")}</p>
          </div>
        }
      />
      <StatStrip>
        <StatCard label="Players ranked" value={standings.length} />
        <StatCard label="Top points" value={text(leader.points || leader.league_points || leader.total_points, "-")} />
      </StatStrip>
      <div className="mt-8">
        <DataTableShell
          title="Standings Table"
          columns={["Rank", "Player", "Points"]}
          rows={standings}
          empty="No standings rows are available yet."
          renderRow={(row, index) => (
            <tr key={`${row.player_id || row.player_name || "standing"}-${index}`} className="border-b border-white/10">
              <td className="border-b border-white/10 px-3 py-3 font-black text-amber-200">{text(row.rank || row.current_rank, "-")}</td>
              <td className="border-b border-white/10 px-3 py-3 text-white">{text(row.player_name || row.display_name, "Player")}</td>
              <td className="border-b border-white/10 px-3 py-3 text-stone-300">{formatNumber(row.points || row.league_points || row.total_points, "-")}</td>
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
