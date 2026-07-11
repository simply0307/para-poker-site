import {
  getMomentsIndex,
  getPlayersIndex,
  getSessionNewsroomData,
  getSessionsIndex,
  getStandingsRows,
} from "@/lib/newsroom/data";
import { getPublishedArticlesIndex } from "@/lib/newsroom/repositories/draftRepository";

export const DEFAULT_HOME_MODULES = [
  { type: "hero_board", enabled: true },
  { type: "stat_strip", enabled: true },
  { type: "latest_session", enabled: true },
  { type: "current_standings", enabled: true },
  { type: "featured_players", enabled: true },
  { type: "featured_moments", enabled: true },
  { type: "latest_articles", enabled: true },
];

export async function buildHomeViewModel(moduleConfig = DEFAULT_HOME_MODULES) {
  const [sessions, standings, moments, players, articles] = await Promise.all([
    getSessionsIndex(),
    getStandingsRows("S0"),
    getMomentsIndex(),
    getPlayersIndex(),
    getPublishedArticlesIndex(),
  ]);
  const latest = sessions[0] || null;
  const latestData = latest ? await getSessionNewsroomData(latest.session_code || latest.id) : null;
  const winner = latestData?.sessionResults?.[0] || null;
  const biggestPot = [...(latestData?.hands || []), ...(latestData?.notableHands || [])]
    .filter((hand) => hand?.pot_collected)
    .sort((left, right) => Number(right.pot_collected || 0) - Number(left.pot_collected || 0))[0] || null;

  return {
    modules: moduleConfig.filter((module) => module.enabled !== false),
    sessions,
    standings,
    moments,
    players,
    articles,
    latest,
    latestData,
    winner,
    biggestPot,
  };
}
