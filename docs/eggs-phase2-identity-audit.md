# Phase 2: verified database audit and unapplied identity migration

Audit date: 2026-09-22. Repository: `simply0307/para-poker-site`, branch
`codex/eggs-shell`, continuing [PR #2](https://github.com/simply0307/para-poker-site/pull/2).

The existing project `creative-systems-eggs` (`uzderzjbitmghfvrllvz`, us-east-2)
was restored with explicit user permission and reached `ACTIVE_HEALTHY`.
Restoration was the only production operational change. All database inspection
used read-only transactions. No migration, DML, Auth configuration change,
user creation, Storage write, deployment or new cloud project was performed.

The review candidate is
[`20260922231308_eggs_consumer_identity_reviewed_claims.sql`](../supabase/migrations/20260922231308_eggs_consumer_identity_reviewed_claims.sql).
It has been applied only to disposable local databases. Consumer login, profile
pages and claim UI remain inactive; music, library, social and profile-song work
is outside this change.

## Live evidence and preservation boundary

The catalog audit in [`scripts/audit-eggs-identity.sql`](../scripts/audit-eggs-identity.sql)
inspects actual types, columns, constraints, indexes, grants, role memberships,
RLS policies, function definitions/security, views, triggers and Auth counts.
Separate read-only queries inspected mappings, evidence counts, Storage buckets,
event triggers and the migration ledger. Supabase Management API/CLI config
pull and read-only dashboard inspection verified Auth and Data API settings.
Raw local audit/config files remain ignored; no live user rows, emails, Auth
UUIDs, credentials or provider secrets are committed. The committed fixture
contains schema and synthetic data only.

| Verified item | Live result | Consequence |
| --- | --- | --- |
| PostgreSQL | 17.6 | Disposable tests use actual PostgreSQL 17.6 |
| `profiles.id` | UUID PK | Existing operator record stays independent |
| `profiles.auth_user_id` | Nullable UUID FK to `auth.users.id`, `ON DELETE SET NULL`; valid partial unique index for non-null values | Keep the exact relationship, FK, index and role checks |
| Other operator identity fields | Required `email`, `identity_user_id` (unique), `identity_provider` default `netlify_identity`; roles viewer/contributor/editor/admin/owner | Do not repurpose this table for consumers |
| Existing mappings | 1 owner profile, 1 linked Auth user; 0 unlinked operators, duplicate Auth links or orphan links | No backfill, matching or automatic claim is needed |
| Auth population | 1 user, email confirmed, not anonymous | Counts verified without publishing identity |
| `players.id` | UUID PK; slug and PokerNow name unique but not ownership keys | New FKs use UUID; names/slugs never establish ownership |
| Existing consumer objects | None | Add a separate identity and reviewed-claim model |
| Public tables | 42, all RLS enabled; no public policies; no public views | Existing client row access is denied; service paths remain unchanged |
| Auth/Storage policies | No policies found | No consumer avatar upload access is assumed |
| Existing grants | Broad table grants and default public-schema grants to anon/authenticated/service_role; function execution defaults are also broad | Explicitly revoke inherited defaults on every new object |
| Database roles | anon/authenticated lack SUPERUSER and BYPASSRLS; postgres is non-superuser with BYPASSRLS; service_role has BYPASSRLS | Test actual unprivileged roles and a matching non-superuser function owner |
| Data API | Exposes `public`, `graphql_public`; extra search path `public`, `extensions`; max rows 1,000 | `eggs_private` must remain outside exposed schemas |

Evidence counts were identical at the initial and final read-only checks:
7 players, 4 sessions, 365 hands, 2,350 actions, 9 imports and 3 evidence
revisions. The final check still found 1 linked operator profile, 8 historical
migrations, zero public policies and no new consumer objects. These are live
count checks, not a claim that live rows were copied or hashed.

The historical migration ledger contains:

```text
20260807101157 authoritative_live_hand_v1
20260807101451 authoritative_live_hand_v1_effect_indexes
20260807154743 league_game_session_imports
20260807154922 raw_hand_evidence_revisions
20260807154958 eggs_completed_session_v2
20260807162727 admin_operator_authorization
20260807171341 player_hand_review_v1
20260808190541 authoritative_session_continuity_v1
```

There are 12 non-extension public functions. Existing authoritative/import
RPCs are restricted to the migration/service roles. The definer
`commit_parapoker_session_import(uuid,jsonb)` has a fixed public search path
and no anon/authenticated execution grant. Existing evidence-protection and
timestamp triggers remain unchanged. `ensure_rls` invokes the existing
`rls_auto_enable()` event trigger for new public tables; its broad execution
grants are an existing advisor warning, not expanded by this migration.
There are no user-defined Auth creation triggers, configured Auth hooks or
deployed Edge Functions.

Read-only `SET LOCAL ROLE` probes confirmed that anon and authenticated callers
see zero rows in the existing `profiles` and `players` tables. No live write
probe was attempted, even inside a transaction intended to roll back.

## Verified Auth and Storage configuration

| Setting | Observed value |
| --- | --- |
| Providers | Email only; phone, OAuth, SAML, Web3 and custom providers disabled/unconfigured |
| Signup / confirmation | Signup enabled; email confirmation required |
| Anonymous sign-in / manual linking | Both disabled |
| Site URL | `https://eggspoker.netlify.app` |
| Additional redirect allowlist | `http://localhost:5173/**` only |
| JWT expiry | 3,600 seconds |
| Refresh rotation | Enabled; reuse interval 10 seconds |
| Session limits | Single-session enforcement off; timebox and inactivity limit unset |
| Password settings | Minimum 6 characters; no additional character requirements; secure password change off; leaked-password protection off |
| Email changes / OTP | Double confirmation enabled; OTP length 8, expiry 3,600 seconds |
| MFA | TOTP enrollment/verification enabled; phone MFA disabled; no new enforcement introduced |
| Hooks / OAuth server | No Auth hooks; OAuth server disabled |

`player-assets` is a public bucket. `artifacts`, `exports`, `imports-raw`,
`imports-processed`, `thumbnails` and `para-league-moment-videos` are private.
These buckets have no configured MIME/size restrictions and no Storage RLS
policies. The new optional `avatar_path` is constrained metadata only; this
migration adds no bucket, upload flow or Storage grant.

Auth configuration was inspected without changing it. Actual signup/email
delivery, refresh/revocation, production cookies and operator login were not
exercised with live accounts. They remain application rollout checks. Confirm
the intended EGGS host and callback allowlist before enabling consumer login;
the present settings describe the existing Poker site and port 5173.

## Final additive design and changes from the proposal

```text
auth.users.id ─── profiles.auth_user_id             existing operator authority
       │
       └──────── eggs_profiles.auth_user_id          separate consumer ownership
                       │
                       ├── para_poker_player_claims ── players.id
                       └── para_poker_profile_links ── players.id
```

Only three new tables, two public views, three public invoker RPCs and private
helpers/triggers are added. No legacy table, grant, policy, import function,
operator API or application route is rewritten. All new FKs use the audited
UUID types. No name/email inference or automatic association is performed.

| Proposal question | Reconciled decision |
| --- | --- |
| Server-normalized handle | Postgres enforces 3–30 lowercase ASCII letters/digits/underscore, reserved names and exact uniqueness under `C` collation. Uppercase, spaces, newlines, Unicode and punctuation fail through direct SQL too. There is no reliance on app normalization. |
| Changeable URL label | Handles and ownership are immutable in this phase, including privileged updates. A later reviewed alias/rename policy is required. Deleting a profile releases its handle; no historical alias is reserved. |
| Consumer ownership | Independent public profile UUID; unique required Auth FK; database derives the owner using `auth.uid()`. Verified email, non-anonymous and non-deleted Auth account required. No automatic Auth signup trigger. |
| Broad public projection | Explicit column grants exclude Auth UUIDs, private reviewer attribution and notes. Public views use invoker security and a security barrier. Owner lookup RPC returns only presentation fields. |
| Implicit project grants | Revoke ALL defaults on new tables/views/functions, including TRUNCATE/TRIGGER. New-table service-role access is SELECT only. Existing service-role league access is untouched. |
| Profile access | Private by default. Owners may change only display name, bio, constrained avatar path and visibility, or delete their profile. Operators gain no blanket access to private consumer profiles. |
| Player association | One profile per player and one player per profile; stable FKs and a unique reviewed claim reference. A verified link stays hidden unless its owner opts in and their profile is public. |
| Review authorization | Database rechecks the existing `profiles.auth_user_id` admin/owner role against the current Auth identity. No caller reviewer ID, email, role metadata or service key can substitute for this check. |
| Concurrent review | Lock reviewer authorization and then the claimant profile, player and claim. Approval and attribution commit together. Competing links raise `23505`; the loser stays pending with no review timestamps. Repeating the same completed decision is idempotent. |
| Claim submission retry | Pending profile/player pairs have a unique index. A duplicate insert returns `23505`; a future user-token client should fetch its existing pending claim. It does not create a second row or silently change evidence. |
| Withdrawal / transfers | Owners may withdraw their own pending claims through the restricted RPC. Approved links cannot be reassigned, revoked or transferred in this phase. |
| Deletion / history, previously undecided | Auth deletion cascades to the consumer profile; profile deletion detaches links, withdraws pending claims, nulls claimant identity and clears claim/review free text. Minimal decision/player/role/timestamp history remains. Reviewer deletion sets reviewer Auth FKs to null. The existing operator profile retains its original SET NULL behavior. |
| Preferences and avatars | No preference table without a concrete setting; no avatar storage authorization. Music/library/social/song features remain deferred. |

The deletion/retention decision is a **proposed policy for review**, not a claim
of an already approved retention schedule. While an account remains present,
its private claim evidence remains stored; no automatic retention timer is
introduced. Deleting only a reviewer leaves the claimant's claim/review text
intact and removes the reviewer Auth FK. Retained player IDs and review times
may still permit inference; this is minimization, not guaranteed anonymization.

The migration checks the relevant audited schema, exact operator FK/index,
role privileges and legacy RLS boundary before DDL. It refuses an unknown
existing consumer schema. Those guards complement a fresh audit; they do not
replace full schema-drift review.

## Disposable validation

[`tests/eggs-identity-database.test.mjs`](../tests/eggs-identity-database.test.mjs)
starts a fresh PostgreSQL 17 cluster on a random loopback port with a random
password and per-scenario databases. It accepts a binary directory, never a
database URL or production credentials. The migration/function owner is a
non-superuser `postgres` with BYPASSRLS, matching the live project. RLS tests
explicitly switch to and assert non-superuser, non-BYPASSRLS anon/authenticated
roles. Separate connections use different PostgreSQL backend PIDs.

The schema-only fixture contains the audited definitions of 17 affected
Poker/operator tables, constraints, indexes and evidence triggers. It includes
the five Auth columns and actual `auth.uid()`/`auth.jwt()` definitions used by
this change, not the entire hosted Auth service, 42-table application or
platform event-trigger system. All inserted identities and Poker data are
synthetic. This proves database behavior, not hosted HTTP/Auth delivery.

The tests cover:

- Canonical handles and reserved names through both unprivileged and direct
  SQL writes; uniqueness and immutable owner/handle fields.
- Owner/public/other-user/operator RLS; unconfirmed and anonymous rejection;
  sensitive-column and whole-row projection denial; no metadata role spoofing.
- Column write restrictions, function privileges, service write denial and
  absence of new TRUNCATE/TRIGGER grants.
- Fresh operator role revocation, approval/rejection/withdrawal, decision
  idempotency, hidden links and explicit public opt-in.
- Real concurrent same-player, same-profile and same-claim review, plus a
  competing approval whose first transaction rolls back. `pg_stat_activity`
  and `pg_blocking_pids()` prove actual contention before releasing the winner.
- Profile, pending account and reviewer deletion; preserved decision history
  and the original operator FK behavior.
- Before/after row hashes and catalog/grant/RLS snapshots for all 17 legacy
  tables; completed-DDL rollback before commit; atomic failure on schema drift.

Run with Node 22+ and PostgreSQL 17 installed locally:

```powershell
$env:EGGS_TEST_POSTGRES_BIN = 'C:\path\to\postgresql-17\bin'
npm.cmd run test:identity
```

This Windows audit used PostgreSQL 17.6 binaries installed only in the ignored
`.reference` directory, without changing repository dependencies or an existing
database service:

```powershell
npm.cmd install --prefix .reference/pg17-tools --no-save --ignore-scripts @embedded-postgres/windows-x64@17.6.0-beta.15
npm.cmd run test:identity
```

The suite auto-detects that Windows path. Elsewhere set `EGGS_TEST_POSTGRES_BIN`
to installed version-17 binaries. Do not run `initdb` as root. Missing binaries
produce an explicit skip in the general suite, which is **not sufficient**
evidence for migration approval. The recorded local run executed the tests.

## Validation result and existing warnings

| Check | Result |
| --- | --- |
| Production build | Passed; routes and application code unchanged by Phase 2 |
| ESLint | Passed |
| Complete `npm test` | 54 passed, 0 failed, 1 skipped (55 total) |
| Identity database coverage within that run | All 12 scenarios plus parent passed (13 test records); real PostgreSQL 17.6, no identity-test skip |
| Homepage, stats, training, Para Poker import validators | All four passed |
| Dependency audit (including development packages) | 0 vulnerabilities |

The single skip is the inherited opt-in remote raw-hand integration suite.
The default runner deliberately disables it; it is unrelated to the new local
identity suite, which did run. HTTP regression tests covered rendering,
redirects and all 48 protected API methods. No build, lint or validator warnings
were emitted. Git reported ordinary Windows line-ending normalization notices.

Existing live advisors, separate from test failures:

- 42 informational [RLS enabled with no policy notices](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), consistent with current service-only access. This migration does not broaden them.
- Two warnings for execution of existing `rls_auto_enable()` by [anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) and [authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Existing function grants remain unchanged.
- [Leaked-password protection is disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Password/session settings remain unchanged.

## Production review boundary

Review the candidate SQL and the decisions above, particularly immutable/reusable
handles, verified-email admission, no transfer path, and claim retention/deletion.
Then explicitly authorize any production application as a separate action.
Recheck schema, mappings, grants, roles, Auth settings and migration history at
that time; obtain the normal database recovery checkpoint and preserve the eight
existing ledger entries. This repository's new `supabase/migrations` directory
does not include that historical baseline, so a blind `supabase db push` or
history repair is not the reviewed application procedure.

The SQL is transactional with local lock/statement timeouts and schema-cache
notification. A failure before commit rolls back its objects. After a successful
production commit, recovery must preserve any newly submitted profiles/claims;
do not drop tables or replay a destructive down migration as a shortcut. The
local rollback test is evidence of transactional DDL, not permission for data
loss after launch. No production rollback SQL was executed or scheduled.

Before activating consumer application flows, verify hosted API column/RLS
behavior and real account sessions in an approved staging environment, confirm
EGGS callback settings, and implement the separate consumer authorization/client
boundary. Keep the operator cookie and `requireOperator()` unchanged. This PR
delivers the audited migration candidate and database proof, not that later UI.
