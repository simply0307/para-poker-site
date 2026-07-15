import { applyOverridesToEntity, applyOverridesToList, readActiveDataOverrides } from "@/lib/newsroom/applyDataOverrides";
import {
  cleanName,
  formatNumber,
  getMomentNewsroomData,
  getMomentsIndex,
  getPlayersIndex,
  getSessionNewsroomData,
  getSessionsIndex,
  normalizePlayerName,
  resolvePlayerIdentity,
  safeQuery,
  supabase,
  text,
} from "@/lib/newsroom/data";
import { normalizeHandRow } from "@/lib/poker/handHistory";
import { readMomentCurationSettings } from "@/lib/newsroom/momentCurationSettings";
import { getMomentVideoAttachments } from "@/lib/newsroom/momentVideoAttachments";

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dateValue(row = {}) {
  const value = row.created_at || row.updated_at || row.played_at || "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function truthy(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  return ["true", "yes", "1", "featured", "major", "pinned", "published"].includes(String(value || "").toLowerCase());
}

function rowTags(row = {}) {
  if (Array.isArray(row.tags)) return row.tags.map(String);
  if (typeof row.tags === "string") return row.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  return [];
}

function draftMomentKey(row = {}) {
  return text(row.moment_id || row.article_request?.momentId || row.article_request?.moment_id || row.context_packet?.momentId || row.context_packet?.moment_id);
}

function draftBody(row = {}) {
  if (!row) return {};
  return row.draft || row.body || {};
}

function draftSummary(row = {}) {
  if (!row) return "";
  const body = draftBody(row);
  return text(body.article_body || body.caption || body.subheadline || body.headline || body.recap_body || body.profile_body);
}

async function getPublishedMomentDraftRows() {
  const momentRows = await safeQuery(
    supabase
      .from("moment_blurb_drafts")
      .select("*")
      .eq("visibility", "published")
      .order("published_at", { ascending: false }),
    []
  );

  const recapRows = await safeQuery(
    supabase
      .from("recap_drafts")
      .select("*")
      .eq("scope", "moment")
      .eq("visibility", "published")
      .order("published_at", { ascending: false }),
    []
  );

  return [
    ...(momentRows || []).map((row) => ({ ...row, _draft_table: "moment_blurb_drafts" })),
    ...(recapRows || []).map((row) => ({ ...row, _draft_table: "recap_drafts" })),
  ];
}

function sessionMaps(sessions = []) {
  const byId = new Map();
  for (const session of sessions || []) {
    byId.set(String(session.id), session);
    if (session.session_code) byId.set(String(session.session_code), session);
  }
  return byId;
}

function detectMomentTypes(moment = {}, topPotCutoff = 0, session = null) {
  const tags = rowTags(moment).join(" ").toLowerCase();
  const summaryText = [moment.summary, moment.description, moment.public_summary, tags].map((value) => text(value).toLowerCase()).join(" ");
  const handNo = numberValue(moment.hand_no, null);
  const sessionHands = numberValue(session?.hands_count, null);
  const types = [];

  if (numberValue(moment.pot_collected) >= topPotCutoff && numberValue(moment.pot_collected) > 0) types.push("biggest_pot");
  if (moment.showdown || moment.board || moment.winning_hand) types.push("showdown");
  if (moment.winner_name || moment.winner_player_id) types.push("player_marker");
  if (sessionHands && handNo && handNo >= Math.max(1, Math.floor(sessionHands * 0.75))) types.push("late_hand");
  if (/turning point|turning|swing|late|big pot|all-in|all in|allin|pressure|separation/i.test(summaryText)) types.push("turning_point");
  if (!types.length) types.push("archive_marker");

  return [...new Set(types)];
}

function isExplicitlyFeatured(moment = {}, curationSettings = {}) {
  const momentId = text(moment.id || moment.hand_id || moment.momentId);
  return text(curationSettings.featuredMomentId) === momentId || truthy(moment.featured) || truthy(moment.is_featured) || truthy(moment.pinned) || truthy(moment.is_pinned);
}

function isExplicitlyMajor(moment = {}, curationSettings = {}) {
  const momentId = text(moment.id || moment.hand_id || moment.momentId);
  return (curationSettings.majorMomentIds || []).map(text).includes(momentId) || truthy(moment.major) || truthy(moment.is_major) || rowTags(moment).some((tag) => tag.toLowerCase() === "major");
}

function statusFor(moment = {}, publishedDraft = null, curationSettings = {}) {
  const statuses = ["detected"];
  if (isExplicitlyFeatured(moment, curationSettings)) statuses.push("featured");
  if (publishedDraft) statuses.push("published");
  if (isExplicitlyMajor(moment, curationSettings)) statuses.push("major");
  return statuses;
}

function labelForType(type) {
  return {
    biggest_pot: "Big Pot",
    turning_point: "Turning Point",
    player_marker: "Player Marker",
    showdown: "Showdown",
    archive_marker: "Archive Marker",
    late_hand: "Late Hand",
  }[type] || "Archive Marker";
}

function statusLabel(status) {
  return {
    detected: "Detected",
    featured: "Featured",
    published: "Published",
    major: "Major",
  }[status] || status;
}

function enrichMoment(moment, { session, player, publishedDraft, featuredId, topPotCutoff, curationSettings }) {
  const types = detectMomentTypes(moment, topPotCutoff, session);
  const momentId = text(moment.id || moment.hand_id || `${moment.session_id || "moment"}-${moment.hand_no}`);
  const isFeatured = momentId === text(featuredId);
  const statuses = statusFor(moment, publishedDraft, curationSettings);

  return {
    ...moment,
    momentId,
    detailHref: momentId ? `/moments/${encodeURIComponent(momentId)}` : "",
    session,
    sessionCode: text(session?.session_code || moment.session_code || moment.session_id),
    sessionHref: session?.session_code || moment.session_id ? `/sessions/${encodeURIComponent(text(session?.session_code || moment.session_id))}` : "",
    player,
    playerName: cleanName(player?.display_name || moment.winner_name, "Winner pending"),
    playerHref: player?.slug || player?.id ? `/players/${encodeURIComponent(text(player.slug || player.id))}` : "",
    types,
    type: types[0] || "archive_marker",
    typeLabel: labelForType(types[0]),
    typeLabels: types.map(labelForType),
    statuses,
    isPublic: statuses.some((status) => ["featured", "published", "major"].includes(status)),
    isFeatured,
    statusLabels: statuses.map(statusLabel),
    status: statuses.at(-1) || "detected",
    publishedDraft,
    publishedSummary: publishedDraft ? draftSummary(publishedDraft) : "",
    displaySummary: text(draftSummary(publishedDraft) || moment.public_summary || moment.summary || moment.description || moment.winning_hand || moment.board),
    potText: moment.pot_collected ? `${formatNumber(moment.pot_collected)} chips` : "",
    detectionReason: [
      numberValue(moment.pot_collected) > 0 ? `Pot: ${formatNumber(moment.pot_collected)} chips` : "",
      moment.winner_name ? `Winner: ${cleanName(moment.winner_name)}` : "",
      moment.board ? "Board stored" : "",
      moment.winning_hand ? "Winning hand stored" : "",
      types.map(labelForType).join(", "),
    ].filter(Boolean).join(" / "),
  };
}

function uniqueCount(values = []) {
  return new Set(values.map(text).filter(Boolean)).size;
}

export async function buildMomentsViewModel() {
  const [rawMoments, sessions, players, publishedMomentDrafts, overrides, curationSettings] = await Promise.all([
    getMomentsIndex(),
    getSessionsIndex(),
    getPlayersIndex(),
    getPublishedMomentDraftRows(),
    readActiveDataOverrides(),
    readMomentCurationSettings(),
  ]);

  const momentsOverride = applyOverridesToList(rawMoments || [], "moment", overrides);
  const moments = momentsOverride.value;
  const sessionsById = sessionMaps(sessions || []);
  const draftByMoment = new Map(publishedMomentDrafts.map((draft) => [draftMomentKey(draft), draft]).filter(([key]) => key));
  const sortedByPot = [...moments].filter((moment) => numberValue(moment.pot_collected) > 0).sort((left, right) => numberValue(right.pot_collected) - numberValue(left.pot_collected));
  const topPotCutoff = numberValue(sortedByPot[Math.min(4, sortedByPot.length - 1)]?.pot_collected, 0);
  const explicitFeatured = moments.find((moment) => isExplicitlyFeatured(moment, curationSettings));
  const featuredSource = explicitFeatured || null;
  const featuredId = text(featuredSource?.id || featuredSource?.hand_id || featuredSource?.momentId);

  const enriched = moments.map((moment) => {
    const session = sessionsById.get(String(moment.session_id)) || sessionsById.get(String(moment.session_code)) || null;
    const player = resolvePlayerIdentity(moment, players || []);
    return enrichMoment(moment, {
      session,
      player,
      publishedDraft: draftByMoment.get(text(moment.id)) || null,
      featuredId,
      topPotCutoff,
      curationSettings,
    });
  });

  const videoByMomentId = await getMomentVideoAttachments(enriched.map((moment) => text(moment.id || moment.hand_id || moment.momentId)));
  const enrichedWithVideo = enriched.map((moment) => {
    const videoKey = text(moment.id || moment.hand_id || moment.momentId);
    return {
      ...moment,
      video: videoByMomentId[videoKey] || null,
    };
  });

  const publicMoments = enrichedWithVideo.filter((moment) => moment.isPublic);
  const biggestPots = [...publicMoments].filter((moment) => numberValue(moment.pot_collected) > 0).sort((left, right) => numberValue(right.pot_collected) - numberValue(left.pot_collected)).slice(0, 5);
  const recentMoments = [...publicMoments].sort((left, right) => dateValue(right) - dateValue(left) || numberValue(right.hand_no) - numberValue(left.hand_no)).slice(0, 12);
  const featuredMoment = publicMoments.find((moment) => text(moment.momentId) === featuredId) || publicMoments.find((moment) => moment.statuses.includes("published")) || publicMoments[0] || null;
  const momentTypes = ["biggest_pot", "turning_point", "player_marker", "showdown", "archive_marker", "late_hand"].map((type) => ({
    type,
    label: labelForType(type),
    count: enrichedWithVideo.filter((moment) => moment.types.includes(type)).length,
  }));

  return {
    hero: {
      title: "Moment Archive",
      dek: "The hands the table remembers.",
    },
    moments: enrichedWithVideo,
    detectedMoments: enrichedWithVideo,
    publicMoments,
    featuredMoment,
    biggestPots,
    recentMoments,
    momentTypes,
    publishedMomentDrafts,
    curationSettings,
    appliedOverrides: momentsOverride.appliedOverrides,
    stats: {
      totalMoments: enrichedWithVideo.length,
      publicMoments: publicMoments.length,
      publishedMoments: publicMoments.filter((moment) => moment.statuses.includes("published")).length,
      featuredOrMajorMoments: publicMoments.filter((moment) => moment.statuses.includes("featured") || moment.statuses.includes("major")).length,
      biggestListedPot: biggestPots[0]?.pot_collected || null,
      videosAttached: enrichedWithVideo.filter((moment) => moment.video).length,
      sessionsRepresented: uniqueCount(enrichedWithVideo.map((moment) => moment.session_id || moment.sessionCode)),
      playersRepresented: uniqueCount(enrichedWithVideo.map((moment) => normalizePlayerName(moment.winner_name))),
    },
  };
}

export async function buildMomentViewModel(momentId) {
  const [momentData, listModel] = await Promise.all([
    getMomentNewsroomData(momentId),
    buildMomentsViewModel(),
  ]);
  if (!momentData?.moment) return null;

  const enriched = listModel.moments.find((moment) =>
    text(moment.id || moment.hand_id || moment.momentId) === text(momentData.moment.id || momentData.moment.hand_id)
  ) || null;
  const sessionData = momentData.session ? await getSessionNewsroomData(momentData.session.id || momentData.session.session_code) : null;
  const matchingHand = (sessionData?.hands || []).find((hand) =>
    text(hand.id) === text(momentData.moment.hand_id) ||
    text(hand.hand_no) === text(momentData.moment.hand_no)
  );
  const hand = matchingHand ? normalizeHandRow(matchingHand) : normalizeHandRow(enriched || momentData.moment);

  return {
    moment: enriched || enrichMoment(momentData.moment, {
      session: momentData.session,
      player: null,
      publishedDraft: null,
      featuredId: "",
      topPotCutoff: 0,
    }),
    session: momentData.session,
    sessionData,
    hand,
    relatedSession: momentData.session,
    relatedPlayer: enriched?.player || null,
    publishedDraft: enriched?.publishedDraft || null,
  };
}
