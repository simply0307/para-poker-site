import { GenericDraftWorkspace } from "@/components/admin-newsroom/GenericDraftWorkspace";
import { listNewsroomDrafts } from "@/lib/newsroom/drafts";
import { readSeasonSettings } from "@/lib/newsroom/seasonSettings";

export const dynamic = "force-dynamic";

export default async function AdminStandingsPage() {
  const seasonSettings = await readSeasonSettings();
  const standingsDrafts = await listNewsroomDrafts({ table: "standings_drafts", fallbackScope: "season", seasonCode: seasonSettings.activeSeasonCode });

  return (
    <GenericDraftWorkspace
      draftType="standings_summary"
      title="Standings draft desk"
      defaultPayload={{
        seasonCode: seasonSettings.activeSeasonCode,
        variation: "table_state",
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
      existingDrafts={standingsDrafts}
      existingDraftsTitle="Standings drafts"
      initialDraft={standingsDrafts[0] || null}
    />
  );
}
