import { supabase } from "@/lib/supabase";
import {
  buildDefaultFeaturedCards,
  enrichFeaturedCards,
  normalizeFeaturedCards,
  sanitizeBackgroundUrl,
} from "@/lib/playerProfileDisplay";
import { buildProfileRecaps } from "@/lib/recapData";

const EMPTY_PROFILE = {
  playerName: "Unknown Player",
  slug: "",
  avatarUrl: "",
  bio: "Profile data is still being prepared.",
  rankText: "-",
  pointsText: "0",
  labelsText: "Developing Profile / Unscouted",
  coreStats: [],
  pokerStats: [],
  positionStats: [],
  notableHands: [],
  recentSessions: [],
  badges: [],
  identity: {
    playerName: "Unknown Player",
    slug: "",
    avatarUrl: "",
    bio: "Profile data is still being prepared.",
    labelsText: "Developing Profile / Unscouted",
  },
  seasonStatus: {
    seasonCode: "S0",
    rankText: "-",
    pointsText: "0",
    labelsText: "Developing Profile / Unscouted",
  },
  publicHud: {
    tier: "free",
    stats: [
      { label: "Hands", value: "0", sourceKey: "player_season_stats.hands" },
      { label: "Action Rate", value: "-", sourceKey: "player_season_stats.vpip_pct" },
      { label: "First Raise Rate", value: "-", sourceKey: "player_season_stats.pfr_pct" },
      {
        label: "Biggest Pot",
        value: "0",
        sourceKey: "player_season_stats.biggest_pot_won",
      },
      { label: "Rank", value: "-", sourceKey: "standings.rank" },
      { label: "Points", value: "0", sourceKey: "standings.total_points" },
    ],
  },
  featuredDisplay: {
    mode: "default",
    cards: [],
    featuredAchievement: null,
    featuredMoment: null,
    featuredStat: null,
    badgeShelf: [],
  },
  styleProfile: {
    primaryLabel: "Developing Profile",
    secondaryLabel: "Unscouted",
    labelsText: "Developing Profile / Unscouted",
    theme: "default",
    bannerUrl: "",
    equippedBadges: [],
  },
  customization: {
    profileTheme: "default",
    bannerUrl: "",
    customTitle: "",
    sectionBackgrounds: {
      hero: "",
      featuredDisplay: "",
      publicHud: "",
      moments: "",
      achievements: "",
      lockedSections: "",
    },
  },
  achievements: [],
  moments: [],
  access: {
    tier: "free",
    isSubscriber: false,
    entitlements: ["public_profile"],
  },
  lockedSections: [],
  advancedRecord: {
    locked: true,
    items: [],
  },
  playerTrends: {
    locked: true,
    items: [],
  },
  privateStudySignals: {
    locked: true,
    items: [],
  },
  archivedSeasons: {
    locked: true,
    seasons: [],
  },
};

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

function cleanDisplayName(value) {
  return text(value).replace(/\s+@\s+\S+\s*$/u, "").trim();
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function percent(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed}%` : text(value, "-");
}

function stat(label, value, sourceKey) {
  return {
    label,
    value: text(value, "-"),
    sourceKey,
  };
}

function lockedSection(key, title, description) {
  return {
    key,
    title,
    description,
    locked: true,
    requiredTier: "future_paid",
  };
}

function pick(row, keys, fallback = undefined) {
  if (!row) {
    return fallback;
  }

  for (const key of keys) {
    if (row[key] !== null && row[key] !== undefined && row[key] !== "") {
      return row[key];
    }
  }

  return fallback;
}

function rowMatchesPlayer(row, player) {
  if (!row || !player) {
    return false;
  }

  const idValues = [
    row.player_id,
    row.winner_player_id,
    row.loser_player_id,
    row.hero_player_id,
    row.villain_player_id,
  ].filter(Boolean);

  if (idValues.map(String).includes(String(player.id))) {
    return true;
  }

  const searchable = JSON.stringify(row).toLowerCase();
  return [player.slug, player.display_name, player.pokernow_name]
    .filter(Boolean)
    .some((value) => searchable.includes(String(value).toLowerCase()));
}

async function safeQuery(query) {
  const { data, error } = await query;

  if (error) {
    return null;
  }

  return data;
}

function buildCoreStats(stats, standing) {
  return [
    stat("Rank", standing?.rank ? `#${standing.rank}` : "-", "standings.rank"),
    stat(
      "Points",
      pick(standing, ["total_points", "points"], "0"),
      "standings.total_points"
    ),
    stat("Hands", pick(stats, ["hands", "hands_played"], "0"), "player_season_stats.hands"),
    stat(
      "Biggest Pot",
      pick(stats, ["biggest_pot_won", "biggest_pot", "largest_pot"], "0"),
      "player_season_stats.biggest_pot_won"
    ),
  ];
}

function buildPublicHud(coreStats, pokerStats) {
  const statBySource = new Map(
    [...coreStats, ...pokerStats].map((item) => [item.sourceKey, item])
  );

  return {
    tier: "free",
    stats: [
      statBySource.get("player_season_stats.hands") ||
        stat("Hands", "0", "player_season_stats.hands"),
      stat(
        "Action Rate",
        statBySource.get("player_season_stats.vpip_pct")?.value || "-",
        "player_season_stats.vpip_pct"
      ),
      stat(
        "First Raise Rate",
        statBySource.get("player_season_stats.pfr_pct")?.value || "-",
        "player_season_stats.pfr_pct"
      ),
      statBySource.get("player_season_stats.biggest_pot_won") ||
        stat("Biggest Pot", "0", "player_season_stats.biggest_pot_won"),
      statBySource.get("standings.rank") || stat("Rank", "-", "standings.rank"),
      statBySource.get("standings.total_points") ||
        stat("Points", "0", "standings.total_points"),
    ],
  };
}

function buildPokerStats(stats) {
  return [
    stat("VPIP", percent(pick(stats, ["vpip_pct", "vpip"])), "player_season_stats.vpip_pct"),
    stat("PFR", percent(pick(stats, ["pfr_pct", "pfr"])), "player_season_stats.pfr_pct"),
    stat("3-Bet", percent(pick(stats, ["three_bet_pct", "threebet_pct", "three_bet"])), "player_season_stats.three_bet_pct"),
    stat("Aggression", pick(stats, ["aggression_factor", "af"], "-"), "player_season_stats.aggression_factor"),
  ];
}

function buildPositionStats(stats) {
  const positions = [
    ["BTN", ["btn_profit", "button_profit", "profit_btn"]],
    ["SB", ["sb_profit", "small_blind_profit", "profit_sb"]],
    ["BB", ["bb_profit", "big_blind_profit", "profit_bb"]],
    ["EP", ["ep_profit", "early_position_profit", "profit_ep"]],
    ["MP", ["mp_profit", "middle_position_profit", "profit_mp"]],
    ["CO", ["co_profit", "cutoff_profit", "profit_co"]],
  ];

  return positions.map(([label, keys]) =>
    stat(label, pick(stats, keys, "-"), `player_season_stats.${keys[0]}`)
  );
}

function formatChips(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString("en-US") : text(value, "0");
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function ordinal(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return "";
  const remainder = number % 100;
  if (remainder >= 11 && remainder <= 13) return `${number}th`;
  if (number % 10 === 1) return `${number}st`;
  if (number % 10 === 2) return `${number}nd`;
  if (number % 10 === 3) return `${number}rd`;
  return `${number}th`;
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map((tag) => String(tag));
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function displayTitleForTags(tags) {
  if (tags.includes("Season Biggest Pot")) {
    return "Season Biggest Pot";
  }

  if (tags.includes("All-In Hand")) {
    return "Pressure Pot";
  }

  if (tags.includes("Showdown")) {
    return "Showdown Marker";
  }

  if (tags.includes("River Pot")) {
    return "Late Answer";
  }

  if (tags.includes("Strong Winning Hand")) {
    return "Signature Pot";
  }

  if (tags.includes("Large Pot")) {
    return "Signature Pot";
  }

  return "Archive Marker";
}

function displayTag(tag) {
  if (tag === "All-In Hand") {
    return "All-In";
  }

  return tag;
}

function publicStyleLabel(value, fallback = "still-forming table identity") {
  const label = cleanDisplayName(value || fallback);
  const lower = label.toLowerCase();

  const translations = new Map([
    ["loose passive", "showdown-heavy profile"],
    ["loose aggressive", "active table presence"],
    ["tight aggressive", "patient confrontation style"],
    ["tight passive", "selective table presence"],
    ["calling station", "showdown-heavy profile"],
    ["maniac", "high-activity table presence"],
    ["fish", "still-forming table identity"],
    ["unscouted", "table identity still developing"],
    ["developing profile", "still-forming table identity"],
    ["pressure player", "active table presence"],
    ["showdown closer", "late-hand presence"],
  ]);

  return translations.get(lower) || label;
}

function publicLabelsText(primary, secondary) {
  const labels = [
    publicStyleLabel(primary, "still-forming table identity"),
    publicStyleLabel(secondary, "table identity still developing"),
  ].filter(Boolean);

  return [...new Set(labels)].join(" / ");
}

function buildMomentDisplay(row) {
  const tags = normalizeTags(row.tags);
  const handNo = pick(row, ["hand_no", "hand_number", "hand"], "");
  const winner = cleanDisplayName(
    pick(row, ["winner_name", "winner", "player_name"], "This player")
  );
  const pot = pick(row, ["pot_collected", "pot_size", "amount", "net"], "");
  const title = displayTitleForTags(tags);
  const tagText = tags.map(displayTag);
  const metaParts = [
    handNo ? `Hand #${handNo}` : "",
    ...tagText,
  ].filter(Boolean);
  const potText = formatChips(pot);
  const swingText = tags.includes("All-In Hand")
    ? "major all-in swings"
    : "major swings";
  const summary =
    pot && Number(pot) > 0
      ? `${winner} dragged a ${potText}-chip pot in one of the session's ${swingText}.`
      : `${winner} created one of the session's notable profile moments.`;

  return {
    displayTitle: title,
    displaySummary: summary,
    displayMeta: metaParts.join(" / "),
    displayTags: tagText,
  };
}

function momentPot(moment) {
  return numberValue(
    pick(moment?.raw || moment, ["pot_collected", "pot_size", "amount", "net"], moment?.potText),
    0
  );
}

function isPinnedMomentCard(card) {
  return card?.type === "moment" && card?.source === "moments" && card?.sourceId;
}

function momentPriority(moment) {
  const tags = normalizeTags(moment?.raw?.tags || moment?.displayTags || moment?.tags);
  const pot = momentPot(moment);
  let score = pot;

  if (tags.includes("Season Biggest Pot")) score += 100000;
  if (tags.includes("Large Pot")) score += 50000;
  if (tags.includes("All-In Hand")) score += 40000;
  if (tags.includes("Showdown")) score += 15000;
  if (tags.includes("River Pot")) score += 12000;
  if (tags.includes("Strong Winning Hand")) score += 10000;

  return score;
}

function qualifiesAsSignatureMoment(moment, playerStats) {
  if (!moment) return false;

  const tags = normalizeTags(moment.raw?.tags || moment.displayTags || moment.tags);
  const pot = momentPot(moment);
  const biggestPot = numberValue(
    pick(playerStats, ["biggest_pot_won", "biggest_pot", "largest_pot"]),
    0
  );

  return (
    tags.includes("Season Biggest Pot") ||
    tags.includes("All-In Hand") ||
    tags.includes("Large Pot") ||
    pot >= 1000 ||
    (biggestPot > 0 && pot === biggestPot)
  );
}

function selectSignatureMoment(moments, playerStats) {
  return (moments || [])
    .filter((moment) => qualifiesAsSignatureMoment(moment, playerStats))
    .sort((left, right) => momentPriority(right) - momentPriority(left))[0] || null;
}

function buildContextualMomentDisplay(row, session) {
  const base = buildMomentDisplay(row);
  const tags = normalizeTags(row.tags);
  const handNo = pick(row, ["hand_no", "hand_number", "hand"], "");
  const winner = cleanDisplayName(
    pick(row, ["winner_name", "winner", "player_name"], "This player")
  );
  const pot = pick(row, ["pot_collected", "pot_size", "amount", "net"], "");
  const potText = formatChips(pot);
  const sessionCode = text(session?.session_code || row.session_code, "S0");
  const playedAt = session?.played_at || row.played_at || "";
  const contextLine = [
    sessionCode,
    formatDate(playedAt) || text(session?.table_name),
  ].filter(Boolean).join(" / ");
  const displayTags = tags.map(displayTag);
  const displayMeta = [
    handNo ? `Hand #${handNo}` : "",
    pot && Number(pot) > 0 ? `${potText} chips` : "",
    ...displayTags,
  ].filter(Boolean).join(" / ");

  return {
    ...base,
    contextLine,
    displaySummary: buildMomentSummary({
      title: base.displayTitle,
      winner,
      pot,
      potText,
      winningHand: row.winning_hand,
      tags,
    }),
    displayMeta,
        displayTags,
        sessionCode,
        sourceSessionId: text(row.session_id),
        sourceHandIds: [row.hand_code, row.hand_id, row.id]
          .filter(Boolean)
          .map((value) => text(value)),
        playedAt,
        handNo: handNo ? Number(handNo) || handNo : "",
        potText,
  };
}

function buildMomentSummary({ title, winner, pot, potText, winningHand, tags }) {
  const hasPot = pot && Number(pot) > 0;
  const potPhrase = hasPot ? `a ${potText}-chip pot` : "the pot";

  if (title === "Season Biggest Pot") {
    const allIn = tags.includes("All-In Hand") ? " all-in" : "";
    return `${winner} took down ${hasPot ? `a ${potText}-chip${allIn} pot` : "the pot"}, giving the profile its clearest early swing.`;
  }

  if (title === "Pressure Pot") {
    return `${winner} came through in ${hasPot ? `a ${potText}-chip` : "an"} all-in confrontation.`;
  }

  if (title === "Showdown Marker") {
    const handText = winningHand ? ` with ${winningHand}` : "";
    return `${winner} reached showdown${handText} and collected ${potPhrase}.`;
  }

  if (title === "Late Answer") {
    return `The hand reached the river before ${winner} secured ${potPhrase}.`;
  }

  if (title === "Signature Pot") {
    const handText = winningHand ? ` ${winningHand}` : " a strong made hand";
    return `${winner} showed down${handText} to claim ${potPhrase}.`;
  }

  return `${winner} secured ${potPhrase}, giving the profile another public hand to track.`;
}

function buildNotableHands(hands, player, sessions) {
  const sessionById = new Map(
    (sessions || []).map((session) => [String(session.id), session])
  );

  return (hands || [])
    .filter((row) => rowMatchesPlayer(row, player))
    .slice(0, 6)
    .map((row, index) => {
      const display = buildContextualMomentDisplay(
        row,
        sessionById.get(String(row.session_id))
      );

      return {
        id: text(pick(row, ["id", "hand_id"], `notable-hand-${index}`)),
        title: display.displayTitle,
        subtitle: display.displayMeta,
        amountText: "",
        description: display.displaySummary,
        ...display,
        raw: row,
      };
    });
}

function buildRecentSessions(sessionStats, sessionResults, sessions) {
  const sessionById = new Map(
    (sessions || []).map((session) => [String(session.id), session])
  );
  const statsBySessionId = new Map(
    (sessionStats || [])
      .filter((row) => row.session_id || row.session_code)
      .map((row) => [String(row.session_id || row.session_code), row])
  );
  const resultBySessionId = new Map(
    (sessionResults || [])
      .filter((row) => row.session_id || row.session_code)
      .map((row) => [String(row.session_id || row.session_code), row])
  );

  const sessionKeys = [
    ...new Set([...statsBySessionId.keys(), ...resultBySessionId.keys()]),
  ];

  return sessionKeys.map((sessionKey, index) => {
    const row = statsBySessionId.get(sessionKey) || {};
    const result = resultBySessionId.get(sessionKey) || {};
    const session = sessionById.get(sessionKey) || {};
    const finishText = ordinal(result.finish);
    const pointsText = text(pick(result, ["league_points", "points"], "0"));

    return {
      id: text(pick(row, ["id", "session_id", "session_code"], `session-${index}`)),
      sourceSessionId: text(session.id || row.session_id || result.session_id || sessionKey),
      label: text(session.session_code || row.session_code, "Session"),
      sessionCode: text(session.session_code || row.session_code),
      dateText: formatDate(
        session.played_at || pick(row, ["played_at", "session_date", "created_at"], "")
      ),
      playedAt: text(session.played_at),
      tableName: text(session.table_name),
      handsText: text(pick(row, ["hands", "hands_played"], "-")),
      resultText: finishText ? `${finishText} finish / ${pointsText} points` : "-",
      finish: numberValue(result.finish, null),
      finishText,
      pointsText,
      approved: Boolean(result.approved),
      raw: {
        session,
        sessionStats: row,
        sessionResult: result,
      },
    };
  }).sort((left, right) =>
    String(right.playedAt).localeCompare(String(left.playedAt))
  ).slice(0, 8);
}

function buildBadges(stats, standing) {
  const badges = [];

  if (standing?.rank && numberValue(standing.rank) <= 3) {
    badges.push({ label: `Top ${standing.rank} Season Standing`, tone: "gold" });
  }

  if (numberValue(pick(stats, ["hands", "hands_played"])) >= 1000) {
    badges.push({ label: "Volume", tone: "blue" });
  }

  if (pick(stats, ["biggest_pot_won", "biggest_pot", "largest_pot"])) {
    badges.push({ label: "Big Pot Winner", tone: "green" });
  }

  return badges.length ? badges : [{ label: "Profile Building", tone: "neutral" }];
}

function buildLockedSections() {
  return [
    lockedSection(
      "player_trends",
      "Player Trends",
      "Form lines and season movement are planned for a future paid tier."
    ),
    lockedSection(
      "advanced_record",
      "Advanced Record",
      "Advanced trends and historical record views are planned for a future paid tier."
    ),
    lockedSection(
      "archived_seasons",
      "Archived Seasons",
      "Previous season aggregates are planned for a future paid tier."
    ),
  ];
}

function emptyProfile(overrides = {}) {
  return {
    ...EMPTY_PROFILE,
    lockedSections: buildLockedSections(),
    ...overrides,
  };
}

export async function getPlayerProfileData(slug, seasonCode = "S0") {
  const cleanSlug = typeof slug === "string" ? slug.trim().toLowerCase() : "";

  if (!cleanSlug) {
    return emptyProfile();
  }

  const player = await safeQuery(
    supabase.from("players").select("*").ilike("slug", cleanSlug).maybeSingle()
  );

  if (!player) {
    return emptyProfile({
      slug: cleanSlug,
      playerName: "Player not found",
      bio: "This player slug does not exist in Supabase yet, or it was saved differently.",
      identity: {
        ...EMPTY_PROFILE.identity,
        slug: cleanSlug,
        playerName: "Player not found",
        bio: "This player slug does not exist in Supabase yet, or it was saved differently.",
      },
    });
  }

  const [
    stats,
    standing,
    sessionStats,
    sessionResults,
    rawNotableHands,
    profileDisplay,
    seasonSessions,
  ] =
    await Promise.all([
      safeQuery(
        supabase
          .from("player_season_stats")
          .select("*")
          .eq("season_code", seasonCode)
          .eq("player_id", player.id)
          .maybeSingle()
      ),
      safeQuery(
        supabase
          .from("standings")
          .select("*")
          .eq("season_code", seasonCode)
          .eq("player_id", player.id)
          .maybeSingle()
      ),
      safeQuery(
        supabase
          .from("player_session_stats")
          .select("*")
          .eq("player_id", player.id)
          .order("created_at", { ascending: false })
          .limit(8)
      ),
      safeQuery(
        supabase
          .from("session_results")
          .select("*")
          .eq("player_id", player.id)
          .limit(12)
      ),
      safeQuery(supabase.from("notable_hands").select("*").limit(40)),
      safeQuery(
        supabase
          .from("player_profile_display")
          .select("*")
          .eq("player_id", player.id)
          .eq("season_code", seasonCode)
          .maybeSingle()
      ),
      safeQuery(
        supabase
          .from("sessions")
          .select("id, session_code, season_code, played_at, table_name, session_number")
          .eq("season_code", seasonCode)
          .order("session_number", { ascending: false })
      ),
    ]);

  const playerName = text(
    player.display_name || stats?.player_name || player.pokernow_name,
    "Unknown Player"
  );
  const labelsText = `${text(stats?.primary_label, "Developing Profile")} / ${text(
    stats?.secondary_label,
    "Unscouted"
  )}`;
  const rankText = standing?.rank ? `#${standing.rank}` : "-";
  const pointsText = text(pick(standing, ["total_points", "points"], "0"));
  const coreStats = buildCoreStats(stats, standing);
  const pokerStats = buildPokerStats(stats);
  const positionStats = buildPositionStats(stats);
  const notableHands = buildNotableHands(rawNotableHands, player, seasonSessions);
  const recentSessions = buildRecentSessions(
    sessionStats,
    sessionResults,
    seasonSessions
  );
  const badges = buildBadges(stats, standing);
  const publicHud = buildPublicHud(coreStats, pokerStats);
  const primaryLabel = text(stats?.primary_label, "Developing Profile");
  const secondaryLabel = text(stats?.secondary_label, "Unscouted");
  const publicProfileLabelsText = publicLabelsText(primaryLabel, secondaryLabel);
  const lockedSections = buildLockedSections();
  const approvedSessions = numberValue(
    standing?.sessions_played,
    recentSessions.filter((session) => session.approved).length
  );
  const bestSessionResult = recentSessions
    .filter((session) => session.approved && session.finish)
    .sort((left, right) => left.finish - right.finish)[0] || null;
  const seasonStatus = {
    seasonCode,
    rankText,
    pointsText,
    labelsText: publicProfileLabelsText,
    privateLabelsText: labelsText,
    approvedSessions,
    bestFinish: bestSessionResult?.finish || null,
    bestSessionResult,
  };
  const savedFeaturedCards = normalizeFeaturedCards(profileDisplay?.featured_cards);
  const signatureMoment = selectSignatureMoment(notableHands, stats);
  const savedPinnedMoment = savedFeaturedCards.some(isPinnedMomentCard);
  const defaultFeaturedCards = buildDefaultFeaturedCards({
    publicHud,
    seasonStatus,
    moments: signatureMoment ? [signatureMoment] : [],
    achievements: badges,
    recentSessions,
  });
  const contextualSavedCards = enrichFeaturedCards(savedFeaturedCards, {
    publicHud,
    seasonStatus,
    moments: notableHands,
    achievements: badges,
    recentSessions,
  });
  const featuredCards = savedFeaturedCards.length
    ? contextualSavedCards
    : defaultFeaturedCards;
  const featuredDisplay = {
    mode: savedFeaturedCards.length ? "player_selected" : "default",
    cards: featuredCards,
    featuredAchievement:
      featuredCards.find((card) => card.type === "achievement") || badges[0] || null,
    featuredMoment:
      featuredCards.find((card) => card.type === "moment") ||
      (savedPinnedMoment ? notableHands[0] : signatureMoment) ||
      null,
    featuredStat:
      featuredCards.find((card) => card.type === "stat") || publicHud.stats[0] || null,
    badgeShelf: badges,
  };
  const customization = {
    profileTheme: text(profileDisplay?.profile_theme, "default"),
    bannerUrl: sanitizeBackgroundUrl(
      profileDisplay?.banner_url || player.banner_url
    ),
    customTitle: text(profileDisplay?.custom_title),
    sectionBackgrounds: {
      hero: sanitizeBackgroundUrl(profileDisplay?.hero_bg_url),
      featuredDisplay: sanitizeBackgroundUrl(
        profileDisplay?.featured_display_bg_url
      ),
      publicHud: sanitizeBackgroundUrl(profileDisplay?.public_hud_bg_url),
      moments: sanitizeBackgroundUrl(profileDisplay?.moments_bg_url),
      achievements: sanitizeBackgroundUrl(profileDisplay?.achievements_bg_url),
      lockedSections: sanitizeBackgroundUrl(
        profileDisplay?.locked_sections_bg_url
      ),
    },
  };

  const baseProfileData = {
    playerName,
    slug: text(player.slug, cleanSlug),
    avatarUrl: text(player.avatar_url),
    bio: text(
      player.bio,
      `${playerName}'s public profile is still forming from verified season results and session moments.`
    ),
    rankText,
    pointsText,
    labelsText: publicProfileLabelsText,
    privateLabelsText: labelsText,
    coreStats,
    pokerStats,
    positionStats,
    notableHands,
    recentSessions,
    badges,
    identity: {
      playerName,
      slug: text(player.slug, cleanSlug),
      avatarUrl: text(player.avatar_url),
      bio: text(
        player.bio,
        `${playerName}'s public profile is still forming from verified season results and session moments.`
      ),
      labelsText: publicProfileLabelsText,
      privateLabelsText: labelsText,
    },
    seasonStatus,
    publicHud,
    featuredDisplay,
    customization,
    styleProfile: {
      primaryLabel,
      secondaryLabel,
      labelsText: publicProfileLabelsText,
      privateLabelsText: labelsText,
      theme: customization.profileTheme,
      bannerUrl: customization.bannerUrl,
      equippedBadges: badges,
    },
    achievements: badges,
    moments: notableHands,
    signatureMoment,
    privateHudLabels: {
      primaryLabel,
      secondaryLabel,
      labelsText,
    },
    access: {
      tier: "free",
      isSubscriber: false,
      entitlements: ["public_profile"],
    },
    lockedSections,
    advancedRecord: {
      locked: true,
      requiredTier: "future_paid",
      items: [],
    },
    playerTrends: {
      locked: true,
      requiredTier: "future_paid",
      items: [],
    },
    privateStudySignals: {
      locked: true,
      requiredTier: "future_paid",
      items: [],
    },
    archivedSeasons: {
      locked: true,
      requiredTier: "future_paid",
      seasons: [],
    },
  };

  return {
    ...baseProfileData,
    recaps: await buildProfileRecaps(baseProfileData),
  };
}
