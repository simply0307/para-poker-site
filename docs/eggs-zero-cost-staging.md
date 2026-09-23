# EGGS staging: cost, isolation and verification record

Latest checkpoint: [PR #2 rebase and staging security verification](eggs-identity-rebase-staging-20260923.md). The provisioning details and credit balances below are historical; current production is PR #3 / `629e5b4`.

Verified September 23, 2026. Application and migration commit: `53859654f357fbda8211fa8703bc6a60cf97a8a7`.
Consumer rollout is disabled. No production migration or production Auth update
was performed. The [implementation report](eggs-consumer-identity-implementation.md)
contains the exact migration comparison, test results and production sequence.

## Isolated targets

| Resource | Staging only |
| --- | --- |
| Site | <https://eggs-consumer-staging.netlify.app> |
| Netlify ID | `d538177f-1890-4894-8efa-7b7b3bb117b4` |
| Git target | `simply0307/para-poker-site`, `codex/eggs-shell` |
| Published application | `53859654f357fbda8211fa8703bc6a60cf97a8a7`, deploy `6ab36036c69968736c5f100b` |
| Supabase | `eggs-consumer-staging`, `xokrweqdvkfcexczsewl`, us-east-2 |
| Supabase API | `https://xokrweqdvkfcexczsewl.supabase.co` |
| Auth Site URL | `https://eggs-consumer-staging.netlify.app` |
| Auth redirect allowlist | Exactly `https://eggs-consumer-staging.netlify.app/auth/callback` |

Netlify calls the published deployment context "production" even on this
staging-only site. That context is not authorization for an EGGS production
release. The canonical EGGS production origin remains undecided; neither
legacy Poker hostname was designated as that origin.

The site has `EGGS_CONSUMER_ENABLED=false`, matching `EGGS_SITE_URL`, Node 22,
and the three Supabase variable names: `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. The service-role value
is marked secret, scoped to builds/functions/runtime and the new site's
published context. Its decoded project reference was checked before sending
it to this site; no production key was copied. Public URL/key were compared
with the staging project. No credentials are recorded here.

The Supabase variables were saved after the first deployment. They are verified
in Netlify configuration, but their application in a new running deployment is
pending. Avoid another deploy until the mailbox/test window is ready. The
currently published consumer UI and API fail closed.

## Exact $0 boundary and shared limits

The existing Supabase organization `ajezysjoblntgsndqqir` was confirmed Free.
The project quote was **$0/month** and that exact quote was confirmed before
creation. A separate branch quote was **$0.01344/hour** and was rejected;
no branch was created. No upgrade, paid option, billing method or add-on was
enabled.

Netlify team `Creative-Systems` (`gjoepucci`) was confirmed Free: $0.00,
300 included credits/month, no overage charges, and no saved payment method.
The pre-deploy reading was 299.6 credits remaining. The later dashboard reading
was **284.5/300 remaining**, with one published deployment charged 15 included
credits; usage readings can lag. No extra credits were purchased. This is a
point-in-time reading, not a guarantee of future capacity.

Data and configuration are isolated; account quotas are shared. Netlify states
that exceeding a site's limits can pause all sites on the account. Therefore
absolute resource independence cannot be promised on this shared Free team.
Check available credits before every further staging deploy, avoid repeated
builds/load tests, and stop before exhausting the pool or incurring any charge.
Do not silently upgrade or buy credits. This docs-only update skips Netlify
deployments so the evidence update does not consume another published deploy.

The new Supabase project uses the second active Free-project allowance. If the
owner needs to restore another paused project and the allowance prevents it,
pause EGGS staging after preserving its test state; do not pause production or
overwrite another project to make room. Free staging may itself pause when
inactive. No keep-alive job or monitoring automation was created.

Sources: [Netlify credit FAQ](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/billing-faq-for-credit-based-plans/),
[Supabase billing FAQ](https://supabase.com/docs/guides/platform/billing-faq),
[Free-project pausing](https://supabase.com/docs/guides/platform/free-project-pausing),
[Netlify deploy skipping](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/).

## Existing project audit and preservation

The inactive `creative os` project (`okqkljexfzolzxysjaha`) was restored solely
to conduct its read-only audit. The audit waited for ACTIVE_HEALTHY; the
temporary empty catalog during restoration was not accepted as evidence of an
empty project. The restored project contains useful Reath Digest work:

| Existing object | Count |
| --- | ---: |
| Public application tables | 20 |
| Stories | 1,808 |
| Source items | 1,847 |
| Sources | 78 |
| Ingestion runs | 92 |
| Editorial queue | 1,808 |
| Auth users | 1 |
| Historical migrations | 24 |
| Storage buckets/objects | 0 / 0 |

Its public tables enable RLS with no public policies. The existing
`reath-ingest` Edge Function (v5) was inventoried and not invoked or modified;
the cron job list was empty. No existing records, Auth settings, schema,
migrations or deployment were overwritten. It was returned to **INACTIVE**
after the audit and that state was verified. It was not renamed or repurposed.

Production `creative-systems-eggs` (`uzderzjbitmghfvrllvz`) remained
ACTIVE_HEALTHY. Read-only rechecks find no `eggs_private` schema and no
`eggs_profiles`, with exactly eight historical migrations and the original
one linked operator. Counts remain: 7 players, 4 sessions, 365 hands,
2,350 actions, 9 imports and 3 evidence revisions. CLI comparison finds no
change to production Site URL, callback allowlist or email confirmation.
Existing password-requirement/Twilio comparison differences were not applied.
These are targeted checks, not a claim that unrelated actors cannot change
their projects concurrently.

| Existing Netlify site | Original target / published deploy preserved |
| --- | --- |
| `eggspoker` | `simply0307/parapoker-official-client`, `master`; `6a85d3302f40a90008203e26` |
| `parapokerleague` | `simply0307/para-poker-site`, `main`; `6a88df898ba41e0008ee7240` |
| `reath-digest` | Published deploy `6a906d430789329af2045b55` |
| `creative-os-display` | No writes by this task; inventory has no published deploy ID. Its draft/deploy URL changed during the audit, so no global unchanged-state claim is made. |

No legacy site configuration, environment variable, repository connection,
custom domain, redirect or Auth setting was written. All new Netlify environment
writes targeted the new site ID explicitly. No team-wide variable was added.
The original local preview tab was left untouched.

## Staging database and hosted evidence

The new Supabase project was checked empty before setup. Its native Auth schema
was retained. Only this new project received these migration-ledger entries:

1. `20260923051658` / `eggs_staging_legacy_schema_fixture`: the 17-table public
   schema portion of `tests/database/eggs-identity-live-schema.sql`, without
   its fake local Auth setup or production rows.
2. `20260923051803` / `eggs_consumer_identity_reviewed_claims`: the exact revised
   candidate `supabase/migrations/20260922231308_eggs_consumer_identity_reviewed_claims.sql`.

Candidate SHA-256 with LF endings:
`4413c817e9bd5e0473e093e4c3894c18ffc4f6fcfe8a1a702d7a8ad6a37aa292`.
No second production migration was manufactured. The staging fixture is not a
production rollout input. The exact SQL diff from `64192b0` remains 27 added and
199 removed lines. No application or candidate changes were needed for hosting.

Catalog verification confirms three new public tables and the private handle
registry, all with enabled/forced RLS and narrow grants. Staging contains no
Auth users, consumer profiles, claims or players at this checkpoint. Platform
event triggers differ from production; `public.rls_auto_enable()` is absent
from the new platform baseline, so testing its proposed grant correction is
still a separate launch check.

Eight real anonymous PostgREST requests passed:

| Check | Result |
| --- | --- |
| Public profile projection | 200, empty array |
| Public Poker player RPC | 200, empty array |
| Public link projection | 200, empty array |
| Selecting Auth UUID column | 401 / 42501 |
| Selecting private claims | 401 / 42501 |
| Anonymous profile insertion | 401 / 42501; no insertion |
| Anonymous review RPC | 401 / 42501; no decision |
| Accessing `eggs_private` | 406 / PGRST106; schema not exposed |

Hosted home/login/profile return 200; browser inspection shows accounts
unavailable. `/api/eggs/profile` returns 503 with `Cache-Control: private,no-store`.
There is no claim of authenticated-user or real email success. The authorized
mailbox/access question remains unanswered. Signup, confirmation, PKCE, login,
refresh, logout/replay denial, owner/unrelated-user RLS, claim submission/review
and Poker-summary opt-in remain pending. No confirmation was bypassed and no
test identity was created in production.

Prior unchanged-code validation remains 63 application tests passing, one
inherited remote-import skip, and 19 native PostgreSQL passing records, plus
build/lint/four validators. This hosting/docs follow-up does not represent a new
full test run. Retention, timeout, holds and worker infrastructure remain absent.

## Remaining decisions

Finish the hosted Auth test window with an authorized mailbox and only the
staging targets above. Address the existing leaked-password protection and
legacy SECURITY DEFINER EXECUTE grants under the $0 limit; report any paid
feature as blocked rather than upgrading. Choose the canonical EGGS production
origin. Then present the completed evidence and exact SQL before requesting
production migration or consumer-launch authorization.

Google Drive may be considered later for files/exports. It has not been
connected or modified for this work, and it does not replace the existing
Supabase Auth/PostgreSQL/RLS/atomic-claim implementation. Music, library, profile
songs, friends and feeds remain out of scope.
