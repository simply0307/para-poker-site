import { GenericDraftWorkspace } from "@/components/admin-newsroom/GenericDraftWorkspace";
import { getVariationOptions } from "@/lib/newsroom/contentAssignments";
import { cleanName, formatDate, formatNumber, getPlayersIndex, getSessionsIndex, getStandingsRows, text } from "@/lib/newsroom/data";
import { listArticleDrafts } from "@/lib/newsroom/drafts";
import { DEFAULT_ARTICLE_CONTEXT_SELECTION } from "@/lib/newsroom/articleContextSelection";
import { buildMomentsViewModel } from "@/lib/newsroom/viewModels/moments";

export const dynamic = "force-dynamic";

export default async function AdminArticlesPage() {
  const [articleDrafts, sessions, players, standingsRows, momentsViewModel] = await Promise.all([
    listArticleDrafts(),
    getSessionsIndex(),
    getPlayersIndex(),
    getStandingsRows("S0"),
    buildMomentsViewModel(),
  ]);
  const standingsByPlayerId = new Map((standingsRows || []).map((row) => [String(row.player_id), row]));
  const articleContextOptions = {
    sessions: (sessions || []).map((session) => ({
      id: text(session.session_code || session.id),
      label: text(session.session_code || session.id),
      date: formatDate(session.played_at),
      handsText: session.hands_count ? `${formatNumber(session.hands_count)} hands` : "",
      status: text(session.status),
    })).filter((session) => session.id),
    players: (players || []).map((player) => {
      const standings = standingsByPlayerId.get(String(player.id)) || {};
      return {
        id: text(player.slug || player.id),
        label: cleanName(player.display_name || player.pokernow_name || player.slug),
        rankText: standings.rank ? `Rank ${standings.rank}` : "",
        pointsText: standings.points ? `${formatNumber(standings.points)} points` : "",
      };
    }).filter((player) => player.id),
    moments: (momentsViewModel.detectedMoments || momentsViewModel.moments || []).slice(0, 40).map((moment) => ({
      id: text(moment.id || moment.hand_id || moment.momentId),
      label: `${moment.hand_no ? `Hand #${moment.hand_no}` : "Moment"}${moment.playerName ? ` / ${moment.playerName}` : ""}`,
      sessionCode: text(moment.sessionCode),
      potText: text(moment.potText),
      reason: text(moment.detectionReason || moment.typeLabels?.join(", ")),
    })).filter((moment) => moment.id),
    standings: (standingsRows || []).map((row) => ({
      playerName: cleanName(row.player_name),
      rank: row.rank,
      points: row.points,
    })),
  };

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
          contextSelection: DEFAULT_ARTICLE_CONTEXT_SELECTION,
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
      articleContextOptions={articleContextOptions}
    />
  );
}
