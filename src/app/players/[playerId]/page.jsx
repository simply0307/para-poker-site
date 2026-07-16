import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ContentRail,
  EvidencePanel,
  LeagueHero,
  NewsroomShell,
  PublishedArticle,
  StatCard,
  StatStrip,
} from "@/components/newsroom/NewsroomShell";
import {
  formatDate,
  formatNumber,
  formatPokerPercent,
  present,
  text,
} from "@/lib/newsroom/data";
import { buildPlayerViewModel } from "@/lib/newsroom/viewModels/player";
import { draftHeadline, draftHtml, draftParagraphs, draftSubheadline, waitingCopy } from "@/lib/newsroom/rendering";
import { getPlayerPublicCopy, readPublicCopySettings } from "@/lib/newsroom/publicCopySettings";
import { readSeasonSettings } from "@/lib/newsroom/seasonSettings";
import { PokerStatGrid } from "@/components/poker/PokerStatGrid";
import { HandHistoryBlock } from "@/components/poker/HandActionLog";
import { formatBb } from "@/lib/poker/potUnits";
import { handArchiveItem } from "@/lib/poker/handArchiveMetadata";
import { FilterableEvidenceArchive } from "@/components/newsroom/FilterableEvidenceArchive";

export const revalidate = 60;

function firstPresent(...values) {
  return values.find((value) => present(value));
}

function sessionLabel(session, sessionId) {
  return text(session.session_code || session.session_number || sessionId, "Session");
}

function handDetailHref(hand = {}) {
  const sessionId = hand.session_code || hand.session_id;
  if (!sessionId) return "";
  return `/sessions/${encodeURIComponent(text(sessionId))}${hand.hand_no ? `#hand-${hand.hand_no}` : ""}`;
}

function potRecordText({ bb, chips } = {}) {
  if (present(bb)) return `${formatBb(bb)}${present(chips) ? ` / ${formatNumber(chips)} chips` : ""}`;
  return present(chips) ? `${formatNumber(chips)} chips` : "";
}

function finishText(value) {
  return present(value) ? `#${value}` : "";
}

export default async function PlayerPage({ params }) {
  const { playerId } = await params;
  const [seasonSettings, publicCopySettings] = await Promise.all([readSeasonSettings(), readPublicCopySettings()]);
  const viewModel = await buildPlayerViewModel(playerId, { seasonCode: seasonSettings.activeSeasonCode });
  if (!viewModel?.player) notFound();

  const {
    displayName,
    image,
    publishedDraft: published,
    pokerStats,
    recentSessions,
    currentForm,
    notableHands,
    contestedMoments,
    statCards,
  } = viewModel;
  const cardMap = new Map(statCards);
  const publicCopy = getPlayerPublicCopy(publicCopySettings, viewModel.player);
  const heroDek = [cardMap.get("Rank") ? `Rank ${cardMap.get("Rank")}` : "", cardMap.get("Points") ? `${cardMap.get("Points")} points` : "", cardMap.get("Sessions") ? `${cardMap.get("Sessions")} sessions` : ""].filter(Boolean).join(" · ") || publicCopy.playerProfileDek;
  const playerMoments = [
    ...(notableHands || []).map((hand) => ({ hand, role: "Won hand" })),
    ...(contestedMoments || []).map((hand) => ({ hand, role: "Contender hand" })),
  ];
  const playerMomentItems = playerMoments.map(({ hand, role }, index) => ({
    ...handArchiveItem(hand, index, hand.session_code || hand.session_id),
    role,
  }));

  return (
    <NewsroomShell eyebrow="Player Dossier">
      <LeagueHero
        eyebrow={`${seasonSettings.activeSeasonCode} player dossier`}
        title={displayName}
        dek={heroDek}
        aside={
          <div className="flex items-center gap-4">
            <div
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-amber-300/30 bg-white/10 bg-cover bg-center text-4xl font-black text-amber-200"
              style={image ? { backgroundImage: `url(${image})` } : undefined}
              aria-label={image ? `${displayName} profile image` : undefined}
            >
              {image ? null : displayName.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">Public record</p>
              <p className="mt-2 text-2xl font-black text-white">{cardMap.get("Rank") ? `Rank ${cardMap.get("Rank")}` : "Rank pending"}</p>
              <p className="mt-1 text-sm text-stone-400">{cardMap.get("Points") ? `${cardMap.get("Points")} points` : "Points pending"}</p>
            </div>
          </div>
        }
      >
        <div className="grid gap-3 text-sm text-stone-300 sm:grid-cols-3">
          <HeroBadge label="Current form" value={currentForm?.line || "Awaiting more sessions"} />
          <HeroBadge label="Largest swing" value={potRecordText({ bb: pokerStats?.biggestPotBb, chips: pokerStats?.biggestPot }) || "Pending"} />
          <HeroBadge label="Latest table" value={currentForm?.latestLabel || "Pending"} />
        </div>
      </LeagueHero>
      <StatStrip>
        <StatCard label="Points" value={pokerStats?.points || cardMap.get("Points") || ""} />
        <StatCard label="Sessions" value={pokerStats?.sessions || cardMap.get("Sessions") || ""} />
        <StatCard label="Best Finish" value={pokerStats?.bestFinish ? `#${pokerStats.bestFinish}` : cardMap.get("Best result") || ""} />
        <StatCard label="Biggest Pot" value={potRecordText({ bb: pokerStats?.biggestPotBb, chips: pokerStats?.biggestPot }) || cardMap.get("Biggest pot") || ""} />
      </StatStrip>

      <ContentRail
        main={
          <PublishedArticle
            compact
            title={draftHeadline(published, `${displayName} profile`)}
            subheadline={draftSubheadline(published)}
            paragraphs={draftParagraphs(published)}
            html={draftHtml(published)}
            placeholder={waitingCopy}
          />
        }
        rail={
          <div className="grid gap-5">
            <EvidencePanel title="Season Card" eyebrow="Public record" empty="No record card is available yet.">
              <RecordLine label="Rank" value={cardMap.get("Rank") ? `#${cardMap.get("Rank")}` : ""} />
              <RecordLine label="Points" value={cardMap.get("Points")} />
              <RecordLine label="Sessions" value={cardMap.get("Sessions")} />
              <RecordLine label="Best Finish" value={pokerStats?.bestFinish ? `#${pokerStats.bestFinish}` : cardMap.get("Best result")} />
            </EvidencePanel>
            <EvidencePanel title="Current Form" eyebrow="Active season" empty="No current-form rows are available yet.">
              <RecordLine label="Latest" value={currentForm?.latestLabel} />
              <RecordLine label="Wins" value={currentForm?.wins} />
              <RecordLine label="Top-three" value={currentForm?.topFinishes} />
              <RecordLine label="Recent points" value={currentForm?.points} />
              {currentForm?.line ? <p className="rounded-md border border-white/10 bg-white/[0.035] p-3 text-sm leading-6 text-stone-300">{currentForm.line}</p> : null}
            </EvidencePanel>
            <EvidencePanel title="Poker Stats" empty="No poker stats are available yet.">
              <PokerStatGrid
                stats={[
                  { label: "Hands", value: pokerStats?.hands ? formatNumber(pokerStats.hands) : "", empty: "Hands not tracked yet" },
                  { label: "VPIP", value: formatPokerPercent(pokerStats?.vpip), empty: "Advanced stat pending" },
                  { label: "PFR", value: formatPokerPercent(pokerStats?.pfr), empty: "Advanced stat pending" },
                  { label: "Wins", value: pokerStats?.wins || "", empty: "Official results pending" },
                  { label: "Top Finishes", value: pokerStats?.topFinishes || "", empty: "Official results pending" },
                  { label: "Biggest Pot", value: potRecordText({ bb: pokerStats?.biggestPotBb, chips: pokerStats?.biggestPot }), empty: "Biggest pot not tracked yet" },
                  { label: "Collected", value: potRecordText({ bb: pokerStats?.totalCollectedBb, chips: pokerStats?.totalCollected }), empty: "Collection total pending" },
                ]}
              />
              {pokerStats?.biggestPotBb || pokerStats?.totalCollectedBb ? (
                <p className="mt-3 rounded-md border border-amber-300/15 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
                  BB totals normalize pots across changing blind levels. Chip counts remain attached to the hand evidence below.
                </p>
              ) : null}
            </EvidencePanel>
          </div>
        }
      />

      <section className="mt-12 grid gap-8 pb-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <EvidencePanel title="Recent Sessions" empty="No recent session rows are available for this player yet.">
          {recentSessions.map((row, index) => {
            const result = row.result || row;
            const session = row.session || {};
            const sessionId = row.session_id || result.session_id || session.id;
            const sessionCode = session.session_code || sessionId;
            const href = sessionCode ? `/sessions/${encodeURIComponent(text(sessionCode))}` : "";
            return (
              <article key={`${sessionId || "session"}-${index}`} className="rounded-md border border-white/10 bg-white/[0.035] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {href ? (
                    <Link href={href} className="text-lg font-black text-white hover:text-amber-200">
                      {sessionLabel(session, sessionId)}
                    </Link>
                  ) : (
                    <h3 className="text-lg font-black text-white">{sessionLabel(session, sessionId)}</h3>
                  )}
                  <span className="text-sm text-stone-400">{formatDate(session.played_at)}</span>
                </div>
                <StatLine label="Finish" value={finishText(result.finish)} />
                <StatLine label="Points" value={firstPresent(result.league_points, result.points)} />
                <StatLine label="Hands" value={firstPresent(row.hands, row.hands_played, row.hand_count)} />
                <StatLine label="Biggest pot" value={potRecordText({ bb: row.biggest_pot_won_bb, chips: firstPresent(row.biggest_pot_won, row.biggest_pot, row.largest_pot) })} />
              </article>
            );
          })}
        </EvidencePanel>

        <EvidencePanel title="Player Moments" empty="No notable hands are attached to this player yet.">
          {playerMoments.length ? (
            <FilterableEvidenceArchive items={playerMomentItems} label="player moments" maxHeightClass="max-h-[42rem]">
              {playerMoments.map(({ hand, role }, index) => (
                <div
                  key={`${hand.id || hand.hand_no || role}-${index}`}
                  className="grid gap-2"
                >
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-stone-500">{role}</p>
                  <HandHistoryBlock hand={hand} compact detailHref={handDetailHref(hand)} />
                </div>
              ))}
            </FilterableEvidenceArchive>
          ) : null}
        </EvidencePanel>
      </section>
    </NewsroomShell>
  );
}

function HeroBadge({ label, value }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/25 px-3 py-2">
      <p className="text-[0.64rem] font-black uppercase tracking-[0.16em] text-stone-500">{label}</p>
      <p className="mt-1 font-black text-amber-100">{value}</p>
    </div>
  );
}

function StatLine({ label, value }) {
  if (!present(value)) return null;
  return (
    <p className="mt-2 text-sm leading-6 text-stone-300">
      <span className="font-bold text-stone-400">{label}:</span>{" "}
      {typeof value === "number" ? formatNumber(value) : text(value)}
    </p>
  );
}

function RecordLine({ label, value }) {
  if (!present(value)) return null;
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-white/10 bg-white/[0.035] px-3 py-2">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-stone-500">{label}</span>
      <strong className="text-lg text-amber-100">{typeof value === "number" ? formatNumber(value) : text(value)}</strong>
    </div>
  );
}
