import { GenericDraftWorkspace } from "@/components/admin-newsroom/GenericDraftWorkspace";
import { getVariationOptions } from "@/lib/newsroom/contentAssignments";

export default function AdminStandingsPage() {
  return (
    <GenericDraftWorkspace
      title="Standings draft desk"
      endpoint="/api/standings/generate"
      defaultPayload={{
        seasonCode: "S0",
        variation: "leaderboard_snapshot",
        editorialNotes: "",
        promptConfig: {
          draftType: "standings_summary",
          voiceMode: "Standings Pulse",
          intensity: "Balanced",
          coverageFocus: ["winner", "runner-up", "standings impact"],
          mustMention: ["rank", "points"],
          avoid: ["clinched", "final standings", "season is over"],
          length: "short",
          format: "standings_note",
          audience: "public_league",
          customInstruction: "Treat the board as current and alive, not final.",
        },
      }}
      variationOptions={getVariationOptions("standings_summary")}
    />
  );
}
