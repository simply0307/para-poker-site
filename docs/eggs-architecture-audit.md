# EGGS shell and Para Poker migration audit

Audit date: 2026-09-22. Implementation baseline: `simply0307/para-poker-site`
at `ca431bb734fab97c8da1dfeae0d515cf2ac1305f` (published HEAD, “Apply Para Poker
child identity system (#1)”). This workspace was an empty Git repository. Its
local branch starts from that snapshot. The initial shell is now committed as
`3c79b7f` and pushed to `codex/eggs-shell` in the existing repository.
The existing Para Poker checkout is at `7a4285d` and has user changes to package
files and newsroom settings. Those files were inspected but not imported or edited.

This is a direct local application implementation, not a Drive authority,
brand approval, database migration, or deployment. The supplied user request is
the architectural scope. Existing Para visual assets stay inside the league;
the EGGS shell is a functional application scaffold, not a new identity system
for the brand's artwork.

This document records the **pre-migration findings** and initial recommendation.
The seven unguarded endpoints and eager shared service client described below
were fixed in Phase 1. See [the implementation report](eggs-migration-status.md)
for current paths, endpoint coverage, validation and review status, and
[the unapplied consumer design](eggs-consumer-identity-proposal.md) for Phase 2.

## 1. Current architecture

| Layer | Existing implementation |
| --- | --- |
| Application | Next.js 16.3.0 App Router, React 19.2.4, Tailwind 4, local Roboto Flex |
| Public league | `src/app/page.js`, `players`, `sessions`, `standings`, `moments`, `articles`; detail routes accept existing IDs/slugs/codes |
| Presentation | `src/components/newsroom`, `src/components/poker`; view models under `src/lib/newsroom/viewModels` |
| Data | Server-side Supabase repositories for players, sessions, drafts, stats, videos, and training records |
| Editorial operations | `/admin/**`, `/api/admin/**`, seven `/api/*/generate` endpoints; drafts, editing, publication, evidence import |
| Settings | `newsroom-library/settings/*.json` and newsroom configuration utilities; retain filesystem paths for compatibility |
| Competition | `players`, `sessions`, `session_results`, `standings`, `hands`, `actions`, `notable_hands`, session/season/career aggregates |
| Authentication | Supabase Auth password sign-in; verified access token exchanged for an operator cookie |
| Operator authorization | `auth.users.id -> profiles.auth_user_id`, lookup of `admin`/`owner` role on each privileged API request |
| Import evidence | Raw-hand revision ledger and completed-session RPCs; Gauntlet imports adapt evidence into league operations, not universal identity |

`sql/20260807_admin_operator_authorization.sql` adds a nullable Auth UUID FK
with `ON DELETE SET NULL` and a partial unique index. Its email match is a
one-time legacy bridge. Runtime authorization uses the verified UUID only.
The full original DDL for `profiles` and `players` is absent. Code assumes
`profiles.id`, `email`, `role`, `auth_user_id`, and `players.id` (UUID), `slug`,
`display_name`, `pokernow_name`, `created_at` plus optional imagery. The disposable
test schema is explicitly inferred and is not proof of deployed constraints.

## 2. Reusable infrastructure

- Keep Supabase Auth as the authentication authority. Extract server-side
  `auth.getUser(accessToken)` verification without importing operator roles or
  a service-role client into ordinary EGGS authentication.
- Keep `operatorAuthorizationCore.mjs` and its tests as the independent
  authorization boundary. Consumer sign-in must not mint the operator cookie.
- Keep server/client separation, no-store authentication responses, and
  explicit identity links. Share only token verification and client creation
  appropriate to each privilege level, not broad repository access.

## 3. Para Poker ownership

The entire player dossier and its newsroom narrative remain a league view.
Statistics, league points, season rank, hands, session history, achievements,
newsroom content, rules, name normalization, imports, and generation workflows
belong to the Para Poker module. Do not move those fields into `eggs_profiles`.
Existing name joins remain historical display compatibility; they cannot prove
ownership of a player. Gauntlet will get its own profile association, not a
Poker player row masquerading as a universal identity.

## 4. Identity, RLS, and authorization gaps

1. No consumer registration/session lifecycle, handle reservation, profile
   privacy model, public EGGS projection, or player claim workflow exists.
2. Player repositories match some old records by normalized names and even
   substring fallback. Preserve historical display behavior, but never reuse
   that matching for claims or access control.
3. Seven generation POST routes (`articles`, `moments`, `player-session-recaps`,
   `profiles`, `recaps`, `social-captions`, `standings`) lack the operator guard.
   They invoke AI and persist drafts/logs. They require the same guard as admin
   operations before body parsing, provider calls, or repository execution.
   `/api/profiles/generate` means editorial player copy, not account creation.
4. `src/lib/supabase.js` initializes the service-role client eagerly and lacks
   a `server-only` import barrier. Both public server rendering and operator
   repositories use it; its comment incorrectly implies every use follows an
   operator check. Public server rendering must never be reused as a public
   consumer-profile API, because service-role access bypasses RLS.
5. Checked-in SQL enables RLS on newsroom draft/published/training tables,
   imports, evidence revisions, and aggregates. Import RPC grants restrict
   trusted workflows to `service_role`. The operator migration does not change
   RLS. Existing policies/grants for `profiles` and `players` are not established
   by this repository.
6. The linked project `uzderzjbitmghfvrllvz` was identified from the existing
   checkout's Supabase URL; the connector lists it as INACTIVE. A read-only
   information-schema query timed out. Live policies, grants, triggers, views,
   FK types, Auth settings, and deployed migration state are UNVERIFIED.
   No restoration, migration, or data mutation was attempted.

Service-role inventory (before relocation): only `src/lib/supabase.js` reads
`SUPABASE_SERVICE_ROLE_KEY`. Direct consumers: operator authorization;
`stats/statRepository.js`; newsroom `data.js`, `drafts.js`, `trainingExamples.js`,
`articleVideoAttachments.js`, `momentVideoAttachments.js`; the three newsroom
repositories; admin article/moment video routes. Other league modules consume
the client indirectly via newsroom data exports. The operator login form uses
only the publishable key. Database tests use separate `SUPABASE_TEST_*`
configuration and a destructive-test opt-in; they must never target production.

## 5. Proposed target schema (design only; no migration applied)

| Table | Keys and fields | Access / lifecycle |
| --- | --- | --- |
| Existing `profiles` | Preserve every existing field, `auth_user_id` FK/index, role semantics | Operator/legacy authorization; no consumer update policies |
| `eggs_profiles` | `id uuid PK`, `auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id)`, `handle text NOT NULL`, `display_name`, `avatar_path`, `bio`, `visibility`, timestamps | Owner create/update; narrow public presentation read only for public profiles; no email, role, or game stats |
| `eggs_profile_preferences` | `profile_id uuid PK/FK`, presentation preferences, privacy preferences | Owner only; separate from public presentation |
| `para_poker_profile_links` | `profile_id uuid UNIQUE FK eggs_profiles`, `player_id uuid UNIQUE FK players`, `verified_by` Auth UUID, `verified_at`, `show_on_profile` | Approved association only; consumer cannot insert/change ownership; deleting an EGGS profile removes its link, never league history |
| `para_poker_player_claims` | `id uuid PK`, claimant profile FK, player FK, status, submitted/reviewed timestamps, reviewer Auth UUID, evidence reference | Claimant can submit/read own pending claim; only verified operator can approve/reject; evidence and review notes private |

Canonical lowercase handles: 3–30 ASCII letters/digits/underscore with a
database CHECK, uniqueness constraint, and reserved-name rule. A handle is a
mutable public address, never an identity key. Reserve historical handles or
introduce handle aliases before allowing renames, so old profile links cannot
be reassigned silently. Avatar paths refer to an owner-scoped storage bucket;
storage policies must be reviewed separately.

Auth UUID anchors ownership. An independent public profile UUID avoids exposing
Auth UUIDs as profile addresses. Use column privileges or a deliberately narrow
public projection so public reads cannot disclose `auth_user_id`; RLS alone
does not hide columns. A view must use `security_invoker = true` with compatible
underlying grants, or expose a server DTO over a user-scoped client. Do not add
a definer view/function to bypass those controls.

For account deletion, remove preferences/claims/approved links and public
presentation, retain league `players` and competition records. Choose the exact
Auth-to-EGGS FK deletion action after confirming existing retention behavior.
Do not change the legacy `profiles` FK's existing `SET NULL` behavior.

Claim approval must run in one transaction with unique constraints and locks:
verify reviewer role, confirm claimant is the requesting UUID's profile,
confirm player exists, reject conflicting existing links, approve claim and
write link atomically, record reviewer. No email, display name, PokerNow name,
or slug matching. Project associations are explicit FK tables; avoid a generic
`project_type + arbitrary_id` relation that cannot enforce foreign keys.

RLS acceptance matrix required before activation: anonymous users see only the
public DTO; owner can edit only allowed presentation/preferences fields;
another user cannot read private rows or alter ownership; no user can edit
`profiles.role` or approve a claim; operators retain their original authority.
Explicit grants are required in addition to policies. Private profile summaries
and private library/song data must not use public ISR caches.

**Recommendation: introduce `eggs_profiles`.** Extending `profiles` avoids one
table and join, but entangles user-editable presentation with privileged roles,
unknown legacy consumers, deletion behavior, and existing policy semantics.
A new additive table costs one UUID association and explicit provisioning but
keeps the security boundary intact. Do not rename or migrate existing records
for naming consistency. Music, library items, publications, and artifacts get
separate owner-linked tables when their behavior is defined, not speculative
columns or fake records now.

## 6. Folder and route structure

```text
src/app/layout.js                  shared EGGS navigation, document metadata
src/app/page.js                    EGGS home
src/app/para/page.jsx              organized competition hub
src/app/para/poker/**              thin adapters to existing league pages
src/app/profile/[handle]/**        reserved; no synthetic user profiles
src/app/music, library, login      honest future-feature entry points
src/app/admin/**                   existing operator workspace (URLs retained)
src/app/api/admin/**               existing protected operator APIs
src/app/api/*/generate/**          protected legacy newsroom APIs
src/modules/para-poker/pages/**    existing public league views
src/modules/para-poker/components  newsroom, poker, admin-newsroom
src/modules/para-poker/lib/**      newsroom, stats, poker, imports, league
src/lib/auth/**                    shared token verification + separate operator guard
src/lib/supabase/**                explicit server-side privilege boundaries
newsroom-library/**               existing on-disk league settings retained
sql/**                            existing migrations retained byte for byte
```

Redirect `/players`, `/sessions`, `/standings`, `/moments`, `/articles` and
their descendants to `/para/poker/...`; keep query strings, IDs and fragments.
Do not redirect `/` on the EGGS host: it is now EGGS home. Preserving the old
league domain's root requires a host-level redirect to the new league home at
deployment, which cannot be inferred or configured without the domain decision.
Admin and API URLs remain stable during this phase. Update public links inside
operator tools and view models as well as navigation.

## 7. Migration sequence and checkpoints

1. Record this audit and exact baseline. Preserve the original dirty checkout.
2. Add EGGS shell/navigation and clear future-feature states. Keep league artwork
   scoped to Poker. No pretend profiles or consumer login backed by operators.
3. Relocate league code mechanically; add thin public route adapters, compatibility
   redirects, and update internal links. Retain imports, settings, SQL and admin
   contracts. Close the seven missing generation guards and enforce server-only
   service credentials. Extract UUID verification without role semantics.
4. Verify build, lint, existing validations/import suites, guarded API denial,
   redirects and public pages in a local browser. Separate disconnected rendering
   from successful real-data verification.
5. When the linked database is available, read columns/constraints/indexes,
   policies/grants/triggers/views, function privileges and Auth/storage settings.
   Resolve any broad role/profile writes before enabling consumers.
6. Implement/test additive schema in a disposable database; only then prepare
   a reviewed migration. Add consumer sessions, signup/confirmation/recovery,
   profile onboarding, handle conflicts, privacy and owner-scoped updates.
7. Add transactional operator-reviewed player claims. Profile module returns
   summarized league records by approved FK and links to the full dossier.
8. Add Gauntlet and later content modules with independent FKs and storage.

Each local code step can be reverted to the recorded upstream commit. No schema
rollback is needed for this phase. Redirects are temporary (307) during review
to avoid sticky browser caches; switch to permanent redirects at final cutover.

## 8. File disposition

| Existing files | Treatment |
| --- | --- |
| `src/app/page.js` and public league route pages | Move views to module; mount at `/para/poker`; EGGS owns root |
| `src/app/layout.js` | Adapt global layout and metadata; league child metadata stays local |
| `src/components/{newsroom,poker,admin-newsroom}` | Move intact to module; update imports/public links |
| `src/lib/{newsroom,stats,poker,imports,league}`, `playerNames.js` | Move to module; retain data/model semantics |
| `src/lib/auth/operatorAuthorizationCore.mjs` | Preserve operator roles/cookie, harden malformed credential handling if needed |
| `src/lib/auth/operatorAuthorization.js` | Reuse guard with shared server token verifier and legacy role lookup |
| `src/lib/supabase.js` | Compatibility export backed by server-only, lazy clients; never share service-role client with consumers |
| `src/app/api/operator-session/route.js`, `operator-login/*`, `admin/*`, `proxy.js` | Retain operational behavior and paths; public return links target Poker |
| Seven generation handlers | Add operator verification before existing logic |
| `next.config.mjs` | Add reversible public redirects; retain existing headers |
| `scripts/*`, `tests/*` | Update moved source paths; extend security/routing checks |
| `sql/*`, `newsroom-library/*`, existing art/fonts | Preserve; no retired schema or game records |

## 9. Risks and verification limits

- Module moves can break aliases, relative imports and validation scripts.
  Build plus all existing local validations and pure/acceptance tests are required.
- Rich text and saved external links may contain old URLs; compatibility
  redirects preserve them. No global replacement of stored article content.
- Public pages currently swallow many query errors into empty lists. A missing
  configuration must be presented as unavailable, not invented standings.
- Shared CSS and document metadata can leak identity between modules. Keep
  Poker assets/styles and child metadata; inspect desktop/mobile navigation.
- Service-role public data reads bypass RLS. Add compile-time server barriers;
  do not expand them to EGGS public/private user data.
- Generation endpoints becoming protected may affect unofficial unauthenticated
  callers. Existing operator UI sends its same-origin cookie automatically.
- Live login, deployed RLS, database-backed dossier parity, signing/storage and
  real import/publish operations cannot be certified while Supabase is inactive.
- Filesystem-backed operator settings need persistent hosting storage; this
  pre-existing constraint is not fixed by adding the shell.

Documentation checked: [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[API grants](https://supabase.com/docs/guides/api/securing-your-api),
[Next.js redirects](https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects),
[server/client boundaries](https://nextjs.org/docs/app/getting-started/server-and-client-components).
The current Supabase changelog was checked; opt-in Data API grants affect the
future schema. No relevant change requires replacing the existing getUser check.
