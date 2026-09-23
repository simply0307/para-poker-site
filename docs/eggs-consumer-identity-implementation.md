# EGGS consumer identity: implementation and production review

Date: 2026-09-22 (verification continued into September 23 UTC). Continues
[PR #2](https://github.com/simply0307/para-poker-site/pull/2) on `codex/eggs-shell`.
**Implemented and tested locally; no production migration or deployment.**
Both rollout flags default to false. This report supersedes the design and
deletion/retention proposals in the [earlier audit checkpoint](eggs-phase2-identity-audit.md).
Its live database findings remain the basis of this implementation.

Candidate: [20260922231308_eggs_consumer_identity_reviewed_claims.sql](../supabase/migrations/20260922231308_eggs_consumer_identity_reviewed_claims.sql).
Compare against audit commit `b2f6570a63ddd757b6f9c90292afaf9fda99264f` for the
final migration diff. The candidate has never been applied remotely, so this
revision replaces the unapplied file; it is not a second production migration.

## 1. Schema changes and proposal differences

The three public tables remain separate from the existing operator `profiles`:
`eggs_profiles`, `para_poker_player_claims`, `para_poker_profile_links`.
All relationships use the audited UUID keys. One Auth user has at most one
consumer profile; an approved association is unique by both profile and player.

| Change since the audit candidate | Final behavior |
| --- | --- |
| Permanent handle reservation | Private `handle_registry` contains only handle, reservation time and retirement time. Deleting an account never releases its handle. |
| Durable claim references | Server-stamped claimant/profile UUID and reviewer/operator-profile UUID snapshots survive deletion; nullable live FKs retain their normal deletion behavior. |
| Bounded final record | Decision source, submitted/resolved/reviewed times, operator role and a required 3–500 character decision reason survive supporting-evidence expiry. |
| Evidence expiry | Server-stamped deadline exactly 2,160 hours after resolution; irreversible NULL redaction in the active database, with a redaction timestamp. |
| Scoped hold history | Private claim-specific reasons, finite expiries, operator references and release records; no general activity log. |
| Worker health | A private singleton records successful run time and counts, with an operator-only backlog/status RPC. |
| Session revocation | Auth checks also verify the JWT's session ID against the actual `auth.sessions` row and `not_after`. |
| Public player projection | A bounded RPC exposes stable player UUID, league name and latest recorded standings for browsing and the summary. No legacy SELECT policy is added. |
| Unreviewed claim deadline | Proposed 90-day review window, followed by the same 90-day evidence window. See section 7 and the open review choice in section 11. |

Postgres enforces ASCII lowercase handles, 3–30 characters, reserved names,
uniqueness and immutability. `claim` is additionally reserved for the fixed
`/profile/claim` route. Direct SQL and service clients cannot evade these
constraints. `avatar_path` remains a narrowly constrained reserved metadata
field from the audited candidate; no upload, Storage policy or avatar UI is added.

The migration does not alter legacy tables, rows, grants, policies, functions,
operator mappings or evidence. Its transaction checks roles, UUID types, exact
operator Auth FK/index, legacy RLS, session columns and absence of consumer
objects before DDL. Schema drift fails the transaction; it never attempts to
merge an unknown consumer schema.

Read-only live verification still found PostgreSQL 17.6, eight historical
migrations, no consumer objects, one valid operator/Auth mapping, seven players,
four sessions, 365 hands, 2,350 actions, nine imports and three evidence revisions.
Additional reads verified `auth.sessions` types/SELECT privilege and the default
READ COMMITTED isolation. No live Auth account or test data was created.

## 2. RLS, grants and privileged exceptions

All six new tables enable and force RLS. Broad inherited table/function grants
are explicitly revoked on new objects only, including TRUNCATE and TRIGGER.
`eggs_private` must remain outside Data API exposed schemas.

| Caller | Permitted access |
| --- | --- |
| Anonymous | Allowlisted public profile presentation, explicitly shown public links, bounded public Poker facts. No mutations, Auth UUIDs or claims. |
| Confirmed owner with live session | Own profile creation/presentation edits/deletion; own claims through bounded projections; pending claim submission/withdrawal; own link visibility only. |
| Unrelated authenticated user | Same public visibility as anonymous; no access to another owner's private profile, claims or mutation paths. |
| Existing admin/owner operator | Existing `requireOperator()` gate plus fresh DB role/session checks for review, queue, holds and worker status. Operator status does not grant arbitrary profile edits. |
| Service role | SELECT on the three new public tables and execution of the bounded retention worker. No direct profile/claim/link INSERT, UPDATE, DELETE, TRUNCATE or TRIGGER grant. Existing legacy service permissions remain unchanged. |

Table column grants exclude Auth UUIDs and raw claim/review text from ordinary
SELECT. Supporting evidence is accessible only through claimant/operator RPCs,
which enforce its deadline even when the scheduled worker is delayed. Public
views and all public RPC wrappers use SECURITY INVOKER and fixed search paths.

Private SECURITY DEFINER helpers have fixed empty search paths and restricted
EXECUTE. They provide narrow Auth/role lookups, profile lifecycle triggers,
checked claim decisions/withdrawals/holds, deadline-filtered claim projections,
the worker and the bounded public Poker projection. The latter intentionally
reads already-public league facts because legacy tables have no consumer RLS
policies. It joins by UUID only and never returns private Poker evidence.

No ordinary consumer request uses a service client. The retention function is
the separate scheduled-maintenance exception. A service credential still carries
its inherited project privileges: isolate it in the scheduled function's server
environment and never treat it as a narrowly scoped public credential.

## 3. Authentication and session flow

Email/password signup uses Supabase PKCE, confirmation and a fixed
`EGGS_SITE_URL/auth/callback`. Callback exchanges the code, verifies the user and
redirects only to `/profile`; caller-supplied redirect destinations are ignored.
Only email/password login and signup are introduced; provider linking, recovery
UI and account-deletion UI are outside this milestone.

`requireEggsUser()` verifies `auth.getUser()`, confirmed non-anonymous identity
and the live session RPC. It does not read `profiles.role`, call the operator
guard, trust/mint the operator cookie or import the league service repository.
Each request has a fresh publishable-key Supabase client carrying that user's
session, so database RLS is exercised. New operator review routes retain
`requireOperator()` first, then pass the verified operator bearer token to the
new user-scoped client; the DB independently rechecks admin/owner authority.

Consumer cookies use their own `eggs_consumer` namespace, HttpOnly, SameSite=Lax,
Secure on HTTPS, path `/`, and a 30-day rolling browser lifetime. The PKCE
verifier is limited to one hour. Tokens never appear in response JSON or browser
localStorage. Verified Auth/session expiration remains authoritative regardless
of cookie lifetime. Consumer API/callback responses and private page refreshes
are private/no-store; writes require the exact configured origin and bounded,
allowlisted JSON. HTTPS is required outside loopback development.

The Next proxy refreshes consumer sessions before private server rendering and
forwards the refreshed cookies to both the request and response. Logout revokes
the current consumer session with Supabase's local scope and clears only consumer
cookies. Other devices and the independent operator session are unaffected.
Replayed signed-out tokens fail the new DB session check. On revocation failure,
local cookies are still cleared and the API reports that remote revocation could
not be confirmed. No silent success is claimed for that case.

`@supabase/ssr` is pinned to 0.10.3, compatible with the existing pinned
`@supabase/supabase-js` 2.108.2. The newer SSR peer requirement would require a
separate SDK upgrade; none was forced into this milestone.

## 4. Profile creation and editing

`/login` → confirmed email → `/profile` → choose handle → create profile.
Only the handle is required at onboarding; display name falls back to the
handle, and optional display name/bio sit behind a disclosure. Profiles default
to private. Owners can edit display name, short bio and visibility. The handle
is shown as fixed text after creation. Creation retry with the same handle
returns the existing own profile; conflicting handles return a conflict.

`/profile/[handle]` always uses an anonymous client, including when its visitor
is the owner or an operator. Private and unknown handles return 404. There are
no fabricated profiles. Small presentation fields render as escaped text.
Consumer routes show an unavailable state while `EGGS_CONSUMER_ENABLED` is false.

## 5. Handle retirement and deletion

A BEFORE INSERT trigger reserves the canonical handle in the private registry
within the profile transaction. Its unique key serializes concurrent signups.
A deletion marks that reservation retired without storing the former Auth or
profile ID there. Rollback rolls back reservations too. Retired handles cannot
be registered by either the former owner or an unrelated account.

Deleting an Auth user cascades only to their consumer profile; the existing
operator `profiles.auth_user_id ON DELETE SET NULL` relationship is preserved.
Consumer deletion removes its public link and profile, withdraws pending claims,
and nulls the live claimant FK. The durable claimant/profile snapshot and final
decision record remain, with evidence subject to the same deadline/hold rules.
Deleting a reviewer nulls its live Auth FK but retains the operator-record UUID
snapshot. Player records, hands, actions, imports and league coverage survive.
These UUID audit references are pseudonymous records, not guaranteed anonymity.

Old public URLs return 404 and cannot be reassigned. A future handle-change
system would keep the old reservation and add an explicitly typed alias bound
to that same original profile, never release or transfer it to a new owner.
Deleted aliases would remain reserved tombstones. No rename, alias, history or
transfer UI/infrastructure beyond the minimal reservation is implemented now.

## 6. Claim submission, review and conflicts

`/profile/claim` browses/searches at most 50 existing public player records by
name. The selected stable UUID identifies the requested record. Optional
supporting text is limited to 2,000 characters. No email, display name, handle,
PokerNow name or slug creates or approves an association. A duplicate pending
submission returns the existing claim without replacing its evidence.

`/admin/player-claims` provides status filters, pages of 50, private evidence,
bounded decision reason, hold controls and retention health. Approval/rejection
requires the existing admin/owner boundary and fresh DB authorization. Review
locks the claimant profile, player and claim in consistent order, with role/user
locks stabilizing authorization. A decision and its approved link commit in one
transaction. Competing claims cannot steal or overwrite an association.

Repeated identical final decisions return the original outcome without rewriting
reviewer attribution or reason. Opposite decisions and already-resolved claims
fail. Unique conflicts leave the losing claim pending with no partial decision.
Withdrawal is owner-only and idempotent. Transfers/revocations remain deferred.

## 7. Evidence retention and automatic maintenance

Approved, rejected and withdrawn evidence expires exactly 90 × 24 hours after
resolution. SQL stamps the deadline; callers cannot set timestamps. Claim reads
hide expired evidence immediately unless an active documented hold exists.
The next successful hourly worker irreversibly sets `evidence_note` to NULL in
the active database and stamps `evidence_redacted_at`. It never deletes the claim
decision, stable references, reason or approved association. This is row-level
redaction, not a promise to erase existing backup/WAL copies instantly.

Only an operator can establish, renew or release a hold. Reasons are bounded,
expiry must be finite and in the future, and each change retains its operator
reference/history. Renewing releases the prior hold and adds a new record.
An expired hold does not revive expired evidence; NULL-redacted evidence cannot
be restored. Operators are instructed to keep private evidence out of durable
decision and hold reasons.

**Additional review assumption:** unresolved claims automatically withdraw at
90 days, then their evidence expires at day 180 unless held. This was raised as
an optional product question; no reply had arrived when this report was written.
The 90-day option prevents indefinitely unreviewed evidence. A delayed worker
records the logical day-90 resolution deadline with `unreviewed_timeout`; it
does not restart the evidence clock on recovery. Reads hide evidence at day 180
even if the worker has been unavailable, and late approval is refused.

`netlify/functions/eggs-claim-retention.mts` is an hourly scheduled function,
disabled until `EGGS_CLAIM_RETENTION_ENABLED=true`. It uses a separate server-only
`EGGS_RETENTION_SERVICE_KEY` and invokes only `run_poker_claim_retention()`.
Each transaction withdraws up to 500 stale pending claims and redacts up to 500
due claims. The function attempts at most four batches, with five-second request
timeouts; errors or a full final batch fail visibly. Logs contain counts only.
SQL uses SKIP LOCKED and requires READ COMMITTED; the hold check is a fresh query
after acquiring the claim lock, preventing a concurrent new hold from being
missed. Retries are idempotent. Locked/backlogged rows are retried on later runs.

The operator queue shows last successful run, cumulative counts and both
backlogs; no run for two hours or an overdue backlog displays a warning.
Production needs actual scheduler invocation and an assigned monitoring owner;
the checked-in function alone is not an operating retention service. Netlify
automatically schedules only the published deploy, not deploy previews, so a
preview requires a manual run. No schedule or production credential was enabled
in this task.

## 8. Para Poker summary

New approved links default to `show_on_profile=false`. The owner explicitly
enables the small Poker module; public exposure also requires a public profile.
It shows the league display name, latest recorded season, rank, points and
sessions when available, with a stable UUID link to the full
`/para/poker/players/[playerId]` dossier. Missing standings are omitted, not
invented. It neither duplicates the dossier nor changes any league facts.

## 9. Verification and limits

| Check | Result |
| --- | --- |
| Production Next build | Passed; new consumer and operator claim routes included |
| ESLint, including the scheduled entry point | Passed with no warnings |
| Full `npm test` | 66 passed, 0 failed, 1 intentionally skipped; 67 test records |
| Disposable native PostgreSQL 17.6 | 20 scenarios plus parent, 21 passing records; none skipped |
| Consumer HTTP/core/worker tests | 4 passing records; rerun after the fixture's loopback-only CORS support was added |
| Homepage, stats, training, ParaPoker import validators | All four passed |
| Dependency audit | Zero vulnerabilities reported |
| Browser | Synthetic local sign-in, handle onboarding, editing, visibility, claim submission, separate operator login/review, explicit Poker opt-in, public summary and consumer logout passed |
| Responsive check | Public profile screenshot and owner controls checked at 390 × 844; no horizontal document overflow |

Native PG tests exercise actual unprivileged anon/authenticated roles, owner,
unrelated user and operator; live-session rejection; direct private-helper
denial when the caller has no profile or has an unconfirmed/revoked identity;
column/whole-row leaks;
alternate service and direct write paths; immutable/canonical handles; deletion;
durable reviewer/claimant references; expiry boundaries; hold renewal/release;
worker retry/hold races; and unreviewed deadlines after an outage. Concurrent
connections prove lock contention for handle acquisition, same-player,
same-profile and same-claim approvals, including rollback of the first approver.
A retirement race proves the already-reserved handle cannot be taken while
deletion is in flight. Legacy catalog/grant snapshots and synthetic row hashes
remain equal. Drift rejection and rollback after complete DDL preserve legacy
data and leave no consumer objects.

HTTP tests run the real built application and Supabase SDK against loopback
Auth/PostgREST transport fixtures. They cover signup PKCE exchange, confirmation,
origin checks, Secure cookies, callback redirect confinement, session refresh in
API and SSR, private profile protection, two-user isolation, operator separation,
retry behavior, public projection and logout replay. The fixture does not prove
hosted GoTrue delivery or actual PostgREST execution; real PG tests establish
database behavior independently. Browser data, identities and keys are synthetic.
The existing unrelated remote import integration test is deliberately skipped
by the default runner; it never runs against production.

Test-file concurrency is limited to two because simultaneously initializing
PostgreSQL and several Next servers caused local Windows startup timeouts under
load. The harness allows 60 seconds for initdb and six minutes for the complete
database suite. Database race tests still open concurrent independent connections;
no authorization assertion or contention check is relaxed.

Reproduce with Node 22+ and PostgreSQL 17 binaries using the [audited binary
setup](eggs-phase2-identity-audit.md#disposable-validation), then:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run lint
npm.cmd test
npm.cmd run validate:homepage
npm.cmd run validate:stats
npm.cmd run validate:training
npm.cmd run validate:parapoker-import
```

The database harness accepts a local binary directory, never a database URL.
Missing binaries are an explicit skip, not a successful migration validation.

## 10. Exact migration plan and rollback implications

**Review now; do not execute this plan without a separate production instruction.**

Target: existing `creative-systems-eggs`, project `uzderzjbitmghfvrllvz` only.
File: `supabase/migrations/20260922231308_eggs_consumer_identity_reviewed_claims.sql`.
SHA-256 of UTF-8 content with LF line endings:
`71fdd6644c5e83aa3ac3ae079c24ae30f69fd1640e79cf2ee8185816fdc99752`.

1. Review and pin the commit containing this report and exact SQL. Keep
   `EGGS_CONSUMER_ENABLED=false` and the worker disabled during preparation.
   Verify a recovery checkpoint and repeat the read-only audit, Auth config,
   exposed-schema list, operator mappings, evidence counts and migration ledger.
   Compare against the recorded eight migrations; any drift requires review.
2. Complete hosted staging checks in section 11 using a separately authorized
   disposable environment. Run its real user-token RLS/API and email/session
   flows. Manually exercise the scheduled worker with synthetic expired and held
   evidence. Do not seed synthetic identities or claims into production.
3. After explicit production authorization, apply precisely the reviewed file
   using the Supabase migration operation as `postgres`, name
   `eggs_consumer_identity_reviewed_claims`, to the existing project. Preserve
   the file's transaction, preflight, five-second lock timeout, 60-second statement
   timeout and final schema reload notification. Record the actual ledger version
   returned by the migration operation. Do not blindly `db push`, reconstruct,
   squash or repair the eight historical migrations absent from this directory.
4. Before activation, perform read-only catalog/grant/RLS/function checks on all
   new objects, verify empty consumer tables and unchanged legacy counts/mappings,
   and run security/performance advisors. Confirm `eggs_private` is not exposed.
   A successful migration is not permission to change Auth settings or deploy.
5. In the separately approved deployment, configure the exact HTTPS origin and
   callback allowlist, server publishable key and isolated worker credential.
   Enable the scheduled worker, verify a manual successful batch and a real
   scheduled invocation/health status. Configure an owner to respond to failures
   and overdue evidence. Keep consumer rollout disabled until these checks pass.
6. Enable `EGGS_CONSUMER_ENABLED` only after hosted Auth/session and privacy
   checks pass. Verify actual reviewed associations with authorized accounts,
   with no migration backfill or automatic player matching. Observe retention
   health and preserve rollback evidence.

Before commit, PostgreSQL rolls back failed DDL and all new objects atomically;
the disposable test executes the entire file without committing and confirms
this. No destructive down migration is supplied. After successful production
commit, disable consumer rollout if needed and fix forward. **Keep the retention
worker operating** for any existing claims. Reverting application code does not
justify dropping the handle registry, claim audit or holds: doing so could free
historical identities or violate evidence-retention promises. A snapshot restore
can resurrect expired private evidence; reconcile deadlines/holds and rerun
redaction before exposing a restored database. Backup retention and restore
access require their own operational policy. No post-commit production rollback
has been attempted or represented as lossless.

## 11. Remaining production blockers and scope

- Hosted signup/confirmation delivery, SMTP/rate limits, callback configuration,
  token refresh, logout/session-row invalidation and real user-token PostgREST
  projections must pass staging. The audited allowlist contained only
  `http://localhost:5173/**`; this task did not change Auth settings.
- Deploy/enable the hourly worker, configure its server secret, verify actual
  invocation and assign retention monitoring. Redaction must remain operational
  independently of the consumer UI flag. Backups/WAL and restore procedures must
  have a bounded policy; SQL NULL updates alone do not erase historical backups.
- Review the proposed **90-day unresolved-claim timeout**. The requested 90 days
  after a final decision is implemented exactly; the unresolved period was an
  additional bounded default, not a prior explicit product decision.
- Repeat drift/ledger checks immediately before application and preserve a
  recovery checkpoint. The existing advisor findings (legacy RLS without public
  policies, broad event-trigger execution and disabled leaked-password
  protection) remain documented in the audit; this change does not silently
  rewrite the existing league security model.

No music, library, artifacts, songs, friends/follows, feeds, social posting, other
project integration, handle changes, claim transfers or speculative preferences
were implemented. Existing shell placeholders and legacy newsroom features stay
as they were. No new cloud project, live account, production migration, Auth
setting, deployment or scheduled automation was created by this implementation.

Implementation references: [Supabase server clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[PKCE and SSR session handling](https://supabase.com/docs/guides/auth/server-side/advanced-guide),
[Netlify scheduled functions](https://docs.netlify.com/build/functions/scheduled-functions/).
