import { CardGrid, NewsroomCard, NewsroomShell, PageHeader } from "@/components/newsroom/NewsroomShell";
import { formatDate, getSessionsIndex, text } from "@/lib/newsroom/data";

export const revalidate = 60;

export default async function SessionsPage() {
  const sessions = await getSessionsIndex();

  return (
    <NewsroomShell eyebrow="Public Coverage">
      <PageHeader title="Session recaps">
        <p>Published session coverage appears here after newsroom review.</p>
      </PageHeader>
      <CardGrid>
        {sessions.length ? sessions.map((session) => (
          <NewsroomCard
            key={session.id}
            href={`/sessions/${encodeURIComponent(text(session.session_code || session.id))}`}
            title={text(session.session_code, "Session")}
            meta={[formatDate(session.played_at), session.hands_count ? `${session.hands_count} hands` : ""].filter(Boolean).join(" / ")}
          >
            <p>Open the public recap surface for this session.</p>
          </NewsroomCard>
        )) : (
          <NewsroomCard title="No sessions yet">
            <p>Session coverage will appear once structured league data is available.</p>
          </NewsroomCard>
        )}
      </CardGrid>
    </NewsroomShell>
  );
}
