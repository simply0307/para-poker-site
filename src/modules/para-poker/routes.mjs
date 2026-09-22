export const POKER_ROOT = "/para/poker";
export const POKER_SECTIONS = ["sessions", "players", "standings", "moments", "articles"];

// Temporary during review. Switch to permanent at final cutover.
export const legacyPokerRedirects = POKER_SECTIONS.map((section) => ({
  source: `/${section}/:path*`,
  destination: `${POKER_ROOT}/${section}/:path*`,
  permanent: false,
}));
