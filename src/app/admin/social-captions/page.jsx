import { GenericDraftWorkspace } from "@/components/admin-newsroom/GenericDraftWorkspace";
import { getVariationOptions } from "@/lib/newsroom/contentAssignments";
import { listNewsroomDrafts } from "@/lib/newsroom/drafts";

export const dynamic = "force-dynamic";

export default async function AdminSocialCaptionsPage() {
  const socialDrafts = await listNewsroomDrafts({ table: "social_caption_drafts", fallbackScope: "social_caption" });

  return (
    <GenericDraftWorkspace
      title="Social caption desk"
      endpoint="/api/social-captions/generate"
      defaultPayload={{
        sourceType: "session",
        sessionId: "S0-001",
        playerId: "",
        momentId: "",
        seasonCode: "S0",
        variation: "recap_card",
        editorialNotes: "",
        promptConfig: {
          draftType: "social_caption",
          voiceMode: "Social Caption",
          intensity: "Loud",
          coverageFocus: ["winner", "biggest pot", "notable moments"],
          mustMention: [],
          avoid: ["too much explanation", "generic sports filler", "unsupported rivalry"],
          length: "short",
          format: "social_caption",
          audience: "social",
          customInstruction: "Make it fast, player-facing, and built for a Para League social card.",
        },
      }}
      variationOptions={getVariationOptions("social_caption")}
      defaultPromptPreset="social_caption"
      existingDrafts={socialDrafts}
      existingDraftsTitle="Social caption drafts"
      initialDraft={socialDrafts[0] || null}
    />
  );
}
