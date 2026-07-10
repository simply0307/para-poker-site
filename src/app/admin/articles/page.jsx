import { GenericDraftWorkspace } from "@/components/admin-newsroom/GenericDraftWorkspace";
import { getVariationOptions } from "@/lib/newsroom/contentAssignments";

export default function AdminArticlesPage() {
  return (
    <GenericDraftWorkspace
      title="Article draft desk"
      endpoint="/api/articles/generate"
      defaultPayload={{
        variation: "beat_report",
        articleRequest: {
          topic: "",
          seasonCode: "S0",
          seasonPhase: "preseason",
          seasonStatus: "in_progress",
          lifecycleNote:
            "Season 0 is ongoing. Do not write as if the season, preseason, standings race, or player stories are complete.",
          articleType: "beat_report",
        },
      }}
      variationOptions={getVariationOptions("league_article")}
    />
  );
}
