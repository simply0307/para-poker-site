# EGGS consumer identity: manual claims and production review

Latest checkpoint: [PR #2 rebase and staging security verification](eggs-identity-rebase-staging-20260923.md). PR #3 / `629e5b4` is the production baseline; its authorization and Gemini fixes are preserved. That checkpoint supersedes the test counts and unresolved security-test status below.

Reviewed September 23, 2026. Continues commit `64192b0` and
[draft PR #2](https://github.com/simply0307/para-poker-site/pull/2).
**Local implementation and validation are complete. Isolated $0 hosted staging
is provisioned; the real Auth/profile/claim flow is partially verified, with
PKCE and the operator-review-to-logout sequence still incomplete.
Production migration, production Auth changes and consumer rollout have not occurred.**
`EGGS_CONSUMER_ENABLED` remains false by default.

This report supersedes claim/deletion proposals and test counts in the
[historical audit](eggs-phase2-identity-audit.md) and
[initial proposal](eggs-consumer-identity-proposal.md).

## Migration and exact comparison

The existing candidate, still unapplied to production, was revised in place:
[20260922231308_eggs_consumer_identity_reviewed_claims.sql](../supabase/migrations/20260922231308_eggs_consumer_identity_reviewed_claims.sql).
There is no second production migration. Its SHA-256 with LF line endings is
`4413c817e9bd5e0473e093e4c3894c18ffc4f6fcfe8a1a702d7a8ad6a37aa292`.

The exact SQL-only patch against the requested starting commit is reproducible:

```sh
git diff 64192b0 HEAD -- supabase/migrations/20260922231308_eggs_consumer_identity_reviewed_claims.sql
```

The same patch is supplied locally as
`artifacts/eggs-claim-simplification-migration.diff`. Commit history provides
the durable comparison; the generated patch is not a migration input.

| Change from `64192b0` | Revised behavior |
| --- | --- |
| Pending claims | No automatic expiration. Only explicit approval, rejection or claimant withdrawal resolves a pending claim. |
| Evidence | Submitted text stays attached before and after resolution, irrespective of age. Claimant/operator access remains private. |
| Schema | Removed evidence-expiry/redaction columns, constraint/index, hold tables/indexes and worker-status table. Three public tables and the private handle registry remain. |
| Functions and triggers | Removed deadline calculation/filtering, late-review refusal, batch worker, hold management and worker-health RPCs. A BEFORE INSERT identity stamp preserves the original claimant UUID only. |
| Deletion | Detaches live profile FK and approved link without changing claim status, evidence or decisions. Operators can reject an orphaned pending claim; approval requires a live claimant. |
| Application | Removed hold endpoint/UI, health UI, scheduled Netlify function/helper, worker environment variables and related configuration/tests. Queue returns only claims. |
| Preserved | Canonical immutable handles, permanent reservations, narrow grants/RLS, live-session checks, atomic review, reviewer attribution and Poker-summary opt-in. |

All automatic claim retention, timeout, redaction, hold and monitoring machinery
is gone from the candidate and application. No scheduler, maintenance key or
retention deployment remains as a launch dependency. Database transaction
lock/statement timeouts and Auth token expiration serve their original purposes;
neither expires claims or evidence.

## Schema, access and durable history

The three public tables are `eggs_profiles`, `para_poker_player_claims` and
`para_poker_profile_links`. Consumer identity is separate from operator
`profiles`. All relationships use the audited UUID keys.

Postgres enforces ASCII lowercase handles, 3–30 characters, reserved names,
uniqueness and immutable identity. Direct SQL cannot evade these constraints.
The unchanged private `handle_registry` reserves a name in the registration
transaction and permanently retires it on deletion. It stores no Auth/profile
UUID. Concurrent registration and deletion cannot release or reuse a name.

Claims preserve ID, live claimant relationship and durable claimant UUID,
player UUID, submitted evidence, status, submitted/resolved/reviewed timestamps,
decision source, reviewer live Auth FK, durable operator-profile reference,
reviewer role and reason. Links preserve the approved association and claim ID.

All four new tables enable and force RLS. Broad inherited grants are revoked
on new objects only. Legacy tables, rows, policies, grants and functions remain
unchanged. `eggs_private` must stay outside Data API exposed schemas. Public
views/wrappers use SECURITY INVOKER; checked private definer helpers have fixed
search paths.

| Caller | Allowed behavior |
| --- | --- |
| Anonymous | Public presentation, explicitly shown links and bounded public league facts. No claims or Auth UUIDs. |
| Confirmed owner with live session | Own profile CRUD, own claims/evidence, submission/withdrawal, own link visibility. |
| Unrelated authenticated user | Public visibility only for another profile; no private claims/evidence. |
| Existing admin/owner operator | Existing application guard plus fresh DB role/session checks for queue and decisions. No arbitrary consumer profile edits. |
| Service role | SELECT on new public tables; no direct INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER grants or claim-maintenance RPC. Inherited legacy permissions are unchanged. |

Ordinary column SELECT cannot expose raw evidence or Auth UUIDs. Bounded
claimant/operator RPCs return evidence without an age filter. The null-safe
private-helper access guard from `64192b0` remains intact.

## Review, concurrency and deletion

Consumers select an existing player UUID and optionally provide up to 2,000
characters of supporting text. A duplicate pending submission returns the
existing claim without replacing evidence. Names/emails never establish
ownership. The operator queue has approve/reject decisions, a required 3–500
character reason, status filters and pages of 50.

Review checks fresh operator authority and locks role/identity rows, then
claimant profile, player and claim in consistent order. Approval and its link
commit atomically. Uniqueness by both profile and player prevents replacing
another association. Conflicts leave the losing claim pending. Identical
decision retries preserve original attribution/reason; opposite decisions
fail. Withdrawal is claimant-only and idempotent.

Deleting a consumer profile removes its link and nulls its live claimant FK.
Evidence and status stay unchanged, including pending claims. Orphaned pending
claims stay in the queue with approval disabled and explicit rejection enabled.
Concurrent deletion fails review closed if its claimant changes while locks
are acquired.

Deleting an Auth user cascades to their consumer profile. The existing operator
`profiles.auth_user_id ON DELETE SET NULL` behavior is preserved. Reviewer
deletion nulls the live Auth FK while preserving its operator UUID snapshot.
Players, sessions, hands, actions, imports and league evidence survive account
removal. Handles stay reserved; the former public URL returns 404. Durable UUIDs
are pseudonymous audit references, not guaranteed anonymity.

## Authentication and profile scope

Email/password signup uses confirmed Supabase Auth and PKCE with the fixed
`EGGS_SITE_URL/auth/callback`; callback redirects only to `/profile`.
Consumer requests use fresh publishable-key clients carrying the user's token.
Admission verifies the Auth user, confirmation and live `auth.sessions` row,
independently of operator cookies, metadata roles, names or email matching.

Consumer cookies have their own namespace, HttpOnly, SameSite=Lax, Secure on
HTTPS and path `/`. The PKCE verifier lasts one hour. Private responses are
no-store, writes enforce the configured origin, and the proxy refreshes sessions
before private rendering. Logout revokes the current consumer session and clears
its cookies; remote revocation failure is reported. Old-token replay must fail
the DB session check; hosted confirmation is still required.

Onboarding requires only a handle; profiles default private. Owners edit display
name, short bio and visibility. Public profile routes use anonymous clients;
private/unknown handles return 404. Approved links default hidden. Public profile
visibility and explicit owner opt-in are both required for the small Poker
summary linking the full UUID-based league dossier.

Music, library, songs, friends, feeds, handle changes and transfers remain out
of scope. No new profile feature, account-deletion UI or Auth admin API was added.

## Verification

| Check | September 23 result |
| --- | --- |
| Production Next build | Passed |
| ESLint | Passed, no warnings |
| Full `npm test` | 63 passed, 0 failed, 1 skipped; 64 records |
| Disposable native PostgreSQL 17.6 | 18 scenarios plus parent: 19 passed, none skipped |
| Consumer HTTP/core tests | 3 passed within full suite |
| Homepage, stats, training and Para Poker import validators | All four passed |
| Operator API authorization | All 50 protected methods covered after hold-endpoint removal |
| Local browser follow-up | Synthetic operator login; decade-old orphaned pending claim; disabled approval; explicit rejection; evidence/reason still visible afterward |

The skip is the inherited opt-in remote raw-hand import integration test.
Identity tests ran fully. No dependency versions changed; the prior dependency
audit is historical evidence, not a new scan in this follow-up.

PostgreSQL tests cover anon/owner/unrelated/operator access, claim submission
and withdrawal, live-session admission, direct helper denial, direct SQL
canonical constraints, permanent handle races, same-claim/competing-profile/
competing-player approvals, a competing approval after rollback, deletion,
attribution, drift failure and complete DDL rollback. Independent backend
connections and observed blocking establish real concurrency. Before/after
hashes and catalog/grant/RLS snapshots preserve the audited 17-table synthetic
Poker/operator baseline.

New age tests backdate pending claims ten years, then approve, reject or
withdraw them explicitly. Resolved records backdated nine years still expose
evidence only to claimants/operators. Catalog assertions require exactly the
intended claim columns and only the handle registry in the private schema.

The disposable database includes the affected audited catalog, Auth helpers and
session columns, not the whole hosted Auth/email/PostgREST platform. HTTP tests
exercise PKCE, cookies, refresh, privacy and logout against synthetic transport
fixtures. Local results do not establish hosted success.

## Hosted staging results

Separate [EGGS staging](https://eggs-consumer-staging.netlify.app) now uses
Supabase `xokrweqdvkfcexczsewl`, created after an exact $0/month quote in the
existing Free organization. The new Netlify site is Git-connected to
`simply0307/para-poker-site`, branch `codex/eggs-shell`. Neither legacy Poker
site was repointed. The inactive `creative os` project was restored for its
read-only audit, found to contain useful Reath records, and returned to INACTIVE
without repurposing it. See the [cost and isolation record](eggs-zero-cost-staging.md).

The staging database contains the 17-table audited legacy schema fixture without
production rows, followed by the exact revised consumer candidate. Real hosted
Auth tables were preserved. Staging-only Auth Site URL and callback are the
new staging origin and its exact `/auth/callback`. Email confirmation remains
enabled. Eight anonymous PostgREST checks pass. One explicitly authorized real
staging account has now signed up and confirmed its email.

The new site's test deployment `6ab3ff12f45c7abc5529d81b` uses commit `bd58480`
and its isolated Supabase credentials. `EGGS_CONSUMER_ENABLED=true` is limited
to that site's published context for the authorized test window. Other staging
contexts remain disabled; production consumers remain disabled. The portal
follow-up is local only and needs no deploy to continue this hosted flow.
No production credentials are installed on staging.

| Required hosted check | Result |
| --- | --- |
| Anonymous PostgREST access | Eight checks passed: public projections allowed; Auth UUIDs, claims, writes, review and private schema denied |
| Disabled hosted app | Passed before the authorized staging test window; current isolated staging consumers are enabled |
| Real signup and confirmation email delivery | Passed with the authorized staging-only mailbox; Auth records confirm email verification |
| PKCE callback | Incomplete: first successful email verification did not yield a proven callback session; retries of the consumed link returned `otp_expired` |
| Login and token refresh | Password login passed after confirmation; refresh remains unverified |
| Logout/session invalidation and old access/refresh replay | Not verified against hosted Auth/PostgREST |
| Private/public/owner/unrelated-user profile access | Owner creation/edit passed through real UI; anonymous private profile 404 and explicit public profile 200 passed; unrelated-user test remains |
| User-token PostgREST grants and direct RPC access | Owner app operations passed; explicit direct PostgREST/RPC matrix remains incomplete |
| Claim submission and withdrawal | Passed via real UI; withdrawn evidence retained; a new synthetic-player claim is pending |
| Operator review and competing claims | Operator sign-in awaits user completion; hosted approval/conflicts unverified; local independent-connection conflict tests pass |
| Poker-summary default-hidden and explicit opt-in | Not verified on hosted staging |

The isolated operator mapping uses the same test Auth identity; it does not
prove an independent-reviewer flow. The original callback failure is not
resolved by password login. See the [portal acceptance plan](eggs-portal-integration-plan.md)
for current project boundaries, league findings, and the next verification order.

## Live launch-security findings

Read-only checks confirm no `public.eggs_profiles`, no `eggs_private` schema
and eight historical migration entries. The candidate remains unapplied to production.
Production data and Auth settings were not changed.

1. **Leaked-password protection is disabled.** The live security advisor still
   reports it. Enable/verify in staging and later production after configuration
   authorization and any required plan/cost decision.
   [Supabase guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
2. **`public.rls_auto_enable()` has broad EXECUTE grants.** It is owned by
   `postgres`, SECURITY DEFINER, returns `event_trigger`, uses
   `search_path=pg_catalog`, and is bound to enabled `ensure_rls` on
   table-creation DDL. PUBLIC, anon and authenticated have EXECUTE. It was not
   invoked against production. Its return type requires event-trigger context;
   grants/advisors alone do not prove an ordinary RPC exploit.
   [Anon warning](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
   [authenticated warning](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
3. **Canonical EGGS origin is undecided.** The user rejects
   `https://eggspoker.netlify.app` as permanent EGGS Auth origin and forbids
   production Auth changes now. It remains the legacy live Site URL, with
   additional redirects `["http://localhost:5173/**"]`. Read-only CLI comparison
   confirmed these unchanged. Email confirmation and refresh-token rotation
   remain enabled, JWT lifetime 3,600 seconds, refresh reuse interval 10 seconds.
   [Redirect guidance](https://supabase.com/docs/guides/auth/redirect-urls).

Proposed separately reviewed grant correction:

```sql
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
```

This is **unapplied and outside the additive consumer candidate**. Preserve the
function body, owner, service grant and event trigger. Hosted staging must prove
that new public tables still automatically enable RLS after revocation, and
that caller grants/advisors clear. The 42 informational legacy RLS-without-policy
notices describe existing service-only tables; this change does not broaden them.

## Remaining blockers and exact production rollout sequence

Production is blocked on hosted evidence, canonical-domain selection, the two
security remediations above, and explicit migration authorization. There are
no claim-retention policy, scheduler or worker blockers.

The sequence below is a review plan, not authorization to execute it:

1. Choose canonical HTTPS EGGS production origin. The authorized test mailbox,
   separate $0 staging target, and exact staging callback already exist.
   Use verified SMTP where required;
   stop if it needs paid service. Do not bypass confirmation or use production
   test accounts. Check shared Free quotas before further testing/deploys.
2. Verify the recorded staging baseline and candidate hashes/ledger. Both were
   applied there once; do not reapply them. This repo lacks production's eight
   historical migration files, so staging uses the audited schema fixture with
   native hosted Auth and no production personal data. Seed synthetic players
   and an authorized staging operator mapping. Its platform event triggers
   differ from production; the exact legacy function/trigger was successfully
   rehearsed in a staging transaction and rolled back. See the current rebase
   report for results.
3. Recheck staging Site URL, exact callback and app `EGGS_SITE_URL`. The new
   staging site already consumes its isolated credentials and has consumers
   enabled for the authorized test window; reuse that deployment. Complete every
   hosted check above using real
   confirmation delivery/user tokens, including signed-out token replay,
   unrelated/unconfirmed denial, privacy, conflicts and summary opt-in.
   Record sanitized evidence without tokens, codes or passwords. Return staging
   consumer access to disabled after the test window. Production stays disabled.
4. Review the passing hosted function-grant rehearsal, including automatic RLS
   on a newly created disposable public table. Resolve the leaked-password
   launch decision: the native feature requires Pro or above and cannot be
   enabled under the current $0 constraint. Do not upgrade or report it as
   passed. Review remaining advisors.
5. Present staging evidence and exact SQL hash/diff; obtain explicit production
   migration authorization and separately scoped legacy grant/Auth authorization.
   Repeat read-only schema, grants, RLS, functions, Auth, operator-mapping and
   migration-ledger checks. Confirm a recoverable checkpoint. Stop on drift.
6. Keep consumers disabled. Apply the existing candidate once as audited
   `postgres` through the Supabase migration mechanism, preserving all eight
   historical entries and recording the actual new ledger entry. No blind
   `db push`, manufactured history or migration repair. Preflight and
   transaction errors fail closed.
7. Verify exactly three new public tables/private registry, forced RLS, narrow
   grants/RPCs, private-schema exclusion, projections and unchanged legacy
   catalog/data/mappings. Recheck advisors. Deploy the reviewed app with
   `EGGS_CONSUMER_ENABLED=false` and validate real production players, sessions,
   hands/actions, standings, imports, evidence, drafts and public dossiers under
   `/para/poker`, legacy redirects, existing operator authorization, all seven
   anonymous generation denials and the unchanged Gemini gateway. Do not publish
   or alter league results as part of verification.
8. When separately authorized, apply the tested function EXECUTE revocation and
   configure production `site_url=<EGGS_ORIGIN>`, redirect allowlist entry
   `<EGGS_ORIGIN>/auth/callback`, and app `EGGS_SITE_URL=<EGGS_ORIGIN>`.
   Review other redirects individually; no broad production wildcard. Apply
   the separately approved leaked-password decision; any paid upgrade remains
   prohibited without a changed user instruction. Do not substitute the legacy Poker
   hostname. Keep Para Poker under `/para/poker`; plan legacy redirects with
   the domain cutover.
9. Only after those checks and explicit consumer-launch authorization, enable
   production consumers, run approved smoke checks and observe Auth/claim errors.
   No automatic matching or claim backfill.

Before commit, transactional rollback is tested. After production commit,
disable consumer rollout if needed and preserve profiles, reservations, claims,
evidence and links while fixing forward. Never drop these records or reuse
retired handles as rollback. A site rollback must retain the seven generation
guards and working Gemini gateway: use production baseline `629e5b4` or a later
verified deployment, never a pre-hotfix build. An application rollback does not
undo the committed database migration. No production rollback was executed.
