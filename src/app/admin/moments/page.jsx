import { GenericDraftWorkspace } from "@/components/admin-newsroom/GenericDraftWorkspace";
import { MomentVideoManager } from "@/components/admin-newsroom/MomentVideoManager";
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
    .flatMap((moment) => {
      const momentId = text(moment.id || moment.hand_id || moment.momentId);
      if (!momentId) return [];
      const contenderNames = Array.isArray(moment.involved_players)
        ? moment.involved_players.filter((name) => text(name) && text(name) !== text(moment.winner_name))
        : [];
      const baseLabel = `${moment.hand_no ? `Hand #${moment.hand_no}` : "Moment"}${moment.potText ? ` / ${moment.potText}` : ""}`;
      const description = [moment.sessionCode, moment.detectionReason].filter(Boolean).join(" / ");
      const options = [
        {
          id: `${momentId}-winner`,
          label: `${baseLabel} / Cover winner: ${moment.playerName || moment.winner_name || "Winner"}`,
          description,
          patch: {
            momentId,
            coverageTarget: {
              role: "winner",
              playerName: text(moment.winner_name || moment.playerName),
            },
          },
        },
      ];
      for (const contender of contenderNames) {
        options.push({
          id: `${momentId}-contender-${contender}`,
          label: `${baseLabel} / Cover contender: ${contender}`,
          description,
          patch: {
            momentId,
            coverageTarget: {
              role: "contender",
              playerName: contender,
            },
          },
        });
      }
      return options;
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
      draftType="moment_blurb"
      title="Moment blurb draft desk"
      defaultPayload={{
        momentId: text(firstMoment.id || firstMoment.hand_id || firstMoment.momentId),
        coverageTarget: {
          role: "winner",
          playerName: text(firstMoment.winner_name || firstMoment.playerName),
        },
        variation: "pressure_moment",
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
      existingDrafts={momentDrafts}
      existingDraftsTitle="Moment drafts"
      initialDraft={momentDrafts[0] || null}
      preface={<MomentVideoManager moments={videoMomentOptions} />}
      payloadOptions={payloadOptions}
      payloadOptionsTitle="Select a detected moment to draft"
    />
  );
}
