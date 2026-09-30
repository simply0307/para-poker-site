# EGGS portal and Para Poker acceptance plan

Checkpoint: September 23, 2026, continuing `bd58480` on `codex/eggs-shell`.
This is a local portal change and a read-only cross-project audit. It does not
authorize a deployment, production migration, Auth change, or paid resource.

The subsequent explicit decision makes `creative-systems-eggs` the eventual
shared production backend for EGGS, Para Poker, Gauntlet and Reath. See the
[current verification and migration design](shared-production-readiness-20260923.md)
for the new evidence, access blockers, namespace rehearsal and approval sequence.
No Gauntlet or Reath production migration is authorized by that design decision.

## Shared production backend

Use the existing `creative-systems-eggs` Supabase project
(`uzderzjbitmghfvrllvz`) for EGGS consumer identity and Para Poker. The additive
consumer candidate already targets that arrangement. The Poker client runbook
also identifies this project as its production backend; no database move is
needed simply to add its portal link.

EGGS owns Auth, canonical permanently reserved handles, profile presentation,
privacy, and explicit approved associations. Para Poker owns league players,
sessions, results, standings, evidence, and operator authority. Preserve
`profiles.auth_user_id` and existing roles. An EGGS consumer account never
confers operator access. Account deletion detaches links without deleting
league history, durable claim decisions, or permanent handle reservations.

Keep the free staging project `xokrweqdvkfcexczsewl` separate. Sharing production
does not justify testing with production rows or credentials. No per-game
Supabase project is required by this design, but shared usage still has quotas.
The [Free-plan allowance](https://supabase.com/docs/guides/platform/billing-faq)
is two active Free projects across the user's organizations. Staging occupies
the spare active slot. Do not restore Reath or provision anything as an
unreviewed side effect; its existing data must remain intact.

Shared storage is not shared authorization. Keep module grants/RLS, fixed
trusted API boundaries, and server-only credentials. Never give a new browser
or arbitrary integration the service-role key. Shared Supabase Auth does not
automatically transfer browser sessions across the existing project origins;
cross-site sign-in needs a separately tested flow and exact callback allowlists.
Do not pass access/refresh tokens through portal URLs.

## Portal connections

The home page now links the four projects using the existing card layout.
External anchors perform navigation only: no iframe, account merge, token
handoff, background import, or data copy. The implementation remains local.

| Project | Current entry point | Existing integration and next boundary |
| --- | --- | --- |
| Para Poker League | `/para/poker`; legacy public site remains `https://parapokerleague.netlify.app` | First complete EGGS identity integration; reviewed player claims and optional public Poker summary. |
| Gauntlet Online | `https://gauntlet-online.vercel.app` | Existing `gauntlet.para-match.v2` importer. Audit and explicitly link stable Gauntlet account IDs before shared identity; preserve guests and AI as distinct participant types. |
| EGGS Poker client | `https://eggspoker.netlify.app` | Existing `para-completed-session-v2` importer from durable server authority. Keep local/offline play distinct from official evidence. |
| Reath Digest | `https://reath-digest.netlify.app` | Currently an invitation-only New Jersey editorial desk. Link its existing entry point; do not publish internal stories or make EGGS consumers editors. |

The existing Poker client hostname remains a project destination, not the
canonical EGGS Auth origin. That production-origin decision remains open.

Reath's `creative os` backend (`okqkljexfzolzxysjaha`) contains useful data:
the prior read-only audit found 1,808 stories, 1,847 source items, and 78 sources.
It was returned to INACTIVE without repurposing. The landing page is reachable,
but that does not prove its paused backend or editorial operations work. No
Reath consolidation or restoration is part of this change. Its current
repository authority expressly isolates it from the Para/EGGS backend.

## Reusable game integration pattern

1. Register a project destination without changing the destination application.
2. Link EGGS profile UUIDs to verified, stable game-account IDs. Never match
   ownership from names or emails. Prefer typed association tables with real
   database constraints to arbitrary project-name/ID strings.
3. Ingest versioned, server-authored completed-match evidence through explicit
   preview, stable participant mappings, and atomic commit. Preserve exact source
   bytes, producer/version, ordered events, provenance, checksums, and idempotency.
4. Keep a separate result-review decision before advancing league standings.
   Importing an authoritative result is not approval to publish or rank it.
5. Expose bounded game-owned summaries to EGGS only after explicit visibility
   opt-in. A portal profile must not duplicate or overwrite authoritative stats.

The current Gauntlet compatibility adapter materializes into Poker-era evidence
tables. Reuse its validation/transaction pattern; do not make Poker hands,
chips, seasons, or ranking rules the universal model for all games. Reath needs
editorial objects, source attribution, and publication permission, not player
claims or competitive standings. No generic cross-game schema is added now.

## Para Poker findings and acceptance gates

The live public home, standings, and session `S0-003` were inspected without
submitting game actions or operator writes. The current standings table and
session results render. Read-only SQL confirms 7 players, 4 sessions, 365 hands,
2,350 actions, one linked operator, and eight migration entries; there is still
no `eggs_profiles` table or `eggs_private` schema in production. These counts
match the earlier audit, but counts alone are not a full data-integrity proof.

| Finding | Required resolution before declaring the league verified |
| --- | --- |
| [Standings](https://parapokerleague.netlify.app/standings) lists simply and Maven at 17 points, while the adjacent published commentary describes Para-Poker leading with 10. | Distinguish dated editorial coverage from the current computed board. Show its publication/evidence context and review stale coverage; do not silently rewrite published history. |
| [S0-003](https://parapokerleague.netlify.app/sessions/S0-003), Hand 53, displays five cards under `Flop`, then repeats turn and river. | Trace exact source, stored street fields, and rendering to identify the faulty layer. Reproduce in a disposable fixture. Preserve original bytes; any historical correction needs explicit revision/reconciliation. |
| The homepage's Hand 6 video showed `Unable to play media`. | Verify source availability, encoding/content type, and browser support. This observation alone does not establish whether the file or browser is responsible. |
| Hosted operator import/result-review flow is not yet certified. | Use synthetic staging data: preview/commit, exact retry, failed/replacement revision, explicit result approval, recomputed standings, and public dossier. Assert raw evidence and legacy rows are preserved. |

Local automated evidence from this turn: `npm test` completed with 63 passing,
zero failing, and one skipped remote raw-hand database integration test (64
reported test records). The disposable PostgreSQL 17 scenarios cover grants,
RLS, owner/unrelated/operator access, canonical and concurrent handles, claims,
withdrawal, competing approvals, deletion, rollback, and legacy preservation.
The completed-session and Gauntlet acceptance tests also pass. These local
results do not certify every hosted workflow or the three live presentation
findings above. The skipped test requires an explicitly disposable environment;
do not enable it against production or the staging identity dataset blindly.

After the portal edit, the production build, ESLint, all three built-app HTTP
shell tests, and the stats, import, homepage, and training validators passed.
The local rendered home page was inspected with all four destinations present
and the existing card layout intact. No new deployment was needed.

## Hosted identity checkpoint and remaining work

The current staging deployment remains the existing `bd58480` deployment; this
portal edit has not consumed another Netlify deploy. Consumer access is enabled
only for that isolated test window; production consumers remain disabled.

Real signup and email confirmation occurred. Repeated use of the confirmation
link then returned `otp_expired`; the first PKCE callback did not establish a
verified successful session and remains unresolved. Password sign-in recovered
access. Real UI operations passed profile creation, private-by-default public
404, explicit public visibility, claim submission, withdrawal with retained
evidence, and a fresh pending claim. Eight anonymous PostgREST checks passed.

The operator sign-in page still awaits user completion. Approval, hidden-by-default
association, explicit Poker-summary opt-in, token refresh, unrelated-user access,
direct user-token PostgREST/RPC checks, logout and token/session replay denial
remain to be demonstrated. The staging operator mapping uses the same authorized
test Auth user, so it does not establish independent-reviewer identity coverage.
Do not record password login as proof that PKCE works. Do not put the authorized
test mailbox, passwords, tokens, or confirmation links in committed evidence.

## Order of work and production boundary

1. Complete Para Poker acceptance: investigate the three live findings locally,
   then run the operator import-to-approved-standings flow on disposable data.
2. Finish the real hosted identity flow above using the existing deployment.
   Resolve PKCE with a fresh, authorized confirmation flow; hand the user any
   required email click. Return staging consumers to disabled when testing ends.
3. Verify the Poker client's durable producer against the league adapter, then
   Gauntlet's producer, including schema drift, repeat imports, conflicts, and
   explicit account mappings. Audit deployed backend configuration read-only
   before proposing any new persistent identity bridge. Preserve existing games.
4. Keep Reath as a portal destination pending its own scoped editorial/publication
   integration. Do not migrate its useful database into EGGS as a shortcut.
5. Resolve the existing launch-security items: leaked-password protection under
   the $0 ceiling, broad EXECUTE grants on `public.rls_auto_enable()`, and the
   canonical production EGGS site/callback URLs. No paid plan or production Auth
   change is authorized. Report any protection requiring paid service as blocked.
6. Present the unchanged candidate SQL/hash, fresh audit, acceptance results and
   exact rollout sequence in [the identity report](eggs-consumer-identity-implementation.md).
   Obtain separate production migration, security/Auth, deployment, and consumer
   launch authorization before those actions. Keep consumers disabled through
   migration and legacy verification.

No production writes, deployments, additional projects, paid resources, or
edits to other project workspaces were performed for this portal change.
Gauntlet's existing dirty worktree was left intact. Music, library, profile
songs, friends, feeds, and additional profile features remain outside scope.
