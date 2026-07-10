import { NewsroomShell, PublishedArticle } from "@/components/newsroom/NewsroomShell";
import { getPublishedDraft } from "@/lib/newsroom/data";
import { draftHeadline, draftParagraphs, draftSubheadline, waitingCopy } from "@/lib/newsroom/rendering";

export const revalidate = 60;

export default async function MomentsPage() {
  const published = await getPublishedDraft({ scope: "moment" });

  return (
    <NewsroomShell eyebrow="Moment Blurbs">
      <PublishedArticle
        title={draftHeadline(published, "Moments")}
        subheadline={draftSubheadline(published)}
        paragraphs={draftParagraphs(published)}
        placeholder={waitingCopy}
      />
    </NewsroomShell>
  );
}
