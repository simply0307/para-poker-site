import { GenericDraftWorkspace } from "@/components/admin-newsroom/GenericDraftWorkspace";
import { getVariationOptions } from "@/lib/newsroom/contentAssignments";
import { getPlayerByIdOrSlug } from "@/lib/newsroom/data";
import { listNewsroomDrafts } from "@/lib/newsroom/drafts";

export const dynamic = "force-dynamic";

export default async function AdminPlayerPage({ params }) {
  const { playerId } = await params;
  const player = await getPlayerByIdOrSlug(playerId);
  const profileDrafts = player?.id
    ? await listNewsroomDrafts({ table: "profile_drafts", fallbackScope: "player", sourcePlayerId: player.id })
    : [];

  return (
    <GenericDraftWorkspace
      title={`Player draft desk: ${playerId}`}
      endpoint="/api/profiles/generate"
      defaultPayload={{
        playerId,
        variation: "shareable_profile",
        editorialNotes: "",
        promptConfig: {
          draftType: "player_profile",
          voiceMode: "Player Dossier",
          intensity: "Punchy",
          coverageFocus: ["recent form", "top finishes", "notable moments"],
          mustMention: ["rank", "points", "sessions"],
          avoid: ["too much myth", "generic sports filler"],
          length: "medium",
          format: "profile_card",
          audience: "public_player",
          customInstruction: "Make this feel like a shareable player card, not a database summary.",
        },
      }}
      variationOptions={getVariationOptions("player_profile")}
      defaultPromptPreset="player_dossier"
      existingDrafts={profileDrafts}
      existingDraftsTitle="Player profile drafts"
      initialDraft={profileDrafts[0] || null}
    />
  );
}
