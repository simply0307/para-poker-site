export const HOMEPAGE_MODULE_DEFINITIONS = [
  {
    type: "hero_board",
    label: "Hero Board",
    description: "Top league identity block with latest-session context.",
  },
  {
    type: "stat_strip",
    label: "Stat Strip",
    description: "Quick public totals for sessions, players, moments, and leader.",
  },
  {
    type: "latest_session",
    label: "Latest Session",
    description: "Current recap doorway with winner, hand count, and biggest pot.",
  },
  {
    type: "current_standings",
    label: "Current Standings",
    description: "Condensed season board linking to the full standings page.",
  },
  {
    type: "featured_players",
    label: "Featured Players",
    description: "Top public player cards from the active board.",
  },
  {
    type: "featured_moments",
    label: "Featured Moments",
    description: "Notable hand cards from the moment archive.",
  },
  {
    type: "latest_articles",
    label: "Latest Articles",
    description: "Published newsroom coverage module.",
  },
];

export const DEFAULT_HOME_SETTINGS = {
  hero: {
    eyebrow: "Season 0 / Preseason / Current Board",
    title: "Para League",
    dek: "The first sessions are setting the board.",
  },
  modules: HOMEPAGE_MODULE_DEFINITIONS.map((module) => ({
    type: module.type,
    enabled: true,
  })),
  updatedAt: null,
};
