import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ContentRail,
  EvidencePanel,
  LeagueHero,
  MomentCard,
  NewsroomShell,
  PublishedArticle,
  StatCard,
  StatStrip,
} from "@/components/newsroom/NewsroomShell";
import {
  cleanName,
  formatDate,
  formatNumber,
  formatPokerPercent,
  present,
  text,
} from "@/lib/newsroom/data";
import { buildPlayerViewModel } from "@/lib/newsroom/viewModels/player";
import { draftHeadline, draftParagraphs, draftSubheadline, waitingCopy } from "@/lib/newsroom/rendering";
import { PokerStatGrid } from "@/components/poker/PokerStatGrid";

export const revalidate = 60;

function firstPresent(...values) {
  return values.find((value) => present(value));
}

function sessionLabel(session, sessionId) {
  return text(session.session_code || session.session_number || sessionId, "Session");
}

export default async function PlayerPage({ params }) {
  const { playerId } = await params;
  const viewModel = await buildPlayerViewModel(playerId);
  if (!viewModel?.player) notFound();

  const {
    displayName,
    image,
    publishedDraft: published,
    pokerStats,
    recentSessions,
    notableHands,
    statCards,
  } = viewModel;
  const cardMap = new Map(statCards);

  return (
    <NewsroomShell eyebrow="Player Dossier">
      <LeagueHero
        eyebrow="Player dossier"
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
            placeholder={waitingCopy}
          />
        }
        rail={
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
        }
      />

      <section className="grid gap-6 pb-12 lg:grid-cols-2">
        <EvidencePanel title="Recent Sessions" empty="No recent session rows are available for this player yet.">
          {recentSessions.map((row, index) => {
            const result = row.result || row;
            const session = row.session || {};
            const sessionId = row.session_id || result.session_id || session.id;
            const sessionCode = session.session_code || sessionId;
            const href = sessionCode ? `/sessions/${encodeURIComponent(text(sessionCode))}` : "";
            return (
              <article key={`${sessionId || "session"}-${index}`} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
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

        <EvidencePanel title="Notable Hands" empty="No notable hands are attached to this player yet.">
          {notableHands.slice(0, 8).map((moment, index) => (
            <MomentCard
              key={`${moment.id || moment.hand_no || "moment"}-${index}`}
              title={moment.hand_no ? `Hand #${moment.hand_no}` : "Notable hand"}
              meta={cleanName(moment.winner_name, "")}
              pot={moment.pot_collected ? `${formatNumber(moment.pot_collected)} chips` : ""}
            >
              <StatLine label="Winner" value={cleanName(moment.winner_name, "")} />
              <StatLine label="Board" value={moment.board} />
              <StatLine label="Winning hand" value={moment.winning_hand} />
            </MomentCard>
          ))}
        </EvidencePanel>
      </section>
    </NewsroomShell>
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
