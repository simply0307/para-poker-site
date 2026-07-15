import { GenericDraftWorkspace } from "@/components/admin-newsroom/GenericDraftWorkspace";
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
      draftType="player_session_recap"
      title="Player-session recap draft desk"
      defaultPayload={{
        playerId: text(player.slug || player.id),
        sessionId: text(session.session_code || session.id, "S0-001"),
        variation: "pressure_spot_note",
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
      existingDrafts={playerSessionDrafts}
      existingDraftsTitle="Player-session drafts"
      initialDraft={playerSessionDrafts[0] || null}
    />
  );
}
