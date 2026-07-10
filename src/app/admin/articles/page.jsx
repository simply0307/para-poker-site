import { GenericDraftWorkspace } from "@/components/admin-newsroom/GenericDraftWorkspace";
import { getVariationOptions } from "@/lib/newsroom/contentAssignments";

export default function AdminArticlesPage() {
  return (
    <GenericDraftWorkspace
      title="Article draft desk"
      endpoint="/api/articles/generate"
      defaultPayload={{ variation: "beat_report", articleRequest: { topic: "", seasonCode: "S0" } }}
      variationOptions={getVariationOptions("league_article")}
    />
  );
}
