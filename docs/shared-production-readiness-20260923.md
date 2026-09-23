# Shared EGGS production: verification and migration design

Checkpoint: 2026-09-23, continuing EGGS `463cc91` on `codex/eggs-shell`.
This report records an audit and a local design rehearsal, not production launch
approval. The user's latest decision makes `creative-systems-eggs`
(`uzderzjbitmghfvrllvz`) the eventual production authority for EGGS, Para Poker,
Gauntlet and Reath. Existing applications remain authoritative until each
separately approved cutover. The earlier portal plan's isolation decisions remain
in force operationally; the future consolidation design below supersedes its
deferred architecture decision.

Follow-up at 18:49 UTC: the user recovered and signed in to the existing owner
account. See [the authenticated production verification](production-operator-ai-verification-20260923.md)
for the real Gemini failure, deployed generation authorization gap and expanded
42-table preservation checkpoint. This supersedes the earlier login blocker.

## Outcome and boundaries

| Requirement | Result |
| --- | --- |
| Canonical EGGS + Para backend | Live project verified; additive consumer migration still absent. |
| Existing league data preserved | Counts and row fingerprints unchanged across 15 audited tables; six relationship checks returned zero violations. |
| New `/para/poker` pages using production data | Ten candidate routes returned 200 through a local read-only gateway. Actual published `/para/poker` still returns 404. |
| Authenticated production newsroom AI smoke | Owner login now passes; one real Gemini `gemini-2.5-flash-lite` request failed because the provider rejected the key. No draft saved. |
| Deployed generation authorization | FAIL: all seven deployed generation handlers lack the candidate's operator guards; anonymous probes returned 400/500. |
| Exact live Gauntlet persistence authority | BLOCKED by access to the wrong Render workspace; source behavior mapped, live configuration unknown. |
| Reath namespace design | Local `reath` rehearsal passed 21-table / 43-function behavior and isolation checks. No hosted migration or source-project edit. |
| Production changes, consumer launch, paid infrastructure | None performed. No deploy, new project, restoration, plan upgrade or subscription. |

This is partial production verification. Public rendering and read-only database
checks do not certify authenticated import commits, result approval, live AI,
media playback, or all hosted consumer Auth flows.

## Para Poker production and candidate verification

The published league site is `https://parapokerleague.netlify.app`, Netlify site
`6f362002-a90e-4504-bffa-e35d52a55683`, deploy `6a88df898ba41e0008ee7240`, commit
`ca431bb734fab97c8da1dfeae0d515cf2ac1305f` from `main`. It was not replaced.
The existing EGGS Poker client hostname is a game destination, not the chosen
EGGS Auth origin. No canonical EGGS production domain has been selected.

The current candidate was served locally against the actual canonical database
using a loopback proxy restricted to GET requests to individual PostgREST tables.
The server received placeholder keys; the real read credential stayed inside
the proxy. RPC, Auth, Storage and all non-GET requests were rejected. The proxy
and its preview were stopped after verification. This is an audit technique,
not a deployment configuration or a proposed browser credential pattern.

The following candidate routes returned HTTP 200, without data-unavailable
fallbacks or legacy public-route links:

- `/para/poker`
- `/para/poker/players` and `/para/poker/players/simply`
- `/para/poker/sessions` and `/para/poker/sessions/S0-003`
- `/para/poker/standings`
- `/para/poker/moments` and `/para/poker/moments/384`
- `/para/poker/articles` and `/para/poker/articles/8cc046de-9d07-451a-8fcd-af7a198acc79`

The rendered simply dossier showed rank 1, 17 points, two sessions, one win and
294 hands. Anonymous `/admin`, `/admin/imports` and `/admin/player-claims`
requests redirected to operator sign-in. Unauthenticated recap generation and
both completed-session and Gauntlet import-commit endpoints returned 401.

There were 87 allowed upstream table reads and three blocked requests for signed
video URLs. The latter were Storage signing operations, not attempted league
result writes. Media playback is consequently not certified by this rehearsal.
Optional legacy columns and missing optional draft tables produced some 400/404
reads; the existing compatibility paths rendered the real data successfully.

Production has 42 public tables with RLS enabled, eight migration entries, no
`eggs_profiles`, no `eggs_private`, and no `gauntlet` or `reath` schema. The
15-table row-fingerprint checkpoint includes:

| Data | Rows |
| --- | ---: |
| Players / operator profiles | 7 / 1 |
| Sessions / hands / actions | 4 / 365 / 2,350 |
| Session results / standings | 8 / 4 |
| Import packages / evidence revisions | 9 / 3 |
| Session / season / career stats | 8 / 4 / 0 |
| Newsroom drafts / published_articles | 26 / 0 |
| Poker client authoritative matches | 3 |

All 15 fingerprints matched before and after this audit. This proves preservation
for these measured rows, not a backup or complete fingerprint of every project
object. The six zero-violation checks covered hand/session ownership, action/hand
references, action/session consistency, result player/session references, current
evidence-revision ownership, and imported package/session/revision consistency.

All nine packages use the completed-session format: three imported, three invalid,
two ready, one conflict. There are 13 approved and 13 draft `recap_drafts`.
Approved coverage is served from this legacy table; an empty `published_articles`
table is not evidence of lost articles. Existing import/evidence RPCs and operator
`profiles.auth_user_id` relationships remain present.

### Operator authentication and AI

The production Auth log recorded `400: Invalid login credentials` on `/token`
at 17:53:07 UTC. The linked owner Auth account is confirmed and has a password
credential; the operator mapping is intact. The failure occurs before the
application's role check. Neither the staging password nor a newly created EGGS
consumer account establishes access to this existing production owner account.
No credential, role, session or Auth setting was changed to bypass it.

The candidate generation route authenticates the operator, builds the real evidence
packet, invokes its configured AI provider, validates output, saves a draft, and
records training/generation metadata. It does not automatically publish or change
league results. The exact published generation handlers lack that operator guard;
protected admin pages do not make those endpoints private. No replacement mock
was introduced.

**Follow-up smoke result: FAILED; actual request targeted Google Gemini
`gemini-2.5-flash-lite`.** The user subsequently signed in as the same owner and
one S0-002 draft request was run. Gemini rejected the key as invalid; no draft
was created. All 42 public-table fingerprints remained unchanged.
Source defaults to Gemini `gemini-2.5-flash-lite` with configuration overrides;
Anthropic and OpenAI adapters remain present. Existing draft metadata records
Gemini `gemini-3.1-flash-lite` and `gemini-3.5-flash`. Those historical records
are not proof of today's runtime selection; the fresh failure trace establishes
the requested model for this attempt. The
readable Netlify site/shared/build environment metadata did not establish an AI
provider/model/key configuration. Do not infer that secrets are absent or that
the source default is the deployed model.

The single authorized attempt is complete with a failed result. Resolve the
credential/endpoint configuration and deployed authorization gap through a
separately approved change before retesting. Do not retry blindly or choose a
different paid provider as a workaround. Account recovery preserved the existing
Auth UUID and operator mapping.

### Remaining Para acceptance issues

The [portal acceptance report](eggs-portal-integration-plan.md) records stale
editorial commentary adjacent to live standings, an unavailable moment video,
and five board cards displayed under a Flop label. The latter also reproduced
in the candidate dossier, across multiple hands. Trace source evidence versus
stored fields versus rendering before correcting history. The large session
HTML payload (about 3.1 MB for S0-003) is also an observed performance risk.
No source evidence, approved coverage or league result was rewritten.

Complete a disposable, authenticated import-preview/commit/retry/conflict/revision
and explicit result-approval exercise before certifying the full pipeline.
Existing pure and embedded acceptance tests pass, but the optional remote raw-hand
integration test remains skipped. Do not run it against production accidentally.

## Gauntlet persistence audit and deliberate migration plan

Source inspected: `BurntRamen/gauntlet-online`, branch
`codex/detailed-match-history`, commit
`94410a6391f66f8f9bbde79376e080e3e50698b7`. Existing dirty manifest/release files
and local audit directories were left untouched. Public client:
`https://gauntlet-online.vercel.app`; expected backend:
`https://gauntlet-online.onrender.com`.

**The actual deployed persistence authority is not yet known.** The signed-in
Render workspace exposes only old `para-poker-site` service
`srv-d9dorsbrjlhs73b2hibg`, not `gauntlet-online`. That service is unrelated to
the required audit and was not altered. Need the correct existing Gauntlet Render
dashboard/account access to identify deployed SHA, database project reference,
effective modes, disk mounts and paths. Do not substitute repository configuration
or historical handoffs for this evidence.

Source-confirmed possibilities, pending live reconciliation:

| Data | Source persistence behavior |
| --- | --- |
| Accounts and credentials | `public.gauntlet_accounts` when Supabase URL plus secret/service key are present; otherwise `ACCOUNT_DATA_FILE`, default `server/accounts.json`. Stable UUID, custom salted password hash, account stats JSONB. |
| Progression, collection, decks, rewards, season stats | Account stats JSONB with consequence receipts and compact match references; preserve complete document semantics. |
| Friends / messages | `gauntlet_friends` and `gauntlet_friend_messages`, or local account storage mode. |
| Faction statistics | `gauntlet_faction_stats`, or `FACTION_STATS_DATA_FILE`, default `server/faction-stats.json`. |
| Durable complete matches | Preferred `gauntlet_match_records`, `gauntlet_match_events`, `gauntlet_match_consequence_receipts` and atomic `finalize_gauntlet_match`; account effects use `apply_gauntlet_account_consequence`. |
| Compatibility match persistence | `gauntlet_faction_stats` rows with `match:<id>` journal envelopes; otherwise account-only consequences/references with process-local full records, or local `MATCH_DATA_FILE`, default `server/matches.json`. |
| Avatars | Private `gauntlet-profile-images` Storage bucket and server proxy; inline account-data fallback exists. Local avatars use `ACCOUNT_AVATAR_DATA_DIR`. |
| Optional cloud match archive | Private `gauntlet-match-archives` plus `gauntlet_match_archive_index`; separate from browser match history. |
| Player-owned history | Browser IndexedDB MatchLibrary and canonical v2 export/import files. Server compact references cannot reconstruct missing full records. |
| Active rooms / reconnection | Process state and `ROOM_STATE_DATA_FILE`, default `server/rooms.json`; durable Render mount is unverified. Contains private game state and reconnect credentials. |

The backend currently uses the default PostgREST schema and custom HMAC account
tokens (`ACCOUNT_AUTH_SECRET`, seven-day source TTL). Preserve current password
verification, salts/hashes, account UUIDs and session behavior until separately
approved Auth integration. Do not import those accounts as newly seeded EGGS
Auth users or match identity by display name/email.

Do not call `/api/storage-status` as a supposedly read-only probe: its avatar
status path calls `ensureAccountAvatarBucket()`, which can create a missing
bucket. It was deliberately not invoked. Use actual deployment configuration
and read-only catalog/bucket/file metadata instead.

Proposed sequence, requiring a separate execution approval:

1. Establish the deployed SHA and active database/file/Storage authority. Capture
   counts, catalog, checksums, object inventory, mounts, and match persistence
   fallback mode without returning secrets or credential rows in reports.
2. Inventory every active writer, including WebSockets, background finalization,
   archive writes, reconnect snapshots and any other consumers of the old data.
   Design a drain/write fence and recovery checkpoint; do not kill active matches
   or change a shared host's services as a shortcut.
3. Prepare additive `gauntlet` schema definitions retaining `gauntlet_*` table,
   account and match identifiers. Reconcile the actual live DDL first. Preserve
   full journals, receipt idempotency, JSONB payloads, private avatars and archives.
   Establish `gauntlet_runtime` with only the necessary schema/RPC privileges;
  update explicit Data API schema routing. A shared service-role key is not an
   acceptable strict project boundary. Pre-provision only approved private
   bucket names; scoped object permissions must replace runtime bucket-creation
   authority without changing the avatar/archive user experience.
4. Rehearse a controlled transfer of existing authoritative records with checksums,
   foreign keys, sequence positions and atomic finalization/conflict tests. Never
   reseed accounts, regenerate history, merge unrelated Poker tables, or make a
   second independent writable authority. If only account references survive,
   report missing history rather than inventing events.
5. Add a typed account association after EGGS profiles exist: stable EGGS profile
   UUID plus stable Gauntlet account UUID, database uniqueness in both directions,
   explicit dual-session ownership proof or reviewed operator claim, atomic
   competing-claim handling and a durable decision trail. Profile deletion
   detaches the link; it must not delete Gauntlet accounts, friends or matches.
6. With an approved maintenance window, fence old writes, reconcile a final delta,
   switch the existing backend's scoped connection, verify login/match completion/
   progression/friends/avatars/history, then reopen writes. Preserve the old
   recovery checkpoint. Before new writes, rollback can revert configuration;
   after new writes, reconcile them before switching back. Never restore an old
   snapshot over newly completed matches.

No Gauntlet database, runtime, credential, host setting or application file was
changed. No claim of a successful Gauntlet migration is made.

## Reath namespace migration design

Source inspected: `simply0307/creative-systems`, branch
`codex/reath-digest-backend-recovery`, commit
`9e5d24d8b2d676e6f45138d754da96e89fc6a759`. Checkout remains clean. Its active
guard still targets `creative os` (`okqkljexfzolzxysjaha`), currently inactive.
No restoration or repurposing occurred in this audit. The previous read-only
checkpoint found 20 application tables, 24 migration entries, 1,808 stories,
1,847 source items, 78 sources, 92 ingestion runs and one Auth user. Useful data
must remain intact. Current source has 21 application tables; reconcile this
source/live difference and the exact migration ledger before producing final DDL.

`20260822031655_convert_creative_os_to_reath_digest.sql` begins by dropping and
recreating `public`. **Never run this historical migration against the shared
project.** It would remove Poker, Poker client and preserved Creative Archive
objects. `public.set_updated_at()` also collides with an existing production
function. Namespacing must cover tables, FKs, indexes, triggers, row types,
functions, dynamic SQL, regclass references, policies, grants and search paths.

Design an additive, reviewed baseline for the *actual deployed* Reath schema under
`reath`; do not replay the source project's destructive history, data repair
batches, seeds or historical scheduling migrations in canonical production.
Keep the canonical project's migration ledger; do not import two independent
ledgers or mark incompatible SQL applied. Include exact preconditions and abort
on unexpected object collisions. Do not use permissive `IF NOT EXISTS` to hide
schema drift. Provision no new database or hosted branch.

Keep these runtime semantics:

- Netlify Identity invitation/role checks remain editorial Auth. EGGS consumer
  membership must not grant viewer/editor/admin access automatically.
- Preserve sources, source items, attachments and decisions, stories, editorial
  queue, revisions, AI requests/leases, run state, configuration and audit records.
  Keep provenance and publisher notices intact; no reseeding or reclustering.
- Keep existing ingestor entry points, Netlify function wrappers and editorial
  actions. Current manual ingestion remains manual; do not reactivate historical
  Supabase cron/net schedules or obsolete Edge URLs/Vault credentials.
- Preserve real Netlify OpenAI calls, configured models/prompts/budgets, evidence
  validation, revision/config fences and human publication authority. Source
  default is `gpt-5-mini`; that is not an audited live model claim. The Edge
  worker's AI-disabled behavior remains unchanged. No Reath AI call was made.
- Reath's evidence-attention/publisher-notice behavior is separate from removed
  EGGS claim retention. Do not strip its existing editorial maintenance rules.

Required future code changes are restricted to connection/schema and identity
boundary plumbing: Netlify and Edge `_shared/reath/supabase.mjs`, their config
guards, `netlify/functions/lib/runtime-contract.mjs`, generated shared-runtime
sync outputs, associated types/tests, and authority documentation. Use explicit
`db.schema = 'reath'` for the supported Supabase JS route or equivalent explicit
PostgREST schema headers. Inventory all other direct SQL/RPC call sites first.
Keep the existing protected functions folder/build layout. Do not flip the
current hard-coded project-ref guard before the namespace, transfer and scoped
transport have been approved and verified together.

Use a restricted non-superuser, non-BYPASSRLS `reath_runtime`, with no access to
Poker, consumer private data or Gauntlet objects. RLS policies and narrowly scoped
function grants must authorize only the editorial backend. Custom-schema Data API
exposure also needs an explicit reviewed configuration change. Issuing a second
Supabase secret/service-role key does not create a project-scoped boundary:
[service roles bypass RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
The exact supported restricted-role transport/credential mechanism remains a
design gate, to be tested at the hosted API boundary before cutover. Avoid public
generic SQL executors or broad SECURITY DEFINER wrappers. See the official
[custom schema requirements](https://supabase.com/docs/guides/api/using-custom-schemas).

This restriction must ultimately cover every application runtime, including
existing Para/Poker clients that currently use broad server credentials. A new
schema with a restricted Reath role does not constrain another application's
existing service-role credential. Keep administrative/migration credentials
outside application runtimes and test the full cross-project deny matrix before
claiming strict isolation. This is a separately reviewed credential/transport
change; it has not been applied to any existing pipeline.

### Disposable namespace rehearsal

Run from this EGGS repository with an existing Reath checkout and its installed
dependencies:

```powershell
node scripts/verify-reath-namespace-plan.mjs 'C:/Users/gjoep/OneDrive/Desktop/Reath Digest Backend Recovery'
```

The harness reads and hashes Reath source, removes its optional remote check,
transforms SQL only in temporary local execution, and runs its embedded PGlite
database assertions. It is not a production migration generator. It does not
modify either project's migrations or access a remote database.

Passed: 21 tables / 43 functions, 564 municipalities, 78 assessed sources (72
active), ingestion fencing, reconciliation audit/recovery, provenance,
non-destructive evidence attention, immutable publisher notices, revision-safe
AI state and PT412 stale-request behavior. Added namespace checks preserved
legacy player/operator/consumer sentinel rows, ACLs, RLS flags and the colliding
`public.set_updated_at()` definition. The non-bypass Reath role could read its
sources but not legacy tables; anon, consumer and Gauntlet roles could not read
Reath or invoke its evidence helper. ESLint passed after adding the harness.

Limits: embedded tests are not native hosted concurrency or API transport proof.
Sentinels are not a full production catalog clone. The rehearsal uses current
source, not the paused project's verified current catalog. Before migration,
complete the exact live-ledger comparison, native PostgreSQL transaction/concurrency
tests, hosted role/RLS matrix and rollback rehearsal. With an approved write fence,
transfer existing records and reconcile checksums/relationships, then change only
the current application's scoped backend connection. Preserve its old recovery
checkpoint and reconcile new writes if rollback becomes necessary.

## Production blockers and approval sequence

1. Existing owner access is now verified. Repair the deployed generation guards
   and Gemini credential/endpoint configuration through separately approved
   changes, then obtain a successful draft-only smoke. Finish Para's independent
   import/review and media/evidence acceptance issues on disposable data.
2. Complete the existing hosted EGGS staging flow: fresh verified PKCE callback,
   independent operator review, user-token owner/unrelated-user PostgREST/RLS,
   Poker-summary opt-in, refresh, logout and replay/invalidation semantics. Prior
   password login does not certify PKCE. Reuse the current deployment where
   possible; staging is testing only. No new Free-plan credit spend is assumed.
3. Select the canonical EGGS production origin. Present exact Site URL, callback
   and redirect allowlist changes, legacy route redirects and deployment/site
   destination for approval. Do not adopt `eggspoker.netlify.app` as EGGS Auth.
  Preserve the existing legacy production sites unless explicitly approved.
   The audited production Auth configuration still uses the legacy
   `https://eggspoker.netlify.app` Site URL and `http://localhost:5173/**`
   additional redirect. Those existing values were left unchanged; they are not
   the proposed EGGS launch configuration.
4. Resolve leaked-password protection under the $0 constraint and the broad
   executable grants on `public.rls_auto_enable()`. Its SECURITY DEFINER/event
   trigger form and broad grants were observed; ordinary-call exploitability has
   not been established. Review the minimum grant correction independently from
   the consumer schema. No grant or Auth setting has been changed.
5. After fresh backup/recovery and catalog comparison, approve the exact existing
   additive consumer migration, then apply once with consumers disabled. File:
   `20260922231308_eggs_consumer_identity_reviewed_claims.sql`; normalized SHA-256
   `4413c817e9bd5e0473e093e4c3894c18ffc4f6fcfe8a1a702d7a8ad6a37aa292`.
   It remains unchanged by this audit: permanent handles, atomic reviewed claims,
   no automatic claim timeout/evidence expiry/holds/retention workers, safe profile
   deletion that preserves league history. There is no fake second migration.
6. Separately approve the EGGS production build/deployment and exact Auth/security
   settings. Verify all new public routes, operator imports/newsroom and legacy
   redirects against the deployed release, then verify hosted consumer behavior
   before explicitly enabling consumer rollout. Do not push/deploy implicitly.
7. Obtain correct Gauntlet Render access, finish the real persistence audit and
   approve its exact schema/role/transfer/linking/cutover/rollback package later.
8. Reconcile Reath's live catalog and source at $0, accounting for the existing
   Free active-project limit without pausing an unrelated application. Approve its
   exact namespaced baseline, scoped transport/Data API settings, record transfer
   and existing-site connection cutover separately. Never run the public reset.

This audit added no music, library, social, profile-song or other consumer
features. Existing Gauntlet friends and Reath editorial data are preservation
requirements, not permission to add EGGS social functionality. No production
migration, Auth change, consumer launch, cross-project cutover or paid resource
was performed. The new report and rehearsal are local review material only.
