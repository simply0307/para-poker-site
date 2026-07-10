import { GenericDraftWorkspace } from "@/components/admin-newsroom/GenericDraftWorkspace";
import { getVariationOptions } from "@/lib/newsroom/contentAssignments";
import { getMomentsIndex, text } from "@/lib/newsroom/data";

export const revalidate = 60;

export default async function AdminMomentsPage() {
  const moments = await getMomentsIndex();
  const firstMoment = moments[0] || {};

  return (
    <GenericDraftWorkspace
      title="Moment blurb draft desk"
      endpoint="/api/moments/generate"
      defaultPayload={{ momentId: text(firstMoment.id), variation: "impact_blurb", editorialNotes: "" }}
      variationOptions={getVariationOptions("moment_blurb")}
    />
  );
}
