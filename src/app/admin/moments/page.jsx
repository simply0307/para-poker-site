import { GenericDraftWorkspace } from "@/components/admin-newsroom/GenericDraftWorkspace";
import { getVariationOptions } from "@/lib/newsroom/contentAssignments";
import { getMomentsIndex, text } from "@/lib/newsroom/data";
import { listNewsroomDrafts } from "@/lib/newsroom/drafts";

export const dynamic = "force-dynamic";

export default async function AdminMomentsPage() {
  const moments = await getMomentsIndex();
  const firstMoment = moments[0] || {};
  const momentDrafts = await listNewsroomDrafts({ table: "moment_blurb_drafts", fallbackScope: "moment" });

  return (
    <GenericDraftWorkspace
      title="Moment blurb draft desk"
      endpoint="/api/moments/generate"
      defaultPayload={{
        momentId: text(firstMoment.id),
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
    />
  );
}
