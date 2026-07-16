import Link from "next/link";
import {
  CardGrid,
  ContentRail,
  EvidencePanel,
  LeagueHero,
  MomentCard,
  NewsroomShell,
  SectionHeader,
  StatCard,
  StatStrip,
} from "@/components/newsroom/NewsroomShell";
import { cleanName, formatNumber, text } from "@/lib/newsroom/data";
import { getPageHero } from "@/lib/newsroom/pageHeroSettings";
import { buildMomentsViewModel } from "@/lib/newsroom/viewModels/moments";
import { stripPlayerHandlesFromText } from "@/lib/playerNames";
import { formatPotWithBb } from "@/lib/poker/potUnits";

export const revalidate = 60;

function potText(value, moment = {}) {
  return formatPotWithBb({ pot: value, potBb: moment.pot_bb, bigBlind: moment.big_blind }) || (value ? `${formatNumber(value)} chips` : "");
}

function StatusRow({ labels = [] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {labels.map((label) => (
        <span key={label} className="rounded-full border border-[#d8c087]/20 bg-[#d8c087]/10 px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#fff1bf]">
          {label}
        </span>
      ))}
    </div>
  );
}

function MomentArchiveCard({ moment, featured = false }) {
  return (
    <MomentCard
      href={moment.detailHref}
      title={moment.hand_no ? `Hand #${moment.hand_no}` : "Published moment"}
      meta={`${moment.typeLabel} / ${moment.sessionCode || "Session pending"}`}
      pot={moment.potText}
    >
      <StatusRow labels={moment.statusLabels} />
        {moment.video ? (
        <span className="mt-3 inline-block rounded-sm bg-amber-300 px-2 py-1 text-xs font-black uppercase tracking-[0.1em] text-[#061019]">
          Video attached
        </span>
      ) : null}
      <p className={featured ? "mt-4 text-base leading-7" : ""}>
        {stripPlayerHandlesFromText(text(moment.displaySummary, "Approved moment copy is attached to this archive entry."))}
      </p>
      <FactLine label="Winner" value={cleanName(moment.winner_name, "")} />
      <FactLine label="Board" value={moment.board} />
      <FactLine label="Winning hand" value={moment.winning_hand} />
      <div className="mt-4 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.1em]">
        {moment.sessionHref ? <Link href={moment.sessionHref} className="text-amber-200 hover:text-amber-100">Open session</Link> : null}
        {moment.playerHref ? <Link href={moment.playerHref} className="text-amber-200 hover:text-amber-100">Open player</Link> : null}
      </div>
    </MomentCard>
  );
}

export default async function MomentsPage() {
  const [viewModel, hero] = await Promise.all([buildMomentsViewModel(), getPageHero("moments")]);
  const featured = viewModel.featuredMoment;
  const publicMoments = viewModel.publicMoments || [];

  return (
    <NewsroomShell eyebrow="Moment Archive">
      <LeagueHero
        eyebrow={hero.eyebrow}
        title={hero.title}
        dek={hero.dek}
        aside={featured ? (
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Featured moment</p>
            <h2 className="mt-2 text-2xl font-black text-white">{featured.hand_no ? `Hand #${featured.hand_no}` : "Moment"}</h2>
            <FactLine label="Winner" value={cleanName(featured.winner_name, "")} />
            <FactLine label="Pot" value={potText(featured.pot_collected, featured)} />
            <FactLine label="Session" value={featured.sessionCode} />
            {featured.detailHref ? <Link href={featured.detailHref} className="mt-4 inline-flex font-black text-amber-200 hover:text-amber-100">Open moment</Link> : null}
          </div>
        ) : (
          <p className="leading-7 text-stone-300">The public moment wall is waiting on an approved blurb, featured selection, or major marker.</p>
        )}
      />

      <StatStrip>
        <StatCard label="Public moments" value={viewModel.stats.publicMoments} />
        <StatCard label="Published blurbs" value={viewModel.stats.publishedMoments} />
        <StatCard label="Featured / Major" value={viewModel.stats.featuredOrMajorMoments} />
        <StatCard label="Biggest public pot" value={viewModel.stats.biggestListedPotText || potText(viewModel.stats.biggestListedPot) || "-"} />
      </StatStrip>

      <StatStrip>
        <StatCard label="Detected candidates" value={viewModel.stats.totalMoments} detail="Admin review pool, not public canon." />
        <StatCard label="Videos attached" value={viewModel.stats.videosAttached} />
        <StatCard label="Players represented" value={viewModel.stats.playersRepresented} />
        <StatCard label="Sessions represented" value={viewModel.stats.sessionsRepresented} />
      </StatStrip>

      {featured ? (
        <section className="mt-8">
          <SectionHeader eyebrow="Featured" title="Featured Moment" />
          <MomentArchiveCard moment={featured} featured />
        </section>
      ) : null}

      <ContentRail
        main={
          <section>
            <SectionHeader eyebrow="Curated Archive" title="Public Moments">
              <p>These are approved or admin-selected archive entries. Candidate hands stay in the admin moment desk until selected.</p>
            </SectionHeader>
            {publicMoments.length ? (
              <CardGrid>
                {viewModel.recentMoments.map((moment) => (
                  <MomentArchiveCard key={moment.momentId} moment={moment} />
                ))}
              </CardGrid>
            ) : (
              <div className="rounded-md border border-[#d8c087]/16 bg-[#08111a]/78 p-6 text-stone-300">
                No public moments have been selected yet. Detected candidates are available in the admin moment desk for blurb generation and publishing.
              </div>
            )}
          </section>
        }
        rail={
          <>
            <EvidencePanel title="Public Big Pot Index" eyebrow="Top five" empty="No public big-pot moments yet.">
              {viewModel.biggestPots.map((moment, index) => (
                <Link key={moment.momentId} href={moment.detailHref} className="rounded-md border border-white/10 bg-white/[0.03] p-3 hover:border-amber-300/50">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-black text-white">#{index + 1} {moment.hand_no ? `Hand ${moment.hand_no}` : "Moment"}</span>
                    <span className="text-sm font-black text-amber-200">{potText(moment.pot_collected, moment)}</span>
                  </div>
                  <p className="mt-1 text-sm text-stone-400">{cleanName(moment.winner_name, "Winner pending")} / {moment.sessionCode || "Session pending"}</p>
                </Link>
              ))}
            </EvidencePanel>
            <EvidencePanel title="Published Blurbs" eyebrow="Approved copy" empty="No published moment blurbs are tied to selected moments yet.">
              {publicMoments.filter((moment) => moment.publishedDraft).slice(0, 6).map((moment) => (
                <Link key={`published-${moment.momentId}`} href={moment.detailHref} className="rounded-md border border-white/10 bg-white/[0.03] p-3 hover:border-amber-300/50">
                  <p className="font-black text-white">{moment.hand_no ? `Hand #${moment.hand_no}` : "Published moment"}</p>
                  <p className="mt-1 text-sm leading-6 text-stone-400">{stripPlayerHandlesFromText(text(moment.publishedSummary)).slice(0, 140)}</p>
                </Link>
              ))}
            </EvidencePanel>
            <EvidencePanel title="Detected Session Coverage" eyebrow="Admin candidate pool" empty="No detected moment candidates yet.">
              {(viewModel.sessionBreakdown || []).map((row) => (
                <div key={row.sessionCode} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-white">{row.sessionCode}</p>
                    <p className="text-sm font-black text-amber-200">{row.detected} detected</p>
                  </div>
                  <p className="mt-1 text-sm text-stone-400">
                    {row.public} public / {row.published} published / {row.featuredOrMajor} featured or major
                  </p>
                </div>
              ))}
            </EvidencePanel>
          </>
        }
      />
    </NewsroomShell>
  );
}

function FactLine({ label, value }) {
  if (!value) return null;
  return (
    <p className="mt-2 text-sm leading-6 text-stone-300">
      <span className="font-bold text-stone-400">{label}:</span> {typeof value === "number" ? formatNumber(value) : stripPlayerHandlesFromText(text(value))}
    </p>
  );
}
