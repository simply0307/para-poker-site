import { CardGrid, LeagueHero, MomentCard, NewsroomShell, StatCard, StatStrip } from "@/components/newsroom/NewsroomShell";
import { getPublishedArticlesIndex } from "@/lib/newsroom/data";
import { getPageHero } from "@/lib/newsroom/pageHeroSettings";
import { waitingCopy } from "@/lib/newsroom/rendering";

export const revalidate = 60;

export default async function ArticlesPage() {
  const [articles, hero] = await Promise.all([getPublishedArticlesIndex(), getPageHero("articles")]);

  return (
    <NewsroomShell eyebrow="Coverage">
      <LeagueHero
        eyebrow={hero.eyebrow}
        title={hero.title}
        dek={articles.length ? hero.dek : waitingCopy}
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
            meta={[article.author, article.display_date ? new Date(article.display_date).toLocaleDateString("en-US") : ""].filter(Boolean).join(" / ")}
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
