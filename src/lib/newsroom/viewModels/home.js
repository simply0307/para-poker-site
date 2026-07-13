import {
  getPlayersIndex,
  getSessionNewsroomData,
  getSessionsIndex,
  getStandingsRows,
} from "@/lib/newsroom/data";
import { DEFAULT_HOME_SETTINGS, readHomepageSettings } from "@/lib/newsroom/homepageSettings";
import { getPublishedArticlesIndex } from "@/lib/newsroom/repositories/draftRepository";
import { getPublicUpcomingEvents } from "@/lib/newsroom/upcomingEvents";
import { buildMomentsViewModel } from "@/lib/newsroom/viewModels/moments";

export const DEFAULT_HOME_MODULES = DEFAULT_HOME_SETTINGS.modules;

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function idMatches(item = {}, id = "") {
  const key = text(id).trim();
  if (!key) return false;
  return [
    item.id,
    item.slug,
    item.session_code,
    item.sessionCode,
    item.momentId,
    item.event_id,
    item.hand_id,
  ].map((value) => text(value)).filter(Boolean).includes(key);
}

function selectedItems(items = [], selectedIds = [], limit = 3) {
  if (!selectedIds?.length) return [];
  const selected = selectedIds
    .map((id) => items.find((item) => idMatches(item, id)))
    .filter(Boolean);
  return selected.slice(0, limit);
}

function limited(items = [], limit = 3) {
  return (items || []).filter(Boolean).slice(0, limit);
}

function playerSortValue(row = {}) {
  const rank = Number(row.rank);
  return Number.isFinite(rank) ? rank : 999;
}

function resolveHeroSelection(homepageModule, context) {
  const selectedId = homepageModule.selectedIds?.[0] || "";
  if (homepageModule.sourceMode === "league_board") return { kind: "league_board", item: null };
  if (homepageModule.sourceMode === "manual" && selectedId.startsWith("article:")) {
    const articleId = selectedId.slice(8);
    const item = context.articles.find((article) => idMatches(article, articleId)) || null;
    return item ? { kind: "article", item } : { kind: "latest_session", item: context.latest, warning: "Selected article is unavailable; showing latest session." };
  }
  if (homepageModule.sourceMode === "manual") {
    const sessionId = selectedId.startsWith("session:") ? selectedId.slice(8) : selectedId;
    const item = context.sessions.find((session) => idMatches(session, sessionId)) || null;
    return item ? { kind: "session", item } : { kind: "latest_session", item: context.latest, warning: "Selected session is unavailable; showing latest session." };
  }
  return { kind: "latest_session", item: context.latest };
}

function resolveModuleContent(homepageModule, context) {
  const limit = homepageModule.itemLimit || 3;
  if (homepageModule.type === "hero_board") {
    return { ...homepageModule, resolvedContent: [resolveHeroSelection(homepageModule, context)] };
  }
  if (homepageModule.type === "latest_session") {
    const manual = homepageModule.sourceMode === "manual"
      ? selectedItems(context.sessions, homepageModule.selectedIds, 1)
      : [];
    return {
      ...homepageModule,
      resolvedContent: manual.length ? manual : limited(context.sessions, 1),
      warnings: homepageModule.sourceMode === "manual" && !manual.length && homepageModule.selectedIds?.length
        ? ["Selected session is unavailable; showing latest session."]
        : [],
    };
  }
  if (homepageModule.type === "upcoming_events") {
    const manual = homepageModule.sourceMode === "manual"
      ? selectedItems(context.events, homepageModule.selectedIds, limit)
      : [];
    return {
      ...homepageModule,
      resolvedContent: manual.length ? manual : limited(context.events, limit),
      warnings: homepageModule.sourceMode === "manual" && homepageModule.selectedIds?.length && !manual.length
        ? ["Selected events are unavailable; showing automatic upcoming events."]
        : [],
    };
  }
  if (homepageModule.type === "featured_players") {
    const standingsByPlayer = new Map((context.standings || []).map((row) => [String(row.player_id || row.player_name), row]));
    const automaticPlayers = [...(context.players || [])].sort((left, right) => {
      const leftRow = standingsByPlayer.get(String(left.id)) || context.standings.find((row) => row.player_name === left.display_name) || {};
      const rightRow = standingsByPlayer.get(String(right.id)) || context.standings.find((row) => row.player_name === right.display_name) || {};
      return playerSortValue(leftRow) - playerSortValue(rightRow);
    });
    const manual = homepageModule.sourceMode === "manual"
      ? selectedItems(context.players, homepageModule.selectedIds, limit)
      : [];
    return {
      ...homepageModule,
      resolvedContent: manual.length ? manual : limited(automaticPlayers, limit),
      warnings: homepageModule.sourceMode === "manual" && homepageModule.selectedIds?.length && !manual.length
        ? ["Selected players are unavailable; showing automatic players."]
        : [],
    };
  }
  if (homepageModule.type === "featured_moments") {
    const manual = homepageModule.sourceMode === "manual"
      ? selectedItems(context.moments, homepageModule.selectedIds, limit)
      : [];
    return {
      ...homepageModule,
      resolvedContent: manual.length ? manual : limited(context.moments, limit),
      warnings: homepageModule.sourceMode === "manual" && homepageModule.selectedIds?.length && !manual.length
        ? ["Selected moments are unavailable; showing automatic moments."]
        : [],
    };
  }
  if (homepageModule.type === "latest_articles") {
    const manual = homepageModule.sourceMode === "manual"
      ? selectedItems(context.articles, homepageModule.selectedIds, limit)
      : [];
    return {
      ...homepageModule,
      resolvedContent: manual.length ? manual : limited(context.articles, limit),
      warnings: homepageModule.sourceMode === "manual" && homepageModule.selectedIds?.length && !manual.length
        ? ["Selected articles are unavailable; showing latest published articles."]
        : [],
    };
  }
  return { ...homepageModule, resolvedContent: [] };
}

export async function buildHomeViewModel(moduleConfig = null) {
  const settings = moduleConfig ? { hero: DEFAULT_HOME_SETTINGS.hero, modules: moduleConfig } : await readHomepageSettings();
  const [sessions, standings, momentModel, players, articles, events] = await Promise.all([
    getSessionsIndex(),
    getStandingsRows("S0"),
    buildMomentsViewModel(),
    getPlayersIndex(),
    getPublishedArticlesIndex(),
    getPublicUpcomingEvents(),
  ]);
  const moments = momentModel.publicMoments || [];
  const latest = sessions[0] || null;
  const latestData = latest ? await getSessionNewsroomData(latest.session_code || latest.id) : null;
  const winner = latestData?.sessionResults?.[0] || null;
  const biggestPot = [...(latestData?.hands || []), ...(latestData?.notableHands || [])]
    .filter((hand) => hand?.pot_collected)
    .sort((left, right) => Number(right.pot_collected || 0) - Number(left.pot_collected || 0))[0] || null;

  const context = {
    sessions,
    standings,
    moments,
    players,
    articles,
    events,
    latest,
  };
  const modules = settings.modules
    .filter((module) => module.enabled !== false)
    .map((module) => resolveModuleContent(module, context));

  return {
    hero: settings.hero,
    modules,
    sessions,
    standings,
    moments,
    detectedMoments: momentModel.detectedMoments || [],
    players,
    articles,
    events,
    latest,
    latestData,
    winner,
    biggestPot,
  };
}
