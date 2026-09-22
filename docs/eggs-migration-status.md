# EGGS Phase 1 implementation report

Follow-up: [Phase 2 live audit and unapplied migration candidate](eggs-phase2-identity-audit.md).
The Phase 1 status below records the earlier checkpoint.

Date: 2026-09-22. Scope: finish the shell migration and make the existing Para Poker boundary reviewable before consumer account work.

## 1. Repository and review

Existing repository: `simply0307/para-poker-site`. Branch: `codex/eggs-shell`. Baseline: `ca431bb734fab97c8da1dfeae0d515cf2ac1305f`. Initial migration commit: `3c79b7f` (`Create EGGS shell and contain Para Poker public routes`). The following hardening commit contains this report; use the branch head for its exact SHA. Review `main...codex/eggs-shell`, including both commits.

The original desktop Para Poker checkout and its uncommitted work were not modified. No new repository/project, production deployment or database change was made. SQL, newsroom-library settings and import fixtures remain unchanged from baseline. Existing public image URLs remain stable.

## 2. Route map

| Routes | Meaning |
| --- | --- |
| `/` | EGGS home |
| `/para` | Para organized competition hub |
| `/para/poker` | Existing league homepage |
| `/para/poker/players`, `/para/poker/players/[playerId]` | Player index and full dossier; existing ID/slug lookup retained |
| `/para/poker/sessions`, `/para/poker/sessions/[sessionId]` | Session archive and coverage; existing ID/code lookup retained |
| `/para/poker/standings` | League standings |
| `/para/poker/moments`, `/para/poker/moments/[momentId]` | Moments and detail |
| `/para/poker/articles`, `/para/poker/articles/[articleId]` | Articles and detail |
| `/music`, `/library`, `/profile`, `/login` | Informational placeholders; no consumer product/session behavior |
| `/profile/[handle]` | 404 until genuine consumer profiles exist |
| `/admin/**` | Existing Para Poker operator workflows |
| `/operator-login`, `/operator-denied` | Existing operator entry/denial |
| `/api/admin/**`, seven `/api/*/generate`, `/api/operator-session` | Existing league API URLs |

## 3. Ownership audit

| Classification | Source boundary and decision |
| --- | --- |
| Shared EGGS | Root layout, `globals.css`, `eggs.css`, EGGS home/placeholders, `src/components/eggs`, `src/lib/auth/verifiedIdentity.js`, `src/lib/supabase/server.js`; shared Auth client uses publishable credentials only |
| Para | `src/app/para/page.jsx`; competition landing page only, with no speculative competition repository or account model |
| Para Poker | `src/modules/para-poker`: pages, components, newsroom/poker/stats/import/league libraries, name utilities, `routes.mjs`, scoped `styles.css`, server-only service client; thin adapters at `src/app/para/poker` |
| Operator/admin | `src/app/admin/(para-poker)`, `src/app/api/(para-poker)`, `src/app/(para-poker-operator)`, module `lib/auth` and `components/admin-newsroom`; framework entry `src/proxy.js` has a Poker-only `/admin` matcher |

Repositories, generation prompts, presentation settings, drafts, training capture, video attachments, stats and dossiers belong to Para Poker. Existing Gauntlet import code adapts evidence into this league; it does not establish generic EGGS or Gauntlet account identity.

`newsroom-library`, league SQL, public assets, operational scripts and fixtures retain established paths to avoid persistence/import/URL churn. They are Poker assets, not implicit shared infrastructure. League typography and rich-text rules are scoped to `.para-poker-module`; global background/text colors now belong to the EGGS shell.

## 4. Legacy redirects

Five temporary 307 families remain: `/players/:path*`, `/sessions/:path*`, `/standings/:path*`, `/moments/:path*`, `/articles/:path*` map directly to `/para/poker/...`. Tests cover indexes, descendants and queries. Permanent status and the original league domain's root cutover are deferred decisions.

## 5. Internal links

Public/admin navigation, dossier/session/hand anchors, view models and generated URL strings use `/para/poker/...` directly. Code/settings scans enforce this. Stored rich-text links are canonicalized during rendering, preserving escaped identifiers, queries and anchors; external links stay untouched. No stored articles or database records were rewritten.

## 6. Admin ownership

All 18 current admin pages are Poker newsroom/league operations. Moving public URLs to `/admin/para/poker` would also require changing navigation, Proxy matching and bookmarked workflows. This phase uses explicit source route groups and league-specific copy. Next route groups do not alter URLs. `/admin` remains a Poker compatibility entry, not the permanent universal EGGS admin design. A future EGGS selector and project URL migration require separate operational review.

## 7. Authentication boundaries

`verifyAccessToken()` verifies Supabase Auth and returns its UUID only. Module-owned `requireOperator()` queries the exact existing `profiles.auth_user_id` and accepts only existing `admin`/`owner` roles. The operator cookie, fail-closed responses and uncached session handling remain. Metadata, names, email and a putative consumer cookie confer no operator role.

Phase 2 may build `requireEggsUser()` on shared verification with a request-scoped user-token data client and owner RLS. It must not reuse operator authorization, the league service client or the operator cookie. No consumer guard/session is implemented here.

## 8. Privileged endpoint audit

31 API paths export 49 methods. All 48 privileged methods invoke `requireOperator()` before parsing, provider or repository work. The sole exception, `DELETE /api/operator-session`, only clears the caller's cookie. The seven generation POSTs are articles, moments, player-session-recaps, profiles, recaps, social-captions and standings. `profiles/generate` is Poker editorial copy.

Static checks enumerate source exports. Built-app HTTP tests enumerate the same inventory and prove anonymous 401 and non-operator 403 for **every** protected method, including spoofed role metadata. Dataset export keeps its operator cookie plus separate export token. Valid operator sessions and representative admin pages work with disposable HTTP fixtures. Fixture backend requests were read-only; no real provider calls or successful live writes were performed. See [the complete inventory](admin-operator-authorization.md).

## 9. Consumer schema proposal — unapplied

`auth.users -> eggs_profiles -> para_poker_profile_links -> players` uses stable FKs. General presentation, handle, avatar and privacy belong to `eggs_profiles`; Poker stats/game state remain in the league. A private claim queue plus atomic operator review establishes an association; unique constraints prevent conflicting owners. Future summaries link to the full dossier. See [fields, access matrix and claim flow](eggs-consumer-identity-proposal.md). No consumer SQL file was emitted because deployed types/grants are unverified.

## 10. Live blockers

The existing Supabase project reports INACTIVE; the earlier information-schema read timed out. Required read-only verification: actual `profiles`/`players` DDL and deployed migrations; FK/unique constraints and conflicting mappings; table/column/function grants and RLS policies; security-definer functions, views and triggers; Auth signup/provider/verification/session settings; storage ownership policies and deletion behavior. Live operator login, data parity, publication and production imports remain unverified. Local fixtures/PGlite cannot establish those live facts.

## 11. Validation

| Check | Result |
| --- | --- |
| `npm run build` | Passed, Next.js 16.3.6, without secrets |
| `npm run lint` | Passed, no warnings |
| `npm test` (all test files) | 41 passed, 0 failed, 1 skipped |
| Included authorization | 11 operator tests; all 48 protected methods exercised through HTTP |
| Included boundaries/links | 5 containment, canonical-link and redirect tests |
| Included imports | 20 pure tests, 2 disposable PGlite acceptance tests |
| Included built application | 3 HTTP/asset suites: shell, dossiers, admin, redirects, auth, browser-secret scan |
| Four existing validators | Homepage, stats, training capture, ParaPoker import all passed |
| Dependency audit | 0 known vulnerabilities reported |
| Browser | EGGS shell, league navigation, mobile 390 x 844 layout and anonymous admin redirect verified; no console warnings/errors observed |

Failures: none. Build/lint/test/validator warnings: none. Git initially reported Windows line-ending normalization notices; source text uses explicit LF rules. The single skipped test is the destructive remote database integration case. The default runner explicitly disables it even if credentials are inherited. It needs a confirmed disposable environment and is not counted as a pass.

## 12. Review before Phase 2

Review the whole branch against `main`, especially the public route move and dependency security patch; stable admin URLs; the old domain/root cutover; and profile privacy, handles, claim evidence, transfer and deletion rules. Preserve the detailed league dossier. Complete live schema/RLS verification, then test additive SQL and concurrent claim decisions in a disposable environment before applying it.

The next product scope remains authentication -> profile -> reviewed player link -> Poker summary -> full dossier. Music, library, social, song and artifact feature work are outside this phase.

The local preview uses `http://127.0.0.1:3107`. Start it after a build with `npm run start -- --hostname 127.0.0.1 --port 3107`. Rollback is code-only: restore route adapters and redirect configuration together. No database rollback is needed for this branch.
