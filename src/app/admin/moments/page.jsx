import { GenericDraftWorkspace } from "@/components/admin-newsroom/GenericDraftWorkspace";
import { MomentCandidateList } from "@/components/admin-newsroom/MomentCandidateList";
import { getVariationOptions } from "@/lib/newsroom/contentAssignments";
import { text } from "@/lib/newsroom/data";
import { listNewsroomDrafts } from "@/lib/newsroom/drafts";
import { buildMomentsViewModel } from "@/lib/newsroom/viewModels/moments";

export const dynamic = "force-dynamic";

export default async function AdminMomentsPage() {
  const viewModel = await buildMomentsViewModel();
  const firstMoment = viewModel.featuredMoment || viewModel.moments[0] || {};
  const momentDrafts = await listNewsroomDrafts({ table: "moment_blurb_drafts", fallbackScope: "moment" });

  return (
    <GenericDraftWorkspace
      title="Moment blurb draft desk"
      endpoint="/api/moments/generate"
      defaultPayload={{
        momentId: text(firstMoment.id || firstMoment.momentId),
        variation: "impact_blurb",
        editorialNotes: "",
        promptConfig: {
          draftType: "moment_blurb",
          voiceMode: "Moment Archive",
          intensity: "Punchy",
          coverageFocus: ["biggest pot", "notable moments", "specific hand numbers"],
          mustMention: ["hand number", "winner", "pot"],
          avoid: ["unsupported hand action", "fake emotion"],
          length: "short",
          format: "archive_blurb",
          audience: "public_player",
          customInstruction: "Make the moment feel memorable without inflating unsupported facts.",
        },
      }}
      variationOptions={getVariationOptions("moment_blurb")}
      defaultPromptPreset="moment_archive_note"
      existingDrafts={momentDrafts}
      existingDraftsTitle="Moment drafts"
      initialDraft={momentDrafts[0] || null}
      preface={<MomentCandidateList moments={viewModel.moments} />}
    />
  );
}
