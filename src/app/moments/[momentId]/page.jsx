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
import { HandHistoryBlock } from "@/components/poker/HandActionLog";
import { cleanName, formatDate, formatNumber, present, text } from "@/lib/newsroom/data";
import { draftHeadline, draftHtml, draftParagraphs, draftSubheadline, waitingCopy } from "@/lib/newsroom/rendering";
import { buildMomentViewModel } from "@/lib/newsroom/viewModels/moments";
import { stripPlayerHandlesFromText } from "@/lib/playerNames";

export const revalidate = 60;

function potText(value) {
  return value ? `${formatNumber(value)} chips` : "";
}

export default async function MomentDetailPage({ params }) {
  const { momentId } = await params;
  const viewModel = await buildMomentViewModel(momentId);
  if (!viewModel?.moment) notFound();

  const { moment, session, hand, publishedDraft, relatedPlayer } = viewModel;
  const hasAction = hand?.actionLog?.kind === "action_log" || hand?.hasChronologicalAction;

  return (
    <NewsroomShell eyebrow="Moment Detail">
      <LeagueHero
        eyebrow={`${moment.typeLabel} / ${moment.statusLabels.join(" / ")}`}
        title={moment.hand_no ? `Hand #${moment.hand_no}` : "Moment"}
        dek={stripPlayerHandlesFromText(text(moment.displaySummary, "Verified hand marker from the Para League archive."))}
        aside={
          <div>
            <FactLine label="Winner" value={cleanName(moment.winner_name, "")} />
            <FactLine label="Pot" value={potText(moment.pot_collected)} />
            <FactLine label="Session" value={moment.sessionCode} />
            <FactLine label="Date" value={formatDate(session?.played_at)} />
          </div>
        }
      />

      <StatStrip>
        <StatCard label="Status" value={moment.statusLabels.join(" / ")} />
        <StatCard label="Moment Type" value={moment.typeLabel} />
        <StatCard label="Pot" value={potText(moment.pot_collected)} />
        <StatCard label="Session" value={moment.sessionCode} />
      </StatStrip>

      {moment.video?.signed_url ? (
        <section className="mt-8 overflow-hidden rounded-md border border-[#d8c087]/20 bg-black shadow-2xl shadow-black/40">
          <video
            controls
            preload="metadata"
            className="aspect-video w-full bg-black"
            src={moment.video.signed_url}
          />
          <div className="border-t border-white/10 bg-[#08111a] px-5 py-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-200">Moment video</p>
            <p className="mt-1 text-sm text-stone-400">{moment.video.filename || "Attached video"}</p>
          </div>
        </section>
      ) : null}

      <ContentRail
        main={
          <PublishedArticle
            compact
            title={draftHeadline(publishedDraft, moment.hand_no ? `Hand #${moment.hand_no}` : "Moment blurb")}
            subheadline={draftSubheadline(publishedDraft)}
            paragraphs={draftParagraphs(publishedDraft)}
            html={draftHtml(publishedDraft)}
            placeholder={publishedDraft ? waitingCopy : "This moment is detected from stored hand data. An approved published blurb has not been attached yet."}
          />
        }
        rail={
          <>
            <EvidencePanel title="Verified Facts" eyebrow="Evidence" empty="No facts available.">
              <FactBox label="Winner" value={cleanName(moment.winner_name, "")} />
              <FactBox label="Board" value={moment.board} />
              <FactBox label="Winning hand" value={moment.winning_hand} />
              <FactBox label="Result" value={moment.summary || moment.raw_result || moment.description} />
            </EvidencePanel>
            <EvidencePanel title="Pathways" eyebrow="Archive links" empty="No related links available.">
              {moment.sessionHref ? <LinkCard href={moment.sessionHref} title="Open Session" body={moment.sessionCode || "Session"} /> : null}
              {moment.playerHref ? <LinkCard href={moment.playerHref} title="Open Player" body={cleanName(relatedPlayer?.display_name || moment.winner_name, "Player")} /> : null}
            </EvidencePanel>
          </>
        }
      />

      <EvidencePanel
        title={hasAction ? "Hand Action" : "Hand Detail"}
        eyebrow="Verified hand history"
        empty="No hand data is available for this moment."
        className="mt-8"
      >
        {!hasAction ? (
          <p className="rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
            Full chronological action is not attached to this moment. Showing only stored result fields.
          </p>
        ) : null}
        <HandHistoryBlock hand={hand} />
      </EvidencePanel>
    </NewsroomShell>
  );
}

function FactLine({ label, value }) {
  if (!present(value)) return null;
  return (
    <p className="mt-2 text-sm leading-6 text-stone-300">
      <span className="font-bold text-stone-400">{label}:</span> {typeof value === "number" ? formatNumber(value) : stripPlayerHandlesFromText(text(value))}
    </p>
  );
}

function FactBox({ label, value }) {
  if (!present(value)) return null;
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-stone-500">{label}</p>
      <p className="mt-1 text-sm leading-6 text-stone-200">{typeof value === "number" ? formatNumber(value) : stripPlayerHandlesFromText(text(value))}</p>
    </div>
  );
}

function LinkCard({ href, title, body }) {
  return (
    <Link href={href} className="rounded-md border border-white/10 bg-white/[0.03] p-3 hover:border-amber-300/50">
      <p className="font-black text-white">{title}</p>
      <p className="mt-1 text-sm text-stone-400">{stripPlayerHandlesFromText(text(body))}</p>
    </Link>
  );
}
