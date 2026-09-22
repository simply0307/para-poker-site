import { hasLeagueConfiguration } from "@/lib/supabase/server";
import { LeagueHero, NewsroomShell } from "./newsroom/NewsroomShell";

export function LeagueAvailability({ children }) {
  if (hasLeagueConfiguration()) return children;
  return (
    <NewsroomShell>
      <LeagueHero
        eyebrow="Para Poker League"
        title="League records are unavailable."
        dek="We can’t load the league archive right now. Please try again later."
      />
    </NewsroomShell>
  );
}
