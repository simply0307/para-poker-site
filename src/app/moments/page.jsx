import { CardGrid, LeagueHero, MomentCard, NewsroomShell, PublishedArticle, StatCard, StatStrip } from "@/components/newsroom/NewsroomShell";
import { cleanName, formatNumber, getMomentsIndex, getPublishedDraft, text } from "@/lib/newsroom/data";
import { draftHeadline, draftParagraphs, draftSubheadline, waitingCopy } from "@/lib/newsroom/rendering";

export const revalidate = 60;

export default async function MomentsPage() {
  const [published, moments] = await Promise.all([getPublishedDraft({ scope: "moment" }), getMomentsIndex()]);
  const biggest = [...moments].sort((left, right) => Number(right.pot_collected || 0) - Number(left.pot_collected || 0))[0] || {};

  return (
    <NewsroomShell eyebrow="Moment Blurbs">
      <LeagueHero eyebrow="Table moments" title="Table Moments" dek="Big pots, turning points, and hand markers." />
      <StatStrip>
        <StatCard label="Moments indexed" value={moments.length} />
        <StatCard label="Biggest listed pot" value={biggest.pot_collected ? `${formatNumber(biggest.pot_collected)} chips` : "-"} />
      </StatStrip>
      <CardGrid>
        {moments.length ? moments.map((moment, index) => (
          <MomentCard
            key={`${moment.id || moment.hand_no || "moment"}-${index}`}
            title={moment.hand_no ? `Hand #${moment.hand_no}` : "Archived moment"}
            meta={cleanName(moment.winner_name, "Winner pending")}
            pot={moment.pot_collected ? `${formatNumber(moment.pot_collected)} chips` : ""}
          >
            <p>{text(moment.summary || moment.winning_hand || moment.board || "Moments pending.")}</p>
          </MomentCard>
        )) : null}
      </CardGrid>
      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <PublishedArticle
          compact
          title={draftHeadline(published, "Moment wire")}
          subheadline={draftSubheadline(published)}
          paragraphs={draftParagraphs(published)}
          placeholder={waitingCopy}
        />
        <div className="rounded-xl border border-white/10 bg-white/[0.045] p-5">
          <h2 className="text-2xl font-black text-white">Big Pots</h2>
          <p className="mt-3 leading-7 text-stone-300">
            Moments pending.
          </p>
        </div>
      </section>
    </NewsroomShell>
  );
}
