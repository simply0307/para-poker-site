import { GenericDraftWorkspace } from "@/components/admin-newsroom/GenericDraftWorkspace";
import { getVariationOptions } from "@/lib/newsroom/contentAssignments";

export default function AdminStandingsPage() {
  return (
    <GenericDraftWorkspace
      title="Standings draft desk"
      endpoint="/api/standings/generate"
      defaultPayload={{ seasonCode: "S0", variation: "leaderboard_snapshot", editorialNotes: "" }}
      variationOptions={getVariationOptions("standings_summary")}
    />
  );
}
