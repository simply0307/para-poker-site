import { ContentRail, EvidencePanel, LeagueHero, NewsroomShell, PublishedArticle, StatCard, StatStrip } from "@/components/newsroom/NewsroomShell";
import { getPublishedArticle } from "@/lib/newsroom/data";
import { hasRichTextMarkup, sanitizeRichText } from "@/lib/newsroom/richText";
import { waitingCopy } from "@/lib/newsroom/rendering";
import { stripPlayerHandlesFromText } from "@/lib/playerNames";

export const revalidate = 60;

export default async function ArticlePage({ params }) {
  const { articleId } = await params;
  const article = await getPublishedArticle(articleId);
  const body = article?.body || {};
  const textBody = stripPlayerHandlesFromText(body.article_body || body.recap_body || body.profile_body || "");
  const html = hasRichTextMarkup(textBody) ? sanitizeRichText(textBody) : "";
  const paragraphs = html ? [] : textBody.split(/\n{2,}/u).map((item) => item.trim()).filter(Boolean);
  const articleDate = article?.display_date || article?.published_at || "";

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
          <EvidencePanel title="Related" empty="No related items yet.">
            <p className="leading-7 text-stone-300">
              Related sessions, players, and moments will appear here.
            </p>
          </EvidencePanel>
        }
      />
    </NewsroomShell>
  );
}
