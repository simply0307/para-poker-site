import { GenericDraftWorkspace } from "@/components/admin-newsroom/GenericDraftWorkspace";
import { getVariationOptions } from "@/lib/newsroom/contentAssignments";
import { getPlayersIndex, getSessionsIndex, text } from "@/lib/newsroom/data";

export const revalidate = 60;

export default async function AdminPlayerSessionRecapsPage() {
  const [players, sessions] = await Promise.all([getPlayersIndex(), getSessionsIndex()]);
  const player = players[0] || {};
  const session = sessions[0] || {};

  return (
    <GenericDraftWorkspace
      title="Player-session recap draft desk"
      endpoint="/api/player-session-recaps/generate"
      defaultPayload={{
        playerId: text(player.slug || player.id),
        sessionId: text(session.session_code || session.id, "S0-001"),
        variation: "moment_led",
        editorialNotes: "",
      }}
      variationOptions={getVariationOptions("player_session_recap")}
    />
  );
}
