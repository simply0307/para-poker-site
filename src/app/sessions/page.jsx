import { CardGrid, LeagueHero, NewsroomShell, SessionCard, StatCard, StatStrip } from "@/components/newsroom/NewsroomShell";
import { formatDate, getSessionsIndex, text } from "@/lib/newsroom/data";

export const revalidate = 60;

export default async function SessionsPage() {
  const sessions = await getSessionsIndex();

  return (
    <NewsroomShell eyebrow="Sessions">
      <LeagueHero
        eyebrow="Preseason tables"
        title="Session recaps"
        dek="Results, moments, and hand histories."
      />
      <StatStrip>
        <StatCard label="Sessions" value={sessions.length} />
        <StatCard
          label="Tracked hands"
          value={sessions.reduce((sum, session) => sum + Number(session.hands_count || 0), 0)}
        />
      </StatStrip>
      <CardGrid>
        {sessions.length ? sessions.map((session) => (
          <SessionCard
            key={session.id}
            href={`/sessions/${encodeURIComponent(text(session.session_code || session.id))}`}
            title={text(session.session_code, "Session")}
            meta={[formatDate(session.played_at), session.hands_count ? `${session.hands_count} hands` : ""].filter(Boolean).join(" / ")}
          >
            <p>{session.table_name || session.format || "Result pending."}</p>
          </SessionCard>
        )) : (
          <SessionCard title="No sessions yet">
            <p>No verified sessions yet.</p>
          </SessionCard>
        )}
      </CardGrid>
    </NewsroomShell>
  );
}
