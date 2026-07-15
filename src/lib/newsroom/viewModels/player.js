import { getPublishedDraft } from "@/lib/newsroom/repositories/draftRepository";
import { applyOverridesToEntity, applyOverridesToList, readActiveDataOverrides } from "@/lib/newsroom/applyDataOverrides";
import { cleanName, getPlayerNewsroomData, getPlayerSessionMap } from "@/lib/newsroom/repositories/playerRepository";

function present(value) {
  return value !== null && value !== undefined && value !== "";
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function maxNumber(rows, keys) {
  const values = rows.flatMap((row) => keys.map((key) => numberValue(row?.[key]))).filter((value) => value !== null);
  return values.length ? Math.max(...values) : null;
}

function sumNumber(rows, keys) {
  const values = rows.flatMap((row) => keys.map((key) => numberValue(row?.[key]))).filter((value) => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

function bestFinish(results) {
  const finishes = results.map((row) => numberValue(row.finish)).filter((value) => value !== null);
  return finishes.length ? Math.min(...finishes) : null;
}

function firstPresent(...values) {
  return values.find((value) => present(value));
}

function playerImage(player) {
  return firstPresent(player.avatar_url, player.image_url, player.photo_url, player.profile_image_url, player.headshot_url);
}

function buildPlayerPokerStats(player, sessionStats = [], sessionResults = [], notableHands = [], standings = null) {
  const latestWithVpip = sessionStats.find((row) => present(row.vpip_pct) || present(row.vpip));
  const latestWithPfr = sessionStats.find((row) => present(row.pfr_pct) || present(row.pfr));
  const totalHands = sumNumber(sessionStats, ["hands", "hands_played", "hand_count"]);
  const biggestPot = Math.max(
    0,
    ...sessionStats.map((row) => Number(row.biggest_pot_won || row.biggest_pot || row.largest_pot || 0)),
    ...notableHands.map((row) => Number(row.pot_collected || 0))
  );

  return {
    hands: totalHands || null,
    vpip: latestWithVpip ? latestWithVpip.vpip_pct || latestWithVpip.vpip : null,
    pfr: latestWithPfr ? latestWithPfr.pfr_pct || latestWithPfr.pfr : null,
    vpipSource: latestWithVpip ? "stored" : "unavailable",
    pfrSource: latestWithPfr ? "stored" : "unavailable",
    sessions: standings?.sessions_played || sessionResults.length || sessionStats.length || null,
    points: standings?.total_points || standings?.points || standings?.league_points || sessionResults.reduce((sum, row) => sum + Number(row.league_points || row.points || 0), 0) || null,
    bestFinish: standings?.best_finish || bestFinish(sessionResults),
    biggestPot: biggestPot || null,
    wins: standings?.wins || null,
    topFinishes: standings?.top_3s || standings?.top_4s || null,
    source: {
      vpip: latestWithVpip ? "stored" : "missing",
      pfr: latestWithPfr ? "stored" : "missing",
    },
  };
}

export async function buildPlayerViewModel(playerIdOrSlug, options = {}) {
  const playerData = await getPlayerNewsroomData(playerIdOrSlug, options.seasonCode || "S0");
  if (!playerData?.player) return null;

  const overrides = await readActiveDataOverrides();
  const playerOverride = applyOverridesToEntity(playerData.player, "player", overrides);
  const standingsOverride = applyOverridesToList(playerData.standings || [], "standings", overrides);
  const statsOverride = applyOverridesToList(playerData.sessionStats || [], "player", overrides);
  const resultsOverride = applyOverridesToList(playerData.sessionResults || [], "player", overrides);
  const momentsOverride = applyOverridesToList(playerData.moments || [], "moment", overrides);
  const contestedMomentsOverride = applyOverridesToList(playerData.contestedMoments || [], "moment", overrides);
  const player = playerOverride.value;
  const standings = standingsOverride.value;
  const sessionStats = statsOverride.value;
  const sessionResults = resultsOverride.value;
  const moments = momentsOverride.value;
  const contestedMoments = contestedMomentsOverride.value;
  const appliedOverrides = [
    ...playerOverride.appliedOverrides,
    ...standingsOverride.appliedOverrides,
    ...statsOverride.appliedOverrides,
    ...resultsOverride.appliedOverrides,
    ...momentsOverride.appliedOverrides,
    ...contestedMomentsOverride.appliedOverrides,
  ];
  const [publishedDraft, sessionMap] = await Promise.all([
    getPublishedDraft({ scope: "player", sourcePlayerId: player.id }),
    getPlayerSessionMap(),
  ]);
  const standing = standings[0] || {};
  const pokerStats = buildPlayerPokerStats(player, sessionStats, sessionResults, moments, standing);
  const displayName = cleanName(player.display_name || player.pokernow_name || player.slug);
  const statCards = [
    ["Rank", firstPresent(standing.rank, standing.current_rank)],
    ["Points", firstPresent(standing.points, standing.league_points, standing.total_points, pokerStats.points)],
    ["Tracked hands", pokerStats.hands],
    ["Biggest pot", maxNumber(sessionStats, ["biggest_pot_won", "biggest_pot", "largest_pot"]) || pokerStats.biggestPot],
    ["Best result", pokerStats.bestFinish ? `#${pokerStats.bestFinish}` : ""],
    ["Sessions", pokerStats.sessions],
  ].filter(([, value]) => present(value));
  const recentSessions = (sessionStats.length ? sessionStats : sessionResults)
    .map((row) => ({
      ...row,
      session: sessionMap.get(String(row.session_id)) || null,
      result: sessionResults.find((result) => String(result.session_id) === String(row.session_id)) || row,
    }))
    .slice(0, 8);

  return {
    player,
    rawPlayer: playerData.player,
    displayName,
    image: playerImage(player),
    publishedDraft,
    standings,
    standing,
    rank: firstPresent(standing.rank, standing.current_rank),
    points: firstPresent(standing.points, standing.league_points, standing.total_points, pokerStats.points),
    sessionsPlayed: pokerStats.sessions,
    sessionStats,
    sessionResults,
    recentSessions,
    moments,
    wonMoments: moments,
    contestedMoments,
    involvedMoments: [...moments, ...contestedMoments],
    notableHands: moments,
    pokerStats,
    statCards,
    statCardMap: new Map(statCards.map(([label, value]) => [label, value])),
    appliedOverrides,
  };
}
