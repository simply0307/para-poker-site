import { CardGrid, NewsroomCard, NewsroomShell, PageHeader } from "@/components/newsroom/NewsroomShell";
import { cleanName, getPlayersIndex, text } from "@/lib/newsroom/data";

export const revalidate = 60;

export default async function PlayersPage() {
  const players = await getPlayersIndex();

  return (
    <NewsroomShell eyebrow="Public Coverage">
      <PageHeader title="Player profiles">
        <p>Public profiles are generated from league data, reviewed, and published by the newsroom.</p>
      </PageHeader>
      <CardGrid>
        {players.length ? players.map((player) => (
          <NewsroomCard
            key={player.id}
            href={`/players/${encodeURIComponent(text(player.slug || player.id))}`}
            title={cleanName(player.display_name || player.pokernow_name)}
            meta="Player profile"
          >
            <p>Open the published profile surface.</p>
          </NewsroomCard>
        )) : (
          <NewsroomCard title="No players yet">
            <p>Player coverage will appear once the roster is available.</p>
          </NewsroomCard>
        )}
      </CardGrid>
    </NewsroomShell>
  );
}
