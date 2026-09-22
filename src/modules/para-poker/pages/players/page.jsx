import { CardGrid, LeagueHero, NewsroomShell, PlayerCard, StatCard, StatStrip } from "@/modules/para-poker/components/newsroom/NewsroomShell";
import { cleanName, getPlayersIndex, text } from "@/modules/para-poker/lib/newsroom/data";
import { getPageHero } from "@/modules/para-poker/lib/newsroom/pageHeroSettings";
import { getPlayerPublicCopy, readPublicCopySettings } from "@/modules/para-poker/lib/newsroom/publicCopySettings";
import { readSeasonSettings } from "@/modules/para-poker/lib/newsroom/seasonSettings";

export const revalidate = 60;

export default async function PlayersPage() {
  const [players, hero, seasonSettings, publicCopySettings] = await Promise.all([getPlayersIndex(), getPageHero("players"), readSeasonSettings(), readPublicCopySettings()]);

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
        {players.length ? players.map((player) => {
          const copy = getPlayerPublicCopy(publicCopySettings, player);
          return (
            <PlayerCard
              key={player.id}
              href={`/para/poker/players/${encodeURIComponent(text(player.slug || player.id))}`}
              name={cleanName(player.display_name || player.pokernow_name)}
              meta="Player profile"
              image={player.avatar_url || player.image_url || player.photo_url || player.profile_image_url || player.headshot_url}
            >
              <p>{copy.playerCardDek}</p>
            </PlayerCard>
          );
        }) : (
          <PlayerCard name="No players yet">
            <p>No players yet.</p>
          </PlayerCard>
        )}
      </CardGrid>
    </NewsroomShell>
  );
}
