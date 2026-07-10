import { notFound } from "next/navigation";
import { NewsroomShell, PublishedArticle } from "@/components/newsroom/NewsroomShell";
import { cleanName, getPlayerByIdOrSlug } from "@/lib/newsroom/data";
import { draftHeadline, draftParagraphs, draftSubheadline, waitingCopy } from "@/lib/newsroom/rendering";
import { getPublishedDraft } from "@/lib/newsroom/data";

export const revalidate = 60;

export default async function PlayerPage({ params }) {
  const { playerId } = await params;
  const player = await getPlayerByIdOrSlug(playerId);
  if (!player) notFound();
  const published = await getPublishedDraft({ scope: "player", sourcePlayerId: player.id });

  return (
    <NewsroomShell eyebrow="Player Profile">
      <PublishedArticle
        title={draftHeadline(published, cleanName(player.display_name || player.pokernow_name))}
        subheadline={draftSubheadline(published)}
        paragraphs={draftParagraphs(published)}
        placeholder={waitingCopy}
      />
    </NewsroomShell>
  );
}
