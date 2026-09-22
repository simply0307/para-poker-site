# First migration slice — local review

Date: 2026-09-22. Branch: `codex/eggs-shell`.
Baseline: `ca431bb734fab97c8da1dfeae0d515cf2ac1305f` from
`simply0307/para-poker-site`. Changes are local and uncommitted.

## Delivered

- EGGS home, shared navigation and a Para competition hub.
- Existing league home, player dossiers, sessions, standings, moments and
  articles mounted under `/para/poker/...` using the original views/repositories.
- League components and data/import/stat utilities contained in
  `src/modules/para-poker`; existing admin/API URLs and file-backed settings retained.
- Temporary redirects for all five legacy public route families, including
  descendants and query strings. Existing saved rich-text URLs remain usable.
- Music, library, profile and account entry points clearly describe planned
  functionality. Arbitrary profile handles return 404; no fake profile data,
  registration, consumer session or player-claim write is enabled.
- Independent UUID token verifier; legacy operator-role lookup and cookie
  retained. Service credentials are isolated behind `server-only` imports.
- All seven newsroom generation POST handlers now verify operator access
  before parsing input or calling providers/repositories. Malformed operator
  cookies fail closed; operator-session GET is explicitly uncached.
- Mobile league navigation wraps so every link remains reachable.

The schema recommendation is additive `eggs_profiles` plus owner preferences,
reviewed claims and explicit player FKs. Existing `profiles.auth_user_id` stays
the operator relationship. See [the full nine-part audit](eggs-architecture-audit.md).

## Verification evidence

| Check | Result |
| --- | --- |
| Next.js production build, without secrets | Pass, 16.3.6 |
| ESLint over source, scripts, tests and configuration | Pass |
| Operator authorization tests | 11 passed |
| Raw-hand, EGGS package and Gauntlet pure import tests | 20 passed |
| Disposable PGlite import acceptance tests | 2 passed |
| HTTP shell/security suites and built browser asset scan | 3 passed |
| Homepage, stats, training and ParaPoker import validators | All 4 passed |
| Dependency audit | 0 known vulnerabilities reported |
| Desktop browser | EGGS home and league navigation verified |
| Phone viewport (390 × 844) | Home fits; league links wrap and are visible |
| Browser console during navigation | No warnings/errors observed |
| Existing SQL and newsroom-library files versus baseline | No changes |

The HTTP tests launch their own loopback servers and disposable Supabase HTTP
fixtures. They exercise the real built Next application: unavailable state,
canonical public indexes and player/session dossiers, legacy redirect queries,
unknown profile/player 404s, anonymous 401s, non-operator 403s despite spoofed
user metadata, valid operator UUID/cookie handling, rejection of consumer
cookies at operator APIs, and no browser service-key references. Test fixture
requests are read-only; no real Supabase credentials or AI services are used.
These fixtures prove application behavior, not deployed database policy behavior.

The inherited dependency set included critical Next.js advisories. Next.js and
its ESLint config were patched from 16.3.0 to 16.3.6, compatible transitive fixes
were applied, and Supabase JS was pinned at the existing 2.108.2 release.
See the [Windows server advisory](https://github.com/advisories/GHSA-p293-qw3h-jr36)
and [image optimization advisory](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4).
The production build and import tests passed after the dependency update.

## Remaining work

The linked Supabase project is INACTIVE and the live information-schema read
timed out. Actual `profiles`/`players` column constraints, policies, grants,
triggers, storage permissions and Auth settings remain unverified. Live login,
real league data parity, publication and production imports were not exercised.
No schema migration, database write, push, deployment, or original-checkout
change was made. The destructive remote integration suite was not run.

Next: when that project is available, finish the read-only schema/RLS audit,
test the additive schema and access matrix in a disposable environment, then
implement consumer session/onboarding/profile CRUD and transactional,
operator-reviewed claims. Do not use legacy name matching to claim a player.

## Local preview and rollback

The review preview is served at `http://127.0.0.1:3107` while the local server
is running. Restart with `npm run start -- --hostname 127.0.0.1 --port 3107`
after `npm run build`, or use `npm run dev` for development.

There is no database rollback for this slice. Individual code hunks can be
reverted against the baseline; restore the old public routes and remove the
redirect config together if reverting routing. The separate original Para
checkout and its uncommitted files remain available unchanged. The legacy
domain's root redirect and permanent redirect status are cutover decisions.
