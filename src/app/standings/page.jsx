import { NewsroomShell, PublishedArticle } from "@/components/newsroom/NewsroomShell";
import { getPublishedDraft } from "@/lib/newsroom/data";
import { draftHeadline, draftParagraphs, draftSubheadline, waitingCopy } from "@/lib/newsroom/rendering";

export const revalidate = 60;

export default async function StandingsPage() {
  const published = await getPublishedDraft({ scope: "season" });

  return (
    <NewsroomShell eyebrow="Standings Summary">
      <PublishedArticle
        title={draftHeadline(published, "Standings")}
        subheadline={draftSubheadline(published)}
        paragraphs={draftParagraphs(published)}
        placeholder={waitingCopy}
      />
    </NewsroomShell>
  );
}
