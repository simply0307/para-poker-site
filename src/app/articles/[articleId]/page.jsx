import { ContentRail, EvidencePanel, LeagueHero, NewsroomShell, PublishedArticle, StatCard, StatStrip } from "@/components/newsroom/NewsroomShell";
import { getPublishedArticle } from "@/lib/newsroom/data";
import { waitingCopy } from "@/lib/newsroom/rendering";

export const revalidate = 60;

export default async function ArticlePage({ params }) {
  const { articleId } = await params;
  const article = await getPublishedArticle(articleId);
  const body = article?.body || {};
  const textBody = body.article_body || body.recap_body || body.profile_body || "";
  const paragraphs = textBody.split(/\n{2,}/u).map((item) => item.trim()).filter(Boolean);

  return (
    <NewsroomShell eyebrow="Article">
      <LeagueHero
        eyebrow="League coverage"
        title={article?.title || `Article ${articleId}`}
        dek={body.subheadline || "No published recap yet."}
      />
      <StatStrip>
        <StatCard label="Type" value={article?.scope || "Article"} />
        <StatCard label="Published" value={article?.published_at ? new Date(article.published_at).toLocaleDateString("en-US") : "Pending"} />
      </StatStrip>
      <ContentRail
        main={
          <PublishedArticle
            compact
            title={article?.title || `Article ${articleId}`}
            subheadline={body.subheadline || ""}
            paragraphs={paragraphs}
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
