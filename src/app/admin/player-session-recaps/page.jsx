import { GenericDraftWorkspace } from "@/components/admin-newsroom/GenericDraftWorkspace";
import { getVariationOptions } from "@/lib/newsroom/contentAssignments";
import { getPlayersIndex, getSessionsIndex, text } from "@/lib/newsroom/data";
import { listNewsroomDrafts } from "@/lib/newsroom/drafts";

export const dynamic = "force-dynamic";

export default async function AdminPlayerSessionRecapsPage() {
  const [players, sessions] = await Promise.all([getPlayersIndex(), getSessionsIndex()]);
  const player = players[0] || {};
  const session = sessions[0] || {};
  const playerSessionDrafts = await listNewsroomDrafts({ table: "player_session_recap_drafts", fallbackScope: "player_session" });

  return (
    <GenericDraftWorkspace
      title="Player-session recap draft desk"
      endpoint="/api/player-session-recaps/generate"
      defaultPayload={{
        playerId: text(player.slug || player.id),
        sessionId: text(session.session_code || session.id, "S0-001"),
        variation: "moment_led",
        editorialNotes: "",
        promptConfig: {
          draftType: "player_session_recap",
          voiceMode: "Player Dossier",
          intensity: "Punchy",
          coverageFocus: ["specific player", "late hands", "notable moments"],
          mustMention: ["finish", "points", "biggest pot"],
          avoid: ["private coaching", "unsupported mistakes", "fake emotion"],
          length: "medium",
          format: "recap_article",
          audience: "public_player",
          customInstruction: "Make the player's session lane feel public, dignified, and specific.",
        },
      }}
      variationOptions={getVariationOptions("player_session_recap")}
      defaultPromptPreset="player_dossier"
      existingDrafts={playerSessionDrafts}
      existingDraftsTitle="Player-session drafts"
      initialDraft={playerSessionDrafts[0] || null}
    />
  );
}
