import { CardGrid, LeagueHero, NewsroomShell, SessionCard, StatCard, StatStrip } from "@/components/newsroom/NewsroomShell";
import { formatDate, getSessionsIndex, text } from "@/lib/newsroom/data";
import { getPageHero } from "@/lib/newsroom/pageHeroSettings";

export const revalidate = 60;

export default async function SessionsPage() {
  const [sessions, hero] = await Promise.all([getSessionsIndex(), getPageHero("sessions")]);

  return (
    <NewsroomShell eyebrow="Sessions">
      <LeagueHero
        eyebrow={hero.eyebrow}
        title={hero.title}
        dek={hero.dek}
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
