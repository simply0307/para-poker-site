import { ArticleVideoManager } from "@/components/admin-newsroom/ArticleVideoManager";
import { GenericDraftWorkspace } from "@/components/admin-newsroom/GenericDraftWorkspace";
import { cleanName, formatDate, formatNumber, getPlayersIndex, getSessionsIndex, getStandingsRows, text } from "@/lib/newsroom/data";
import { listArticleDrafts } from "@/lib/newsroom/drafts";
import { readSeasonSettings } from "@/lib/newsroom/seasonSettings";
import { DEFAULT_ARTICLE_CONTEXT_SELECTION } from "@/lib/newsroom/articleContextSelection";
import { buildMomentsViewModel } from "@/lib/newsroom/viewModels/moments";
import { getArticleVideoAttachments } from "@/lib/newsroom/articleVideoAttachments";

export const dynamic = "force-dynamic";

export default async function AdminArticlesPage() {
  const seasonSettings = await readSeasonSettings();
  const [articleDrafts, sessions, players, standingsRows, momentsViewModel] = await Promise.all([
    listArticleDrafts(),
    getSessionsIndex(seasonSettings.activeSeasonCode),
    getPlayersIndex(),
    getStandingsRows(seasonSettings.activeSeasonCode),
    buildMomentsViewModel(),
  ]);
  const standingsByPlayerId = new Map((standingsRows || []).map((row) => [String(row.player_id), row]));
  const articleVideoMap = await getArticleVideoAttachments((articleDrafts || []).map((article) => article.id));
  const articleVideoOptions = (articleDrafts || [])
    .map((article) => {
      const title = article.draft?.headline || article.draft?.title || article.article_request?.topic || "Untitled article";
      const author = article.draft?.author || article.draft?.byline || article.article_request?.authorName || article.article_request?.author_name || "";
      const date = article.article_request?.displayDate || article.article_request?.display_date || article.published_at || article.generated_at || "";
      return {
        id: text(article.id),
        label: text(title, "Untitled article"),
        description: [author, date ? formatDate(date) : "", article.article_request?.slug ? `/${article.article_request.slug}` : ""].filter(Boolean).join(" / "),
        video: articleVideoMap[article.id] || null,
      };
    })
    .filter((article) => article.id);
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
      draftType="league_article"
      title="Article draft desk"
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
          seasonCode: seasonSettings.activeSeasonCode,
          seasonPhase: seasonSettings.seasonPhase,
          seasonStatus: seasonSettings.seasonStatus,
          lifecycleNote: seasonSettings.lifecycleNote,
          articleType: "beat_report",
          authorName: "Para League Desk",
          displayDate: new Date().toISOString().slice(0, 10),
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
      existingDrafts={articleDrafts}
      existingDraftsTitle="Live articles"
      initialDraft={articleDrafts[0] || null}
      articleContextOptions={articleContextOptions}
      preface={<ArticleVideoManager articles={articleVideoOptions} />}
    />
  );
}
