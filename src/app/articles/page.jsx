import { NewsroomShell, PageHeader, NewsroomCard, CardGrid } from "@/components/newsroom/NewsroomShell";
import { getPublishedArticlesIndex } from "@/lib/newsroom/data";
import { waitingCopy } from "@/lib/newsroom/rendering";

export const revalidate = 60;

export default async function ArticlesPage() {
  const articles = await getPublishedArticlesIndex();

  return (
    <NewsroomShell eyebrow="Public Coverage">
      <PageHeader title="Articles">
        <p>{articles.length ? "Published Para League articles." : waitingCopy}</p>
      </PageHeader>
      <CardGrid>
        {articles.length ? articles.map((article) => (
          <NewsroomCard
            key={article.id}
            href={`/articles/${encodeURIComponent(article.slug || article.id)}`}
            title={article.title}
            meta={article.scope || "Article"}
          >
            <p>{article.body?.subheadline || article.body?.headline || "Read the published newsroom article."}</p>
          </NewsroomCard>
        )) : (
          <NewsroomCard href="/articles/latest" title="Latest newsroom article" meta="Placeholder">
            <p>{waitingCopy}</p>
          </NewsroomCard>
        )}
      </CardGrid>
    </NewsroomShell>
  );
}
