export const DRAFT_TYPE_KEYS = {
  SESSION_RECAP: "session_recap",
  PLAYER_PROFILE: "player_profile",
  PLAYER_SESSION_RECAP: "player_session_recap",
  STANDINGS_SUMMARY: "standings_summary",
  MOMENT_BLURB: "moment_blurb",
  LEAGUE_ARTICLE: "league_article",
};

export const draftTypes = {
  [DRAFT_TYPE_KEYS.SESSION_RECAP]: {
    key: DRAFT_TYPE_KEYS.SESSION_RECAP,
    label: "Session Recap",
    purpose: "Public article recap of one verified Para League session.",
    sourceType: "session",
    publicRoutePattern: "/sessions/[sessionId]",
    adminRoutePattern: "/admin/sessions/[sessionId]",
    guideFile: "09-session-recap-magic-guide.md",
    schemaKey: "sessionRecapDraftSchema",
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
    publicRoutePattern: "/players/[playerId]",
    adminRoutePattern: "/admin/players/[playerId]",
    guideFile: "10-player-profile-guide.md",
    schemaKey: "profileDraftSchema",
    defaultVariation: "identity_snapshot",
    variations: [
      {
        key: "identity_snapshot",
        label: "Identity Snapshot",
        instruction: "Summarize who the player is in the league record using only verified history and tendencies.",
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
    publicRoutePattern: "/players/[playerId] and /sessions/[sessionId]",
    adminRoutePattern: "/admin/players/[playerId]",
    guideFile: "11-player-session-recap-guide.md",
    schemaKey: "sessionRecapDraftSchema",
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
    publicRoutePattern: "/standings",
    adminRoutePattern: "/admin/standings",
    guideFile: "12-standings-summary-guide.md",
    schemaKey: "articleDraftSchema",
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
    publicRoutePattern: "/moments",
    adminRoutePattern: "/admin/moments",
    guideFile: "13-moment-blurb-guide.md",
    schemaKey: "articleDraftSchema",
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
    publicRoutePattern: "/articles/[articleId]",
    adminRoutePattern: "/admin/articles",
    guideFile: "14-league-article-guide.md",
    schemaKey: "articleDraftSchema",
    defaultVariation: "league_newsroom",
    variations: [
      {
        key: "league_newsroom",
        label: "League Newsroom",
        instruction: "Write the main official article voice: grounded, player-facing, and specific.",
      },
      {
        key: "feature_story",
        label: "Feature Story",
        instruction: "Use approved history to tell a broader player or session feature without inventing scenes.",
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
};

export function getDraftType(typeKey) {
  return draftTypes[typeKey] || null;
}

export function getDraftTypes() {
  return Object.values(draftTypes);
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