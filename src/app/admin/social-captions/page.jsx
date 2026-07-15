import { GenericDraftWorkspace } from "@/components/admin-newsroom/GenericDraftWorkspace";
import { listNewsroomDrafts } from "@/lib/newsroom/drafts";
import { readSeasonSettings } from "@/lib/newsroom/seasonSettings";

export const dynamic = "force-dynamic";

export default async function AdminSocialCaptionsPage() {
  const [socialDrafts, seasonSettings] = await Promise.all([
    listNewsroomDrafts({ table: "social_caption_drafts", fallbackScope: "social_caption" }),
    readSeasonSettings(),
  ]);

  return (
    <GenericDraftWorkspace
      draftType="social_caption"
      title="Social caption desk"
      defaultPayload={{
        sourceType: "session",
        sessionId: "S0-001",
        playerId: "",
        momentId: "",
        seasonCode: seasonSettings.activeSeasonCode,
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
      existingDrafts={socialDrafts}
      existingDraftsTitle="Social caption drafts"
      initialDraft={socialDrafts[0] || null}
    />
  );
}
