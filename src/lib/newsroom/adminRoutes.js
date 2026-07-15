export const ADMIN_ROUTE_GROUPS = [
  {
    key: "dashboard",
    label: "Dashboard",
    links: [
      {
        href: "/admin",
        label: "Dashboard",
        title: "Newsroom Control Room",
        description: "Top-level admin hub for pipeline, newsroom, presentation, and league ops.",
        showOnDashboard: false,
      },
      {
        href: "/",
        label: "Public Site",
        title: "Public Site",
        description: "Open the public Para-Poker League homepage.",
        showOnDashboard: false,
      },
    ],
  },
  {
    key: "data_pipeline",
    label: "Data Pipeline",
    links: [
      {
        href: "/admin/imports",
        label: "Imports",
        title: "Imports",
        description: "Review CSV import health, hand/action coverage, and data pipeline status.",
      },
      {
        href: "/admin/sessions",
        label: "Sessions",
        title: "Session Drafts",
        description: "Choose a session and generate public recap drafts.",
      },
      {
        href: "/admin/players",
        label: "Players",
        title: "Player Drafts",
        description: "Choose a player and generate profile drafts.",
      },
      {
        href: "/admin/standings",
        label: "Standings",
        title: "Standings Drafts",
        description: "Generate current board and standings pulse drafts.",
      },
      {
        href: "/admin/rules",
        label: "Rules",
        title: "Rules Admin",
        description: "Set scoring rules, preview standings, and apply recalculations.",
      },
    ],
  },
  {
    key: "newsroom",
    label: "Newsroom",
    links: [
      {
        href: "/admin/drafts",
        label: "Drafts",
        title: "Draft Studio",
        description: "Jump between draft queues and publishing workspaces.",
      },
      {
        href: "/admin/articles",
        label: "Articles",
        title: "Article Drafts",
        description: "Generate, edit, publish, unpublish, and delete live league articles.",
      },
      {
        href: "/admin/moments",
        label: "Moments",
        title: "Moment Drafts",
        description: "Select detected moment candidates, choose an angle, attach video, and publish blurbs.",
      },
      {
        href: "/admin/social-captions",
        label: "Social Captions",
        title: "Social Captions",
        description: "Generate short social/card copy from verified league data.",
      },
      {
        href: "/admin/prompt-studio",
        label: "Prompt Studio",
        title: "Prompt Studio",
        description: "Build reusable prompt configs through form controls.",
      },
      {
        href: "/admin/content-types",
        label: "Content Types",
        title: "Content Types",
        description: "Inspect the canonical registry for prompts, generators, editors, and public slots.",
      },
      {
        href: "/admin/newsroom",
        label: "Prompt Library",
        title: "Newsroom Library",
        description: "Prompt docs, assignment layers, and generation notes.",
      },
    ],
  },
  {
    key: "presentation",
    label: "Presentation",
    links: [
      {
        href: "/admin/settings",
        label: "Settings",
        title: "Settings",
        description: "Season status, homepage modules, page heroes, and presentation defaults.",
      },
      {
        href: "/admin/events",
        label: "Events",
        title: "Event Draft Room",
        description: "Stage future table cards for homepage modules before the game-site feed is connected.",
      },
    ],
  },
];

export function getAdminDashboardRoutes() {
  return ADMIN_ROUTE_GROUPS.flatMap((group) =>
    group.links
      .filter((link) => link.showOnDashboard !== false)
      .map((link) => ({ ...link, group: group.label }))
  );
}
