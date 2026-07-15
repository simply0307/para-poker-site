import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ContentRail,
  EvidencePanel,
  LeagueHero,
  MomentCard,
  NewsroomShell,
  PublishedArticle,
  DataTableShell,
  StatCard,
  StatStrip,
} from "@/components/newsroom/NewsroomShell";
import {
  cleanName,
  formatDate,
  formatNumber,
  present,
  text,
} from "@/lib/newsroom/data";
import { buildSessionViewModel } from "@/lib/newsroom/viewModels/session";
import { draftHeadline, draftHtml, draftParagraphs, draftSubheadline, waitingCopy } from "@/lib/newsroom/rendering";
import { HandHistoryBlock } from "@/components/poker/HandActionLog";

export const revalidate = 60;

function chipValue(value) {
  return present(value) ? `${formatNumber(value)} chips` : "";
}

export default async function SessionPage({ params }) {
  const { sessionId } = await params;
  const viewModel = await buildSessionViewModel(sessionId);
  if (!viewModel?.session) notFound();

  const {
    session,
    publishedDraft: published,
    keyMoments,
    sessionResults,
    playerSessionStats,
    notableHands,
    handHistory,
    hands,
    participants,
    hasFullActionLogs,
    biggestPot,
  } = viewModel;
  const displayHands = handHistory.length ? handHistory : hands;

  return (
    <NewsroomShell eyebrow="Session Recap">
      <LeagueHero
        eyebrow="Preseason table"
        title={text(session.session_code, "Session")}
        dek={[firstPresent(session.table_name, session.format), `${session.hands_count || displayHands.length || 0} hands`, `${participants.length || playerSessionStats.length || sessionResults.length || 0} players`].filter(Boolean).join(" · ")}
        aside={
          <div className="space-y-3">
            <FactLine label="Date" value={formatDate(session.played_at)} />
            <FactLine label="Table" value={firstPresent(session.table_name, session.format)} />
            <FactLine label="Status" value={session.status} />
          </div>
        }
      />
      <StatStrip>
        <StatCard label="Players" value={participants.length || playerSessionStats.length || sessionResults.length} />
        <StatCard label="Hands" value={session.hands_count || displayHands.length} />
        <StatCard label="Moments" value={notableHands.length} />
        <StatCard label="Biggest pot" value={biggestPot?.pot_collected ? chipValue(biggestPot.pot_collected) : ""} />
      </StatStrip>

      <ContentRail
        main={
          <PublishedArticle
            compact
            title={draftHeadline(published, `${text(session.session_code, "Session")} recap`)}
            subheadline={draftSubheadline(published)}
            paragraphs={draftParagraphs(published)}
            html={draftHtml(published)}
            placeholder={waitingCopy}
          />
        }
        rail={
          <>
            <EvidencePanel title="Session Pulse" eyebrow="Official record" empty="Session pulse is waiting on imported data.">
              <FactPill label="Winner" value={cleanName(sessionResults.find((row) => Number(row.finish) === 1)?.player_name || participants[0]?.name, "")} />
              <FactPill label="Biggest Pot" value={biggestPot?.pot_collected ? chipValue(biggestPot.pot_collected) : ""} />
              <FactPill label="Hands Logged" value={session.hands_count || displayHands.length} />
              <FactPill label="Action Coverage" value={hasFullActionLogs ? "Street-by-street" : "Summary only"} />
            </EvidencePanel>
            <EvidencePanel title="Key Moments" empty="No published key moments are attached to this recap yet.">
              {keyMoments.map((moment, index) => (
                <MomentCard
                  key={`${moment.title || moment.headline || "key-moment"}-${index}`}
                  title={moment.title || moment.headline || "Key moment"}
                  meta={`Moment ${index + 1}`}
                >
                  <p>{moment.summary || moment.description || moment.impact || moment.body || "No published recap yet."}</p>
                </MomentCard>
              ))}
            </EvidencePanel>
          </>
        }
      />

      <DataTableShell
        title="Session Results"
        columns={["Finish", "Player", "Points"]}
        rows={sessionResults}
        empty="No result rows are available for this session yet."
        renderRow={(result, index) => {
          const participant = participants.find((player) => String(player.id) === String(result.player_id)) || {};
          const playerHref = participant.slug || result.player_id ? `/players/${encodeURIComponent(text(participant.slug || result.player_id))}` : "";
          return (
            <tr key={`${result.player_id || result.player_name || "result"}-${index}`}>
              <td className="border-b border-white/5 px-3 py-4 font-black text-amber-200">{result.finish ? `#${result.finish}` : "-"}</td>
              <td className="border-b border-white/5 px-3 py-4">
                {playerHref ? (
                  <Link href={playerHref} className="font-black text-white hover:text-amber-200">
                    {cleanName(participant.name || result.player_name)}
                  </Link>
                ) : (
                  <span className="font-black text-white">{cleanName(result.player_name)}</span>
                )}
              </td>
              <td className="border-b border-white/5 px-3 py-4 text-stone-300">{firstPresent(result.league_points, result.points) ?? "-"}</td>
            </tr>
          );
        }}
      />

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <EvidencePanel title="Participant Stats" empty="No participant stat rows are available for this session yet.">
          {playerSessionStats.map((row, index) => {
            const participant = participants.find((player) => String(player.id) === String(row.player_id)) || {};
            return (
              <article key={`${row.player_id || row.player_name || "stat"}-${index}`} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                <h3 className="text-lg font-black text-white">{cleanName(participant.name || row.player_name)}</h3>
                <FactLine label="Hands" value={firstPresent(row.hands, row.hands_played, row.hand_count)} />
                <FactLine label="Biggest pot won" value={chipValue(firstPresent(row.biggest_pot_won, row.biggest_pot, row.largest_pot))} />
                <FactLine label="VPIP" value={firstPresent(row.vpip, row.vpip_pct)} />
                <FactLine label="PFR" value={firstPresent(row.pfr, row.pfr_pct)} />
              </article>
            );
          })}
        </EvidencePanel>
        <EvidencePanel title="Notable Hand Summaries" empty="No notable hands are attached to this session yet.">
        {notableHands.slice(0, 12).map((hand, index) => (
          <HandHistoryBlock
            key={`${hand.id || hand.hand_no || "notable"}-${index}`}
            hand={hand}
            compact
          />
        ))}
        </EvidencePanel>
      </section>

      <EvidencePanel
        title={hasFullActionLogs ? "Hand History" : "Hand Summaries"}
        empty="No hand rows are available for this session yet."
        className="mt-8"
      >
        {!hasFullActionLogs && displayHands.length ? (
          <p className="mb-4 rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
            Full street-by-street action is not available in the current hand import. These cards show the verified hand result,
            board, winner, pot, and showdown fields that are stored for this session.
          </p>
        ) : null}
        {displayHands.map((hand, index) => (
          <HandHistoryBlock key={`${hand.id || hand.hand_no || "hand"}-${index}`} hand={hand} anchor />
        ))}
      </EvidencePanel>
    </NewsroomShell>
  );
}

function firstPresent(...values) {
  return values.find((value) => present(value));
}

function FactLine({ label, value }) {
  if (!present(value)) return null;
  return (
    <p className="mt-2 text-sm leading-6 text-stone-300">
      <span className="font-bold text-stone-400">{label}:</span>{" "}
      {typeof value === "number" ? formatNumber(value) : text(value)}
    </p>
  );
}

function FactPill({ label, value }) {
  if (!present(value)) return null;
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.035] p-3">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-stone-500">{label}</p>
      <p className="mt-1 text-lg font-black text-stone-100">{typeof value === "number" ? formatNumber(value) : text(value)}</p>
    </div>
  );
}
