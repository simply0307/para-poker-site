import { GenericDraftWorkspace } from "@/components/admin-newsroom/GenericDraftWorkspace";
import { MomentCurationPanel } from "@/components/admin-newsroom/MomentCurationPanel";
import { MomentVideoManager } from "@/components/admin-newsroom/MomentVideoManager";
import { cleanName, text } from "@/lib/newsroom/data";
import { listNewsroomDrafts } from "@/lib/newsroom/drafts";
import { readMomentCurationSettings } from "@/lib/newsroom/momentCurationSettings";
import { buildMomentsViewModel } from "@/lib/newsroom/viewModels/moments";

export const dynamic = "force-dynamic";

export default async function AdminMomentsPage() {
  const [viewModel, curationSettings] = await Promise.all([buildMomentsViewModel(), readMomentCurationSettings()]);
  const detectedMoments = viewModel.detectedMoments || viewModel.moments || [];
  const firstMoment = detectedMoments[0] || {};
  const momentDrafts = await listNewsroomDrafts({ table: "moment_blurb_drafts", fallbackScope: "moment" });
  const payloadOptions = detectedMoments
    .sort((left, right) =>
      text(right.sessionCode).localeCompare(text(left.sessionCode)) ||
      Number(right.pot_bb || 0) - Number(left.pot_bb || 0) ||
      Number(right.pot_collected || 0) - Number(left.pot_collected || 0)
    )
    .flatMap((moment) => {
      const momentId = text(moment.id || moment.hand_id || moment.momentId);
      if (!momentId) return [];
      const contenderNames = Array.isArray(moment.involved_players)
        ? moment.involved_players.filter((name) => text(name) && text(name) !== text(moment.winner_name))
        : [];
      const baseLabel = `${moment.sessionCode ? `${moment.sessionCode} / ` : ""}${moment.hand_no ? `Hand #${moment.hand_no}` : "Moment"}${moment.potText ? ` / ${moment.potText}` : ""}`;
      const description = [
        moment.sessionCode,
        moment.statusLabels?.length ? `Status: ${moment.statusLabels.join(", ")}` : "",
        moment.typeLabels?.length ? `Type: ${moment.typeLabels.join(", ")}` : "",
        moment.detectionReason,
      ].filter(Boolean).join(" / ");
      const options = [
        {
          id: `${momentId}-winner`,
          label: `${baseLabel} / Cover winner: ${cleanName(moment.playerName || moment.winner_name, "Winner")}`,
          description,
          patch: {
            momentId,
            coverageTarget: {
              role: "winner",
              playerName: cleanName(moment.winner_name || moment.playerName, ""),
            },
          },
        },
      ];
      for (const contender of contenderNames) {
        options.push({
          id: `${momentId}-contender-${contender}`,
          label: `${baseLabel} / Cover contender: ${cleanName(contender, "Contender")}`,
          description,
          patch: {
            momentId,
            coverageTarget: {
              role: "contender",
              playerName: cleanName(contender, ""),
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
        label: `${moment.hand_no ? `Hand #${moment.hand_no}` : "Moment"}${moment.playerName ? ` / ${cleanName(moment.playerName)}` : ""}`,
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
          playerName: cleanName(firstMoment.winner_name || firstMoment.playerName, ""),
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
      preface={
        <div className="grid gap-6">
          <section className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Detected candidates</p>
            <h2 className="mt-1 text-2xl font-black">Moment coverage by session</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Detected candidates are drafting targets. They become public only after a blurb is published or an admin marks them featured/major.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {(viewModel.sessionBreakdown || []).map((row) => (
                <div key={row.sessionCode} className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                  <p className="font-black">{row.sessionCode}</p>
                  <p className="mt-1 text-sm text-zinc-600">{row.detected} detected / {row.public} public</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wide text-zinc-500">{row.published} published / {row.featuredOrMajor} featured-major</p>
                </div>
              ))}
            </div>
          </section>
          <MomentCurationPanel moments={videoMomentOptions} initialSettings={curationSettings} />
          <MomentVideoManager moments={videoMomentOptions} />
        </div>
      }
      payloadOptions={payloadOptions}
      payloadOptionsTitle="Select a detected moment to draft"
    />
  );
}
