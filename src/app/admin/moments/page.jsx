import { GenericDraftWorkspace } from "@/components/admin-newsroom/GenericDraftWorkspace";
import { MomentCandidateList } from "@/components/admin-newsroom/MomentCandidateList";
import { MomentVideoManager } from "@/components/admin-newsroom/MomentVideoManager";
import { getVariationOptions } from "@/lib/newsroom/contentAssignments";
import { text } from "@/lib/newsroom/data";
import { listNewsroomDrafts } from "@/lib/newsroom/drafts";
import { buildMomentsViewModel } from "@/lib/newsroom/viewModels/moments";

export const dynamic = "force-dynamic";

export default async function AdminMomentsPage() {
  const viewModel = await buildMomentsViewModel();
  const detectedMoments = viewModel.detectedMoments || viewModel.moments || [];
  const firstMoment = detectedMoments[0] || {};
  const momentDrafts = await listNewsroomDrafts({ table: "moment_blurb_drafts", fallbackScope: "moment" });
  const payloadOptions = detectedMoments
    .slice(0, 24)
    .map((moment) => {
      const momentId = text(moment.id || moment.hand_id || moment.momentId);
      return {
        id: momentId,
        label: `${moment.hand_no ? `Hand #${moment.hand_no}` : "Moment"}${moment.playerName ? ` / ${moment.playerName}` : ""}`,
        description: [moment.sessionCode, moment.potText, moment.detectionReason].filter(Boolean).join(" / "),
        patch: {
          momentId,
        },
      };
    })
    .filter((option) => option.id);
  const videoMomentOptions = detectedMoments
    .map((moment) => {
      const momentId = text(moment.id || moment.hand_id || moment.momentId);
      return {
        id: momentId,
        label: `${moment.hand_no ? `Hand #${moment.hand_no}` : "Moment"}${moment.playerName ? ` / ${moment.playerName}` : ""}`,
        description: [moment.sessionCode, moment.potText, moment.detectionReason].filter(Boolean).join(" / "),
        video: moment.video || null,
      };
    })
    .filter((option) => option.id);

  return (
    <GenericDraftWorkspace
      title="Moment blurb draft desk"
      endpoint="/api/moments/generate"
      defaultPayload={{
        momentId: text(firstMoment.id || firstMoment.hand_id || firstMoment.momentId),
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
      preface={
        <div className="grid gap-8">
          <MomentCandidateList moments={detectedMoments} />
          <MomentVideoManager moments={videoMomentOptions} />
        </div>
      }
      payloadOptions={payloadOptions}
      payloadOptionsTitle="Select a detected moment to draft"
    />
  );
}
