export const POKER_ROOT = "/para/poker";
export const POKER_SECTIONS = ["sessions", "players", "standings", "moments", "articles"];

// Canonicalize local league links in stored/generated rich text at rendering
// time, without rewriting database content or guessing external host identity.
export function canonicalPokerHref(value) {
  const href = String(value || "").trim();
  return /^\/(sessions|players|standings|moments|articles)(?=\/|[?#]|$)/u.test(href)
    ? `${POKER_ROOT}${href}`
    : href;
}

// Temporary during review. Switch to permanent at final cutover.
export const legacyPokerRedirects = POKER_SECTIONS.map((section) => ({
  source: `/${section}/:path*`,
  destination: `${POKER_ROOT}/${section}/:path*`,
  permanent: false,
}));
