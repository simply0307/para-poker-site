import {
  getMomentsIndex,
  getPlayersIndex,
  getSessionNewsroomData,
  getSessionsIndex,
  getStandingsRows,
} from "@/lib/newsroom/data";
import { DEFAULT_HOME_SETTINGS, readHomepageSettings } from "@/lib/newsroom/homepageSettings";
import { getPublishedArticlesIndex } from "@/lib/newsroom/repositories/draftRepository";

export const DEFAULT_HOME_MODULES = DEFAULT_HOME_SETTINGS.modules;

export async function buildHomeViewModel(moduleConfig = null) {
  const settings = moduleConfig ? { hero: DEFAULT_HOME_SETTINGS.hero, modules: moduleConfig } : await readHomepageSettings();
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
    hero: settings.hero,
    modules: settings.modules.filter((module) => module.enabled !== false),
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
