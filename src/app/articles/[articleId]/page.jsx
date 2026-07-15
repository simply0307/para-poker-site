import Link from "next/link";
import { ContentRail, EvidencePanel, LeagueHero, NewsroomShell, PublishedArticle, StatCard, StatStrip } from "@/components/newsroom/NewsroomShell";
import { getPublishedArticle } from "@/lib/newsroom/data";
import { hasRichTextMarkup, sanitizeRichText } from "@/lib/newsroom/richText";
import { waitingCopy } from "@/lib/newsroom/rendering";
import { stripPlayerHandlesFromText } from "@/lib/playerNames";

export const revalidate = 60;

function articleContextItems(article = {}) {
  const request = article?.article_request || {};
  const selection = request.contextSelection || request.context_selection || {};
  const items = [];

  for (const sessionId of selection.sessionIds || selection.session_ids || []) {
    items.push({
      href: `/sessions/${encodeURIComponent(sessionId)}`,
      label: sessionId,
      meta: "Session",
    });
  }

  for (const playerId of selection.playerIds || selection.player_ids || []) {
    items.push({
      href: `/players/${encodeURIComponent(playerId)}`,
      label: stripPlayerHandlesFromText(playerId),
      meta: "Player",
    });
  }

  for (const momentId of selection.momentIds || selection.moment_ids || []) {
    items.push({
      href: `/moments#${encodeURIComponent(momentId)}`,
      label: momentId,
      meta: "Moment",
    });
  }

  if (selection.includeStandings || selection.include_standings) {
    items.push({
      href: "/standings",
      label: "Current board",
      meta: "Standings",
    });
  }

  return items;
}

export default async function ArticlePage({ params }) {
  const { articleId } = await params;
  const article = await getPublishedArticle(articleId);
  const articleVideo = article?.video || null;
  const body = article?.body || {};
  const textBody = stripPlayerHandlesFromText(body.article_body || body.recap_body || body.profile_body || "");
  const html = hasRichTextMarkup(textBody) ? sanitizeRichText(textBody) : "";
  const paragraphs = html ? [] : textBody.split(/\n{2,}/u).map((item) => item.trim()).filter(Boolean);
  const articleDate = article?.display_date || article?.published_at || "";
  const contextItems = articleContextItems(article);

  return (
    <NewsroomShell eyebrow="Article">
      <LeagueHero
        eyebrow="League coverage"
        title={stripPlayerHandlesFromText(article?.title || `Article ${articleId}`)}
        dek={stripPlayerHandlesFromText(body.subheadline || "No published recap yet.")}
      />
      <StatStrip>
        <StatCard label="Author" value={stripPlayerHandlesFromText(article?.author || "Para League Desk")} />
        <StatCard label="Published" value={articleDate ? new Date(articleDate).toLocaleDateString("en-US") : "Pending"} />
      </StatStrip>
      {articleVideo?.signed_url ? (
        <section className="mt-8 overflow-hidden rounded-md border border-[#d8c087]/20 bg-[#08111a]/80 shadow-2xl shadow-black/30">
          <video
            key={articleVideo.signed_url}
            className="aspect-video w-full bg-black object-contain"
            src={articleVideo.signed_url}
            controls
            playsInline
            preload="metadata"
          />
          <div className="border-t border-white/10 px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-stone-400">
            Article video{articleVideo.filename ? ` / ${articleVideo.filename}` : ""}
          </div>
        </section>
      ) : null}
      <ContentRail
        main={
          <PublishedArticle
            compact
            title={stripPlayerHandlesFromText(article?.title || `Article ${articleId}`)}
            subheadline={stripPlayerHandlesFromText(body.subheadline || "")}
            paragraphs={paragraphs}
            html={html}
            placeholder={waitingCopy}
          />
        }
        rail={
          <EvidencePanel title="Related Context" eyebrow="Article evidence" empty="No related items yet.">
            {contextItems.length ? (
              <div className="grid gap-3">
                {contextItems.map((item) => (
                  <Link
                    key={`${item.meta}-${item.href}`}
                    href={item.href}
                    className="rounded-lg border border-amber-400/20 bg-stone-950/70 p-4 transition hover:border-amber-300/60 hover:bg-stone-900"
                  >
                    <span className="block text-xs font-black uppercase tracking-[0.18em] text-amber-300">{item.meta}</span>
                    <span className="mt-1 block font-black text-stone-100">{item.label}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="leading-7 text-stone-300">
                Related sessions, players, and moments will appear here when they are attached in the article draft desk.
              </p>
            )}
          </EvidencePanel>
        }
      />
    </NewsroomShell>
  );
}
