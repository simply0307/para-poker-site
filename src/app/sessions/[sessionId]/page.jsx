import { notFound } from "next/navigation";
import { NewsroomShell, PublishedArticle } from "@/components/newsroom/NewsroomShell";
import { getPublishedDraft, getSessionByIdOrCode, text } from "@/lib/newsroom/data";
import { draftHeadline, draftParagraphs, draftSubheadline, waitingCopy } from "@/lib/newsroom/rendering";

export const revalidate = 60;

export default async function SessionPage({ params }) {
  const { sessionId } = await params;
  const session = await getSessionByIdOrCode(sessionId);
  if (!session) notFound();

  const published = await getPublishedDraft({ scope: "session", sourceSessionId: session.id });

  return (
    <NewsroomShell eyebrow="Session Recap">
      <PublishedArticle
        title={draftHeadline(published, `${text(session.session_code, "Session")} recap`)}
        subheadline={draftSubheadline(published)}
        paragraphs={draftParagraphs(published)}
        placeholder={waitingCopy}
      />
    </NewsroomShell>
  );
}
