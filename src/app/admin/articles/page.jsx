import { GenericDraftWorkspace } from "@/components/admin-newsroom/GenericDraftWorkspace";
import { getVariationOptions } from "@/lib/newsroom/contentAssignments";

export default function AdminArticlesPage() {
  return (
    <GenericDraftWorkspace
      title="Article draft desk"
      endpoint="/api/articles/generate"
      defaultPayload={{
        variation: "beat_report",
        promptConfig: {
          draftType: "league_article",
          voiceMode: "Official Recap",
          intensity: "Balanced",
          coverageFocus: ["standings impact", "player form", "notable moments"],
          mustMention: ["season phase", "current board"],
          avoid: ["final-season language", "unsupported rivalries"],
          length: "medium",
          format: "news_article",
          audience: "public_league",
          customInstruction: "Write as current league coverage with an ongoing preseason frame.",
        },
        articleRequest: {
          topic: "",
          seasonCode: "S0",
          seasonPhase: "preseason",
          seasonStatus: "in_progress",
          lifecycleNote:
            "Season 0 is ongoing. Do not write as if the season, preseason, standings race, or player stories are complete.",
          articleType: "beat_report",
          promptConfig: {
            draftType: "league_article",
            voiceMode: "Official Recap",
            intensity: "Balanced",
            coverageFocus: ["standings impact", "player form", "notable moments"],
            mustMention: ["season phase", "current board"],
            avoid: ["final-season language", "unsupported rivalries"],
            length: "medium",
            format: "news_article",
            audience: "public_league",
            customInstruction: "Write as current league coverage with an ongoing preseason frame.",
          },
        },
      }}
      variationOptions={getVariationOptions("league_article")}
    />
  );
}
