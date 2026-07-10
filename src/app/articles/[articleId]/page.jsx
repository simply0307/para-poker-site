import { NewsroomShell, PublishedArticle } from "@/components/newsroom/NewsroomShell";
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
      <PublishedArticle
        title={article?.title || `Article ${articleId}`}
        subheadline={body.subheadline || ""}
        paragraphs={paragraphs}
        placeholder={waitingCopy}
      />
    </NewsroomShell>
  );
}
