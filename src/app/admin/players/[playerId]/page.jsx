import { GenericDraftWorkspace } from "@/components/admin-newsroom/GenericDraftWorkspace";
import { getVariationOptions } from "@/lib/newsroom/contentAssignments";

export default async function AdminPlayerPage({ params }) {
  const { playerId } = await params;
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
    />
  );
}
