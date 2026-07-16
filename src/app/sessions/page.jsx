import { CardGrid, LeagueHero, NewsroomShell, SessionCard, StatCard, StatStrip } from "@/components/newsroom/NewsroomShell";
import { formatDate, getSessionsIndex, text } from "@/lib/newsroom/data";
import { getPageHero } from "@/lib/newsroom/pageHeroSettings";
import { displaySessionTableLabel, getSessionPublicCopy, readPublicCopySettings } from "@/lib/newsroom/publicCopySettings";
import { readSeasonSettings } from "@/lib/newsroom/seasonSettings";

export const revalidate = 60;

export default async function SessionsPage() {
  const seasonSettings = await readSeasonSettings();
  const [sessions, hero, publicCopySettings] = await Promise.all([getSessionsIndex(seasonSettings.activeSeasonCode), getPageHero("sessions"), readPublicCopySettings()]);

  return (
    <NewsroomShell eyebrow="Sessions">
      <LeagueHero
        eyebrow={hero.eyebrow}
        title={hero.title}
        dek={hero.dek}
      />
      <StatStrip>
        <StatCard label="Sessions" value={sessions.length} />
        <StatCard label="Season" value={seasonSettings.activeSeasonCode} detail={seasonSettings.seasonPhase} />
        <StatCard
          label="Tracked hands"
          value={sessions.reduce((sum, session) => sum + Number(session.hands_count || 0), 0)}
        />
      </StatStrip>
      <CardGrid>
        {sessions.length ? sessions.map((session) => {
          const copy = getSessionPublicCopy(publicCopySettings, session);
          return (
            <SessionCard
              key={session.id}
              href={`/sessions/${encodeURIComponent(text(session.session_code || session.id))}`}
              title={text(session.session_code, "Session")}
              meta={[formatDate(session.played_at), session.hands_count ? `${session.hands_count} hands` : ""].filter(Boolean).join(" / ")}
            >
              <p>{displaySessionTableLabel(session, copy) || copy.sessionCardDek}</p>
            </SessionCard>
          );
        }) : (
          <SessionCard title="No sessions yet">
            <p>No verified sessions yet.</p>
          </SessionCard>
        )}
      </CardGrid>
    </NewsroomShell>
  );
}
