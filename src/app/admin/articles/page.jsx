import { GenericDraftWorkspace } from "@/components/admin-newsroom/GenericDraftWorkspace";
import { getVariationOptions } from "@/lib/newsroom/contentAssignments";
import { listArticleDrafts } from "@/lib/newsroom/drafts";

export const dynamic = "force-dynamic";

export default async function AdminArticlesPage() {
  const articleDrafts = await listArticleDrafts();

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
      defaultPromptPreset="official_session_recap"
      existingDrafts={articleDrafts}
      existingDraftsTitle="Live articles"
      initialDraft={articleDrafts[0] || null}
    />
  );
}
