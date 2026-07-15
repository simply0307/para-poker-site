import { CardGrid, LeagueHero, NewsroomShell, PlayerCard, StatCard, StatStrip } from "@/components/newsroom/NewsroomShell";
import { cleanName, getPlayersIndex, text } from "@/lib/newsroom/data";
import { getPageHero } from "@/lib/newsroom/pageHeroSettings";
import { readSeasonSettings } from "@/lib/newsroom/seasonSettings";

export const revalidate = 60;

export default async function PlayersPage() {
  const [players, hero, seasonSettings] = await Promise.all([getPlayersIndex(), getPageHero("players"), readSeasonSettings()]);

  return (
    <NewsroomShell eyebrow="Players">
      <LeagueHero
        eyebrow={hero.eyebrow}
        title={hero.title}
        dek={hero.dek}
      />
      <StatStrip>
        <StatCard label="Players" value={players.length} detail="Roster entries available for public profiles." />
        <StatCard label="Season" value={seasonSettings.activeSeasonCode} detail={seasonSettings.seasonPhase} />
      </StatStrip>
      <CardGrid>
        {players.length ? players.map((player) => (
          <PlayerCard
            key={player.id}
            href={`/players/${encodeURIComponent(text(player.slug || player.id))}`}
            name={cleanName(player.display_name || player.pokernow_name)}
            meta="Player profile"
          >
            <p>The board is still forming.</p>
          </PlayerCard>
        )) : (
          <PlayerCard name="No players yet">
            <p>No players yet.</p>
          </PlayerCard>
        )}
      </CardGrid>
    </NewsroomShell>
  );
}
