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
import { readSeasonSettings } from "@/lib/newsroom/seasonSettings";
import { PokerStatGrid } from "@/components/poker/PokerStatGrid";
import { HandHistoryBlock } from "@/components/poker/HandActionLog";

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

export default async function PlayerPage({ params }) {
  const { playerId } = await params;
  const seasonSettings = await readSeasonSettings();
  const viewModel = await buildPlayerViewModel(playerId, { seasonCode: seasonSettings.activeSeasonCode });
  if (!viewModel?.player) notFound();

  const {
    displayName,
    image,
    publishedDraft: published,
    pokerStats,
    recentSessions,
    notableHands,
    contestedMoments,
    statCards,
  } = viewModel;
  const cardMap = new Map(statCards);

  return (
    <NewsroomShell eyebrow="Player Dossier">
      <LeagueHero
        eyebrow={`${seasonSettings.activeSeasonCode} player dossier`}
        title={displayName}
        dek={[cardMap.get("Rank") ? `Rank ${cardMap.get("Rank")}` : "", cardMap.get("Points") ? `${cardMap.get("Points")} points` : "", cardMap.get("Sessions") ? `${cardMap.get("Sessions")} sessions` : ""].filter(Boolean).join(" · ") || "The board is still forming."}
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
      />
      <StatStrip>
        <StatCard label="Points" value={pokerStats?.points || cardMap.get("Points") || ""} />
        <StatCard label="Sessions" value={pokerStats?.sessions || cardMap.get("Sessions") || ""} />
        <StatCard label="Best Finish" value={pokerStats?.bestFinish ? `#${pokerStats.bestFinish}` : cardMap.get("Best result") || ""} />
        <StatCard label="Biggest Pot" value={pokerStats?.biggestPot ? formatNumber(pokerStats.biggestPot) : cardMap.get("Biggest pot") ? formatNumber(cardMap.get("Biggest pot")) : ""} />
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
            <EvidencePanel title="Poker Stats" empty="No poker stats are available yet.">
              <PokerStatGrid
                stats={[
                  { label: "Hands", value: pokerStats?.hands ? formatNumber(pokerStats.hands) : "", empty: "Hands not tracked yet" },
                  { label: "VPIP", value: formatPokerPercent(pokerStats?.vpip), empty: "VPIP not tracked yet" },
                  { label: "PFR", value: formatPokerPercent(pokerStats?.pfr), empty: "PFR not tracked yet" },
                  { label: "Wins", value: pokerStats?.wins || "", empty: "Wins not tracked yet" },
                  { label: "Top Finishes", value: pokerStats?.topFinishes || "", empty: "Top finishes not tracked yet" },
                  { label: "Biggest Pot", value: pokerStats?.biggestPot ? `${formatNumber(pokerStats.biggestPot)} chips` : "", empty: "Biggest pot not tracked yet" },
                ]}
              />
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
                <StatLine label="Finish" value={result.finish ? `#${result.finish}` : ""} />
                <StatLine label="Points" value={firstPresent(result.league_points, result.points)} />
                <StatLine label="Hands" value={firstPresent(row.hands, row.hands_played, row.hand_count)} />
                <StatLine label="Biggest pot" value={firstPresent(row.biggest_pot_won, row.biggest_pot, row.largest_pot)} />
              </article>
            );
          })}
        </EvidencePanel>

        <EvidencePanel title="Player Moments" empty="No notable hands are attached to this player yet.">
          <PlayerMomentSection title="Won moments" moments={notableHands} role="Winner" />
          <PlayerMomentSection title="Contested moments" moments={contestedMoments} role="Involved" />
        </EvidencePanel>
      </section>
    </NewsroomShell>
  );
}

function PlayerMomentSection({ title, moments = [], role }) {
  if (!moments.length) return null;
  return (
    <div className="mb-5 last:mb-0">
      <h3 className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-amber-200">{title}</h3>
      <div className="grid gap-4">
        {moments.slice(0, 6).map((moment, index) => (
          <div
            key={`${moment.id || moment.hand_no || title}-${index}`}
            className="grid gap-2"
          >
            <p className="text-xs font-black uppercase tracking-[0.14em] text-stone-500">{role === "Winner" ? "Won hand" : "Contender hand"}</p>
            <HandHistoryBlock hand={moment} compact detailHref={handDetailHref(moment)} />
          </div>
        ))}
      </div>
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
