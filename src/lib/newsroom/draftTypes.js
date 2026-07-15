export const DRAFT_TYPE_KEYS = {
  SESSION_RECAP: "session_recap",
  PLAYER_PROFILE: "player_profile",
  PLAYER_SESSION_RECAP: "player_session_recap",
  STANDINGS_SUMMARY: "standings_summary",
  MOMENT_BLURB: "moment_blurb",
  LEAGUE_ARTICLE: "league_article",
  SOCIAL_CAPTION: "social_caption",
  PRIVATE_NOTE: "private_note",
};

export const draftTypes = {
  [DRAFT_TYPE_KEYS.SESSION_RECAP]: {
    key: DRAFT_TYPE_KEYS.SESSION_RECAP,
    label: "Session Recap",
    purpose: "Public article recap of one verified Para League session.",
    sourceType: "session",
    requiredSource: "sessionId",
    endpoint: "/api/recaps/generate",
    draftTable: "recap_drafts",
    fallbackScope: "session",
    publicRoutePattern: "/sessions/[sessionId]",
    adminRoutePattern: "/admin/sessions/[sessionId]",
    guideFile: "09-session-recap-magic-guide.md",
    schemaKey: "sessionRecapDraftSchema",
    defaultPromptPreset: "official_session_recap",
    defaultVariation: "turning_point_led",
    variations: [
      {
        key: "turning_point_led",
        label: "Turning Point Led",
        instruction: "Open from the hand or sequence that gave the session its shape, then land the result.",
      },
      {
        key: "winner_story",
        label: "Winner Story",
        instruction: "Lead with how the winner earned the session using verified result and hand evidence.",
      },
      {
        key: "resistance_story",
        label: "Resistance Story",
        instruction: "Give the winner the result while making the strongest non-winner's verified resistance matter.",
      },
      {
        key: "standings_marker",
        label: "Standings Marker",
        instruction: "Frame the recap around what the result adds to the league board without inventing movement.",
      },
      {
        key: "punchy_recap_card",
        label: "Punchy Recap Card",
        instruction: "Write compact, high-energy public copy suitable for a recap card or social preview.",
      },
    ],
    publicSlots: [
      "session hero article",
      "key moments section",
      "player blurbs section",
      "session archive card",
    ],
    playerFacingGoal: "Make the winner feel earned and the non-winner worthy when the facts support it.",
    avoidTone: [
      "stat export",
      "audit report",
      "generic sports article",
      "fake rivalry",
      "internal product language",
    ],
  },

  [DRAFT_TYPE_KEYS.PLAYER_PROFILE]: {
    key: DRAFT_TYPE_KEYS.PLAYER_PROFILE,
    label: "Player Profile",
    purpose: "Public player identity and archive page that turns verified league history into a player-facing profile.",
    sourceType: "player",
    requiredSource: "playerId",
    endpoint: "/api/profiles/generate",
    draftTable: "profile_drafts",
    fallbackScope: "player",
    publicRoutePattern: "/players/[playerId]",
    adminRoutePattern: "/admin/players/[playerId]",
    guideFile: "10-player-profile-guide.md",
    schemaKey: "profileDraftSchema",
    defaultPromptPreset: "player_dossier",
    defaultVariation: "identity_snapshot",
    variations: [
      {
        key: "identity_snapshot",
        label: "Identity Snapshot",
        instruction: "Summarize who the player is in the league record using only verified history and tendencies.",
      },
      {
        key: "shareable_profile",
        label: "Shareable Profile",
        instruction: "Write the profile like a public player card: rank, points, form, and strongest verified moments first.",
      },
      {
        key: "current_form",
        label: "Current Form",
        instruction: "Focus on recent results, visible momentum, and what the latest sample suggests without overclaiming.",
      },
      {
        key: "table_identity",
        label: "Table Identity",
        instruction: "Describe the player's public table presence through verified sessions, moments, and outcomes.",
      },
      {
        key: "archive_profile",
        label: "Archive Profile",
        instruction: "Write like a player record page, emphasizing history, notable moments, and league memory.",
      },
      {
        key: "inspirational_player_forward",
        label: "Player-Forward",
        instruction: "Make the player feel like they belong in the competitive story while staying grounded in facts.",
      },
    ],
    publicSlots: [
      "player hero",
      "identity snapshot",
      "current form",
      "table identity",
      "recent archive note",
      "what to watch",
    ],
    playerFacingGoal: "Make the player feel like they belong in a living league record, not like a row in a stats table.",
    avoidTone: [
      "scouting report cosplay",
      "private coaching",
      "overfixed identity",
      "cold biography",
      "invented personality",
    ],
  },

  [DRAFT_TYPE_KEYS.PLAYER_SESSION_RECAP]: {
    key: DRAFT_TYPE_KEYS.PLAYER_SESSION_RECAP,
    label: "Player Session Recap",
    purpose: "Player-specific recap of one session, usable on player pages and session pages.",
    sourceType: "player_session",
    requiredSource: "playerId + sessionId",
    endpoint: "/api/player-session-recaps/generate",
    draftTable: "player_session_recap_drafts",
    fallbackScope: "player_session",
    publicRoutePattern: "/players/[playerId] and /sessions/[sessionId]",
    adminRoutePattern: "/admin/players/[playerId]",
    guideFile: "11-player-session-recap-guide.md",
    schemaKey: "sessionRecapDraftSchema",
    defaultPromptPreset: "player_dossier",
    defaultVariation: "pressure_spot_note",
    variations: [
      {
        key: "clean_win_note",
        label: "Clean Win Note",
        instruction: "For a winning player, frame the result as earned without exaggerating one session into a destiny.",
      },
      {
        key: "worthy_loss",
        label: "Worthy Loss",
        instruction: "For a non-winner, identify the verified resistance, answer, or pressure moment that still gives the session dignity.",
      },
      {
        key: "bounceback_note",
        label: "Bounceback Note",
        instruction: "Emphasize the next competitive beat after a difficult result without giving private advice.",
      },
      {
        key: "pressure_spot_note",
        label: "Pressure Spot Note",
        instruction: "Center the recap on the hand or sequence where the player's session changed texture.",
      },
      {
        key: "timeline_card",
        label: "Timeline Card",
        instruction: "Write short timeline copy that can live inside a player page archive feed.",
      },
    ],
    publicSlots: [
      "player recent session note",
      "player timeline item",
      "session page player blurb",
    ],
    playerFacingGoal: "Make the player feel seen, even in a loss, without inventing private coaching or emotion.",
    avoidTone: [
      "private coach voice",
      "therapy language",
      "shaming",
      "fake resilience arc",
      "unsupported strategy read",
    ],
  },

  [DRAFT_TYPE_KEYS.STANDINGS_SUMMARY]: {
    key: DRAFT_TYPE_KEYS.STANDINGS_SUMMARY,
    label: "Standings Summary",
    purpose: "Explain the standings page in human terms so the board feels alive and readable.",
    sourceType: "season",
    requiredSource: "seasonCode",
    endpoint: "/api/standings/generate",
    draftTable: "standings_drafts",
    fallbackScope: "season",
    publicRoutePattern: "/standings",
    adminRoutePattern: "/admin/standings",
    guideFile: "12-standings-summary-guide.md",
    schemaKey: "articleDraftSchema",
    defaultPromptPreset: "standings_pulse",
    defaultVariation: "table_state",
    variations: [
      {
        key: "table_state",
        label: "Table State",
        instruction: "Describe what the current standings show right now without inventing movement.",
      },
      {
        key: "early_board",
        label: "Early Board",
        instruction: "For small samples, make the board feel like an opening marker while staying humble.",
      },
      {
        key: "movement_watch",
        label: "Movement Watch",
        instruction: "Highlight pressure points and possible watch areas only when standings data supports them.",
      },
      {
        key: "playoff_race",
        label: "Playoff Race",
        instruction: "Use only supplied qualification or cutoff data to discuss finals/playoff implications.",
      },
      {
        key: "underdog_pressure",
        label: "Underdog Pressure",
        instruction: "Make lower-board players feel like they still have a path without inventing math or stakes.",
      },
    ],
    publicSlots: [
      "standings intro",
      "table state",
      "biggest pressure",
      "what to watch",
    ],
    playerFacingGoal: "Make the board feel like a living race while respecting small samples and missing movement data.",
    avoidTone: [
      "spreadsheet summary",
      "fake playoff stakes",
      "premature coronation",
      "rank shaming",
      "math without context",
    ],
  },

  [DRAFT_TYPE_KEYS.MOMENT_BLURB]: {
    key: DRAFT_TYPE_KEYS.MOMENT_BLURB,
    label: "Moment Blurb",
    purpose: "Short public card copy for notable hands, turning points, and archive-worthy table moments.",
    sourceType: "moment",
    requiredSource: "momentId",
    endpoint: "/api/moments/generate",
    draftTable: "moment_blurb_drafts",
    fallbackScope: "moment",
    publicRoutePattern: "/moments",
    adminRoutePattern: "/admin/moments",
    guideFile: "13-moment-blurb-guide.md",
    schemaKey: "articleDraftSchema",
    defaultPromptPreset: "moment_archive_note",
    defaultVariation: "pressure_moment",
    variations: [
      {
        key: "pressure_moment",
        label: "Pressure Moment",
        instruction: "Make the moment feel tense through verified pot size, timing, and consequence.",
      },
      {
        key: "turning_point",
        label: "Turning Point",
        instruction: "Explain how the hand changed the session's shape without inventing hidden strategy.",
      },
      {
        key: "bad_beat",
        label: "Bad Beat",
        instruction: "If the facts support it, make the loss sting without mocking or overstating the player.",
      },
      {
        key: "comeback_spark",
        label: "Comeback Spark",
        instruction: "Frame the hand as an answer or foothold only when the later sequence supports that read.",
      },
      {
        key: "archive_marker",
        label: "Archive Marker",
        instruction: "Write it like a small historical marker: concise, specific, and memorable.",
      },
    ],
    publicSlots: [
      "moment card",
      "session embedded moment",
      "player featured moment",
      "archive note",
    ],
    playerFacingGoal: "Make a hand feel memorable through verified sequence, pressure, and consequence.",
    avoidTone: [
      "hand-history dump",
      "fake table talk",
      "solver-speak",
      "mocking the loser",
      "overexplained odds",
    ],
  },

  [DRAFT_TYPE_KEYS.LEAGUE_ARTICLE]: {
    key: DRAFT_TYPE_KEYS.LEAGUE_ARTICLE,
    label: "League Article",
    purpose: "Longer newsroom article built from approved league data, standings, sessions, moments, and player history.",
    sourceType: "article",
    requiredSource: "articleRequest",
    endpoint: "/api/articles/generate",
    draftTable: "article_drafts",
    fallbackScope: "article",
    publicRoutePattern: "/articles/[articleId]",
    adminRoutePattern: "/admin/articles",
    guideFile: "14-league-article-guide.md",
    schemaKey: "articleDraftSchema",
    defaultPromptPreset: "official_session_recap",
    defaultVariation: "beat_report",
    variations: [
      {
        key: "beat_report",
        label: "Beat report",
        instruction: "Write a current league beat report from the supplied data. Lead with the newest verified development and give it newsroom bite without declaring the race over.",
      },
      {
        key: "feature_angle",
        label: "Feature angle",
        instruction: "Write a focused feature-style article around one supplied angle, player, session, or standings thread. Do not invent quotes, motives, rivalries, or completed-season conclusions.",
      },
      {
        key: "preseason_context",
        label: "Preseason Context",
        instruction: "Frame early results as opening signals, not settled conclusions.",
      },
      {
        key: "player_race",
        label: "Player Race",
        instruction: "Write about a standings/player race only when the supplied data supports the comparison.",
      },
      {
        key: "weekly_digest",
        label: "Weekly Digest",
        instruction: "Summarize multiple approved beats in a compact, readable league update.",
      },
      {
        key: "preview_setup",
        label: "Preview setup",
        instruction: "Set up an upcoming session, player watch, or standings question using only supplied schedule/context. Do not predict outcomes or imply the race is settled.",
      },
    ],
    publicSlots: [
      "article page",
      "article index card",
      "related sessions",
      "related players",
    ],
    playerFacingGoal: "Make the league feel like a real competitive archive with players worth following.",
    avoidTone: [
      "generic blog",
      "fake magazine profile",
      "unearned myth",
      "inside-baseball implementation notes",
      "empty hype",
    ],
  },

  [DRAFT_TYPE_KEYS.SOCIAL_CAPTION]: {
    key: DRAFT_TYPE_KEYS.SOCIAL_CAPTION,
    label: "Social Caption",
    purpose: "Short Para League social/card copy from verified league data.",
    sourceType: "mixed",
    requiredSource: "sessionId/playerId/momentId",
    endpoint: "/api/social-captions/generate",
    draftTable: "social_caption_drafts",
    fallbackScope: "social_caption",
    publicRoutePattern: "Future social surfaces",
    adminRoutePattern: "/admin/social-captions",
    guideFile: "15-prose-style-examples.md",
    schemaKey: "socialCaptionDraftSchema",
    defaultPromptPreset: "social_caption",
    defaultVariation: "recap_card",
    variations: [
      {
        key: "recap_card",
        label: "Recap card",
        instruction: "Write compact public card copy around the strongest supplied result, pot, player, or moment.",
      },
      {
        key: "winner_post",
        label: "Winner post",
        instruction: "Center the winner and the cleanest verified reason the win matters.",
      },
      {
        key: "moment_post",
        label: "Moment post",
        instruction: "Center one supplied hand or moment with hand number, pot, winner, or consequence when supplied.",
      },
      {
        key: "standings_post",
        label: "Standings post",
        instruction: "Write a current-board caption. Treat standings as live and provisional unless data says otherwise.",
      },
      {
        key: "sporting_roast_admin",
        label: "Sporting roast admin",
        instruction: "Use playful sports edge for admin review only. No personal insults or unsupported weakness claims.",
      },
    ],
    publicSlots: ["social caption draft", "card text", "platform variants"],
    playerFacingGoal: "Make approved league beats shareable without inventing drama.",
    avoidTone: ["generic caption", "fake rivalry", "invented emotion", "overexplained recap"],
  },

  [DRAFT_TYPE_KEYS.PRIVATE_NOTE]: {
    key: DRAFT_TYPE_KEYS.PRIVATE_NOTE,
    label: "Private/Admin Note",
    purpose: "Admin-only review notes from verified data. Not public copy.",
    sourceType: "mixed",
    requiredSource: "sessionId/playerId/momentId",
    endpoint: "/api/private-notes/generate",
    draftTable: "private_note_drafts",
    fallbackScope: "private_note",
    publicRoutePattern: "Admin only",
    adminRoutePattern: "/admin/prompt-studio",
    guideFile: "15-prose-style-examples.md",
    schemaKey: "privateNoteDraftSchema",
    defaultPromptPreset: "coach_private_note",
    defaultVariation: "coach_private",
    variations: [
      {
        key: "coach_private",
        label: "Coach private",
        instruction: "Write a private review note for editors/coaches from verified hands, actions, and results.",
      },
      {
        key: "technical_poker",
        label: "Technical poker",
        instruction: "Write a technical note grounded in chronological hand/action data; frame uncertainty as review questions.",
      },
      {
        key: "sporting_roast",
        label: "Sporting roast",
        instruction: "Write an admin-only playful roast. Keep it league-safe and fact-grounded.",
      },
    ],
    publicSlots: ["admin review note"],
    playerFacingGoal: "Keep private analysis useful without leaking it into public surfaces.",
    avoidTone: ["public hype", "personal insult", "invented intent", "unsupported weakness claims"],
  },
};

const DRAFT_EDITOR_CONFIGS = {
  [DRAFT_TYPE_KEYS.SESSION_RECAP]: {
    titleField: "headline",
    subtitleField: "subheadline",
    bodyField: "recap_body",
    richTextFields: ["recap_body"],
  },
  [DRAFT_TYPE_KEYS.PLAYER_PROFILE]: {
    titleField: "headline",
    subtitleField: "subheadline",
    bodyField: "profile_body",
    richTextFields: ["profile_body"],
  },
  [DRAFT_TYPE_KEYS.PLAYER_SESSION_RECAP]: {
    titleField: "headline",
    subtitleField: "subheadline",
    bodyField: "recap_body",
    richTextFields: ["recap_body"],
  },
  [DRAFT_TYPE_KEYS.STANDINGS_SUMMARY]: {
    titleField: "headline",
    subtitleField: "subheadline",
    bodyField: "article_body",
    richTextFields: ["article_body"],
  },
  [DRAFT_TYPE_KEYS.MOMENT_BLURB]: {
    titleField: "headline",
    subtitleField: "subheadline",
    bodyField: "article_body",
    richTextFields: ["article_body"],
  },
  [DRAFT_TYPE_KEYS.LEAGUE_ARTICLE]: {
    titleField: "headline",
    subtitleField: "subheadline",
    bodyField: "article_body",
    richTextFields: ["article_body"],
    supportsAuthor: true,
    supportsDisplayDate: true,
  },
  [DRAFT_TYPE_KEYS.SOCIAL_CAPTION]: {
    titleField: "headline",
    subtitleField: "subheadline",
    bodyField: "caption",
    richTextFields: ["caption"],
  },
  [DRAFT_TYPE_KEYS.PRIVATE_NOTE]: {
    titleField: "headline",
    subtitleField: "subheadline",
    bodyField: "body",
    richTextFields: ["body"],
    adminOnly: true,
  },
};

const DRAFT_DEFAULT_PAYLOADS = {
  [DRAFT_TYPE_KEYS.SESSION_RECAP]: {
    sessionId: "S0-001",
    variation: "turning_point_led",
    editorialNotes: "",
  },
  [DRAFT_TYPE_KEYS.PLAYER_PROFILE]: {
    playerId: "",
    variation: "identity_snapshot",
    editorialNotes: "",
  },
  [DRAFT_TYPE_KEYS.PLAYER_SESSION_RECAP]: {
    playerId: "",
    sessionId: "S0-001",
    variation: "pressure_spot_note",
    editorialNotes: "",
  },
  [DRAFT_TYPE_KEYS.STANDINGS_SUMMARY]: {
    seasonCode: "S0",
    variation: "table_state",
    editorialNotes: "",
  },
  [DRAFT_TYPE_KEYS.MOMENT_BLURB]: {
    momentId: "",
    coverageTarget: {
      role: "winner",
      playerName: "",
    },
    variation: "pressure_moment",
    editorialNotes: "",
  },
  [DRAFT_TYPE_KEYS.LEAGUE_ARTICLE]: {
    variation: "beat_report",
    articleRequest: {
      topic: "",
      seasonCode: "S0",
      seasonPhase: "preseason",
      seasonStatus: "in_progress",
      lifecycleNote: "Season 0 is ongoing. Do not write as if the season, preseason, standings race, or player stories are complete.",
      articleType: "beat_report",
      authorName: "Para League Desk",
    },
  },
  [DRAFT_TYPE_KEYS.SOCIAL_CAPTION]: {
    sourceType: "session",
    sessionId: "S0-001",
    playerId: "",
    momentId: "",
    seasonCode: "S0",
    variation: "recap_card",
    editorialNotes: "",
  },
  [DRAFT_TYPE_KEYS.PRIVATE_NOTE]: {
    sourceType: "session",
    sessionId: "S0-001",
    playerId: "",
    momentId: "",
    seasonCode: "S0",
    variation: "coach_private",
    editorialNotes: "",
  },
};

const DRAFT_PUBLISH_TARGETS = {
  [DRAFT_TYPE_KEYS.SESSION_RECAP]: { route: "/sessions/[sessionId]", slot: "session_recap" },
  [DRAFT_TYPE_KEYS.PLAYER_PROFILE]: { route: "/players/[playerId]", slot: "player_profile" },
  [DRAFT_TYPE_KEYS.PLAYER_SESSION_RECAP]: { route: "/players/[playerId]", slot: "player_session_recap" },
  [DRAFT_TYPE_KEYS.STANDINGS_SUMMARY]: { route: "/standings", slot: "standings_summary" },
  [DRAFT_TYPE_KEYS.MOMENT_BLURB]: { route: "/moments", slot: "moment_blurb" },
  [DRAFT_TYPE_KEYS.LEAGUE_ARTICLE]: { route: "/articles/[articleId]", slot: "article" },
  [DRAFT_TYPE_KEYS.SOCIAL_CAPTION]: { route: "admin_only", slot: "social_caption" },
  [DRAFT_TYPE_KEYS.PRIVATE_NOTE]: { route: "admin_only", slot: "private_note" },
};

const DRAFT_SOURCE_COLUMNS = {
  [DRAFT_TYPE_KEYS.SESSION_RECAP]: { sourceSessionId: "source_session_id" },
  [DRAFT_TYPE_KEYS.PLAYER_PROFILE]: { sourcePlayerId: "player_id" },
  [DRAFT_TYPE_KEYS.PLAYER_SESSION_RECAP]: { sourcePlayerId: "player_id", sourceSessionId: "session_id" },
  [DRAFT_TYPE_KEYS.STANDINGS_SUMMARY]: { seasonCode: "season_code" },
  [DRAFT_TYPE_KEYS.MOMENT_BLURB]: { momentId: "moment_id" },
  [DRAFT_TYPE_KEYS.LEAGUE_ARTICLE]: { articleRequest: "article_request" },
  [DRAFT_TYPE_KEYS.SOCIAL_CAPTION]: {
    sourceSessionId: "session_id",
    sourcePlayerId: "player_id",
    seasonCode: "season_code",
    momentId: "moment_id",
    articleRequest: "article_request",
  },
  [DRAFT_TYPE_KEYS.PRIVATE_NOTE]: {
    sourceSessionId: "session_id",
    sourcePlayerId: "player_id",
    seasonCode: "season_code",
    momentId: "moment_id",
    articleRequest: "article_request",
  },
};

const SEASON_AWARE_DRAFT_TYPES = new Set([
  DRAFT_TYPE_KEYS.SESSION_RECAP,
  DRAFT_TYPE_KEYS.PLAYER_PROFILE,
  DRAFT_TYPE_KEYS.PLAYER_SESSION_RECAP,
  DRAFT_TYPE_KEYS.STANDINGS_SUMMARY,
  DRAFT_TYPE_KEYS.MOMENT_BLURB,
  DRAFT_TYPE_KEYS.LEAGUE_ARTICLE,
  DRAFT_TYPE_KEYS.SOCIAL_CAPTION,
  DRAFT_TYPE_KEYS.PRIVATE_NOTE,
]);

function mergePayload(base = {}, patch = {}) {
  const next = { ...(base || {}) };
  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === "object" && !Array.isArray(value) && next[key] && typeof next[key] === "object" && !Array.isArray(next[key])) {
      next[key] = mergePayload(next[key], value);
    } else if (value !== undefined) {
      next[key] = value;
    }
  }
  return next;
}

function hydrateDraftType(type) {
  if (!type) return null;
  return {
    ...type,
    editor: DRAFT_EDITOR_CONFIGS[type.key] || {},
    defaultPayload: DRAFT_DEFAULT_PAYLOADS[type.key] || {},
    publishTarget: DRAFT_PUBLISH_TARGETS[type.key] || { route: type.publicRoutePattern, slot: type.fallbackScope },
    sourceColumns: DRAFT_SOURCE_COLUMNS[type.key] || {},
    seasonAware: SEASON_AWARE_DRAFT_TYPES.has(type.key),
  };
}

export function getDraftType(typeKey) {
  return hydrateDraftType(draftTypes[typeKey]);
}

export function getDraftTypes() {
  return Object.values(draftTypes).map(hydrateDraftType);
}

export function getDraftVariation(typeKey, variationKey = "") {
  const draftType = getDraftType(typeKey);
  if (!draftType) return null;

  const requestedKey = String(variationKey || "").trim();

  return (
    draftType.variations.find((variation) => variation.key === requestedKey) ||
    draftType.variations.find((variation) => variation.key === draftType.defaultVariation) ||
    draftType.variations[0] ||
    null
  );
}

export function getDraftVariationOptions(typeKey) {
  return getDraftType(typeKey)?.variations || [];
}

export function getDraftPublicSlots(typeKey) {
  return getDraftType(typeKey)?.publicSlots || [];
}

export function getDraftTypeOptions() {
  return getDraftTypes().map((type) => ({
    key: type.key,
    label: type.label,
    endpoint: type.endpoint,
    requiredSource: type.requiredSource,
    draftTable: type.draftTable,
    fallbackScope: type.fallbackScope,
    seasonAware: type.seasonAware,
  }));
}

export function getDraftEditorConfig(typeKey) {
  return getDraftType(typeKey)?.editor || {};
}

export function getDraftDefaultPayload(typeKey, overrides = {}) {
  return mergePayload(getDraftType(typeKey)?.defaultPayload || {}, overrides);
}

export function mergeDraftPayload(base = {}, patch = {}) {
  return mergePayload(base, patch);
}

export function getDraftTypeByEndpoint(endpoint = "") {
  return getDraftTypes().find((type) => type.endpoint === endpoint) || null;
}

export function getDraftTypeByTable(table = "") {
  return getDraftTypes().find((type) => type.draftTable === table) || null;
}

export function getDraftTableConfig() {
  return Object.fromEntries(
    getDraftTypes()
      .filter((type) => type.draftTable)
      .map((type) => [
        type.draftTable,
        {
          table: type.draftTable,
          fallbackScope: type.fallbackScope,
          contentType: type.key,
          sourceColumns: type.sourceColumns,
          publishTarget: type.publishTarget,
          seasonAware: type.seasonAware,
        },
      ])
  );
}
