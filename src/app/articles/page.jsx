import { CardGrid, LeagueHero, MomentCard, NewsroomShell, StatCard, StatStrip } from "@/components/newsroom/NewsroomShell";
import { getPublishedArticlesIndex } from "@/lib/newsroom/data";
import { waitingCopy } from "@/lib/newsroom/rendering";

export const revalidate = 60;

export default async function ArticlesPage() {
  const articles = await getPublishedArticlesIndex();

  return (
    <NewsroomShell eyebrow="Coverage">
      <LeagueHero
        eyebrow="League coverage"
        title="League Coverage"
        dek={articles.length ? "Latest league notes." : waitingCopy}
      />
      <StatStrip>
        <StatCard label="Published articles" value={articles.length} />
      </StatStrip>
      <CardGrid>
        {articles.length ? articles.map((article) => (
          <MomentCard
            key={article.id}
            href={`/articles/${encodeURIComponent(article.slug || article.id)}`}
            title={article.title}
            meta={article.scope || "Article"}
          >
            <p>{article.body?.subheadline || article.body?.headline || "Read article."}</p>
          </MomentCard>
        )) : (
          <MomentCard href="/articles/latest" title="Latest article" meta="Placeholder">
            <p>{waitingCopy}</p>
          </MomentCard>
        )}
      </CardGrid>
    </NewsroomShell>
  );
}
