import { GenericDraftWorkspace } from "@/components/admin-newsroom/GenericDraftWorkspace";
import { getVariationOptions } from "@/lib/newsroom/contentAssignments";

export default async function AdminPlayerPage({ params }) {
  const { playerId } = await params;
  return (
    <GenericDraftWorkspace
      title={`Player draft desk: ${playerId}`}
      endpoint="/api/profiles/generate"
      defaultPayload={{ playerId, variation: "shareable_profile", editorialNotes: "" }}
      variationOptions={getVariationOptions("player_profile")}
    />
  );
}
