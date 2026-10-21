# EGGS hub: Reath Digest and shared community

This extends the local Personal Internet implementation at `fdbc4d760887fb1946af17483402b2ae12db9686` in draft [PR #5](https://github.com/simply0307/para-poker-site/pull/5), dependent on [PR #4](https://github.com/simply0307/para-poker-site/pull/4). It is implementation and local verification, not production release approval.

## Delivered behavior

- **Reath Digest:** the published Reath project points to `/reath-digest`; the old `/projects/reath-digest` address redirects there after checking that the project is published. The reader has publications, Funnies, comics/art and videos, search, filters, original source credit and links to canonical library items. It reads approved published snapshots only. It does not turn the internal Reath Wire workflow or ingested material into public articles.
- **Shared community:** `/community` supports public posts, one level of replies, explicit like/unlike, author feeds and stable conversation links. Confirmed, live EGGS account sessions can participate through a public profile. Authors can edit with revision conflict protection or delete their own content. No fabricated users, posts, popularity or activity appear in normal preview data.
- **People and personal pages:** `/people` searches public profiles; private profiles are not enumerated. Identity cards link to rooms. Account navigation resolves the current owner handle and provides My Page, Edit, Account and sign out. Existing room privacy, Featured Eight, favorites and separate Poker consent remain in effect.
- **Moderation:** existing Hub publishers can hide/restore content with a reason through `/eggs-admin/community`. The queue is authenticated, uncached and session-sensitive. Editors, Poker operators and user-controlled metadata do not receive this permission automatically.
- **Product shell:** the homepage connects Play, Read & Watch and Belong, with real catalog content and real public posts when available. Carton Classic and After Hours remain independent from saved room themes. Studio navigation includes Reath, Community and People when available. Genuine project marks replace generic placeholders where verified; the EGGS wordmark remains text pending a verified master.

`EGGS_COMMUNITY_ENABLED=false` is a new independent default. The consumer, Hub and rooms defaults remain false. Community routes are unavailable when their gate is off, and navigation/feed calls are suppressed. Gates control availability, never database privacy.

## Database candidate and compatibility

The only new candidate is [`20261021013054_eggs_community_feed.sql`](../../supabase/migrations/20261021013054_eggs_community_feed.sql), generated with `supabase migration new eggs_community_feed` after inspecting the installed CLI's help. The exact patch is [migration.diff](migration.diff). No hosted SQL was run.

The three preceding migrations retain their original bytes:

| Migration | SHA-256 |
| --- | --- |
| `20260922231308_eggs_consumer_identity_reviewed_claims.sql` | `01602fc25c95d4c03480379d6f0b6c7ab6e2ab7d58887b38fe5a9de8f83ea561` |
| `20261016030028_eggs_hub_catalog_expression.sql` | `4631d41abafe53ec5b4b2e612ce6271ff82a53a4320341c3599be924919c3ec4` |
| `20261016080147_eggs_personal_internet.sql` | `698abca42af8a6890496dbc7be0d1e1baa411feae932bbf83785d1e1d1c6c7c1` |

New `eggs_community_private` tables contain posts/replies, unique per-profile likes, body-free creation-rate events and body-free moderation audits. Forced RLS and revoked table/sequence privileges prevent direct client reads and writes. Fixed-search-path private functions expose narrow public invoker wrappers with explicit execution grants. Ownership always comes from the existing verified live-session/profile helper, never caller-supplied owner IDs.

Public projections require a confirmed public author. Replies also require an available public parent. Hidden/private/deleted authors and their contributions are absent from feeds, conversation output and public counts. Public author cards contain only profile ID, handle, display name and registry avatar/theme IDs: no email, Auth ID, bio, favorites, affiliation, featured note or Poker data. Existing module visibility boundaries remain unchanged. Anonymous API and SSR use the same database projection through an anonymous client. Metadata is generic, without post text or expression content.

Edits lock the post row and require its expected revision; a stale edit returns `PT409` / HTTP 409 without changing the successful edit. Like/unlike is explicit and idempotent. Creation is serialized per profile and limited to 20 root posts and 50 replies per rolling hour; deleting and recreating does not reset that counter. Posts are plain text, at most 1,000 characters. Moderation reasons are at most 240 characters. Profile deletion cascades rooms, selections, community posts/likes/rate events; moderation audit survives with nullable actor references and no retained post body. Retired handles, reviewed-claim audit and historical Poker records remain intact.

The candidate also extends the existing private work validator to accept optional `format` and `media_url` while preserving the original five required keys. Video works require a nonempty canonical YouTube watch URL or Vimeo URL, enforced in SQL as well as the application. Existing editor/publisher saved-preview and explicit-publication checks, registered assets and verified permission records still apply. Nothing is auto-published. The Reath adapter requires its exact project UUID and the same approved snapshots; a similarly named work or unverified draft cannot appear.

## HTTP and RPC interfaces

| HTTP | Access and result |
| --- | --- |
| `GET /api/eggs/community?before=&before_id=&limit=&author=` | Anonymous narrow feed, descending timestamp/UUID keyset, page size 1–50, `{posts,next_cursor}`. Cursor fields must be supplied together. |
| `GET /api/eggs/community/posts/[id]` | Anonymous available root conversation, `{post,replies}`; unavailable/private/hidden returns 404. Reply links use the root URL plus a reply anchor. |
| `GET /api/eggs/people?q=&after=&limit=` | Anonymous basic public identities, handle keyset, page size 1–48, `{people,next_cursor}`. Supports a leading `@` in search. |
| `GET /api/eggs/community/session` | Live authenticated owner context and own liked IDs; never part of public SSR. |
| `POST /api/eggs/community/post` | Same-origin, confirmed live session; strict action-specific JSON fields. Actions: create, edit, delete, like, unlike, hide, restore. |
| `GET /api/eggs/community/moderation` | Live authenticated Hub publisher only; hidden queue, maximum 100 rows. |

Public RPCs are `get_eggs_community`, `get_eggs_community_post` and `list_eggs_people`. Authenticated RPCs are `get_my_eggs_community`, `write_eggs_community` and publisher-checked `get_eggs_community_moderation`. No raw private table is a PostgREST surface. Errors map to 400 for malformed input, 401/403 for session/authorization failure, 404 for unavailable content, 409 for stale revisions, 429 for creation limits and 503 when the feature gate is disabled.

Client session changes clear composer/editor drafts, stale errors and protected queue state. A shared request epoch prevents old post-write, pagination or focus-refresh responses from restoring data belonging to a prior session. Focus and visibility refresh both session and public projection, so a changed profile privacy setting is reflected on an already open feed.

## Verification evidence

[verification.json](verification.json) records exact commands, counts, runtimes, hashes and browser evidence. [test-results.txt](test-results.txt), [build-results.txt](build-results.txt), [browser-results.json](browser-results.json) and [security-advisors.json](security-advisors.json) contain local results. Screenshots are under [screenshots](screenshots/).

The new SQL/PostgREST suite covers anonymous, owner, unrelated user, editor, publisher, unconfirmed and revoked sessions; direct-read denial; write ownership and strict argument validation; parent/privacy boundaries; idempotent reactions; stale concurrent edits; cursor ordering and author filters; moderation/audit; per-profile creation limits; account deletion; preservation of legacy Poker records and predecessor SQL; and transactional migration failure rollback.

The application suite runs built Next routes against real disposable PostgreSQL 17 and PostgREST 16.4, including public SSR/hydration absence checks, protected mutations, wrong origins, Reath publication filtering and video validation. Auth is a **simulated local fixture**, not hosted signup, email delivery, PKCE or production authentication verification. Browser interactions also use these identified synthetic accounts and content. Normal preview intentionally starts without synthetic community posts or Reath publications.

The full regression suite includes identity/RLS, canonical/concurrent handles, claim submission/withdrawal/competing approvals, account deletion, room privacy/revisions, existing imports, seven generation authorization guards and Gemini gateway behavior. It does not make live AI calls, change league results or access production databases. The single existing remote raw-hand integration remains explicitly skipped unless disposable Supabase credentials are supplied; all native local PostgreSQL/PostgREST tests execute.

Production dependency audit reports zero vulnerabilities. The full dependency audit exits 1 with five existing high-severity development-tool entries in the `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces` chain (one underlying braces advisory). This work changes no dependency or lockfile. npm proposes an incompatible major downgrade of `eslint-config-next`; it was not applied automatically. This remains a documented development-tool risk, not a clean full dependency audit. Local Supabase security advisors report no issues in the disposable migrated schema.

Reproduce with existing local tools, without installing infrastructure:

```powershell
$env:EGGS_TEST_POSTGRES_BIN = '<existing PostgreSQL 17 bin>'
$env:EGGS_TEST_POSTGREST_BIN = '<existing PostgREST 16.4 executable>'
npm run build
npm test
npm run lint
npm run validate:training
npm run validate:homepage
npm run validate:parapoker-import
npm run validate:stats
node scripts/check-eggs-community-browser.mjs
node scripts/preview-eggs-community.mjs
```

The preview defaults to loopback port 3114, initializes disposable local fixtures and stops/cleans up when given `stop`. Its fixture password is test-only. It is not a deployment. `audit-eggs-community-local.mjs` accepts only an installed local CLI and creates/validates its own loopback `hub_test` target, with telemetry disabled and connection details redacted.

## Implemented and deliberately deferred

| Area | Status |
| --- | --- |
| Reath reader, formats, filters, credit, canonical links | Implemented; no unapproved archive publication |
| Published project hub and verified project marks | Implemented; EGGS master still unavailable |
| Shared posts, replies, likes, editing, deletion, conversations | Implemented with database authorization/privacy |
| People discovery, account links, existing rooms | Integrated; public identities only |
| Publisher moderation and durable body-free audit | Implemented |
| Friends/follows, DMs, notifications, user uploads, music | Deferred; no placeholder counters or implied functionality |
| Public release of private Reath comics/videos | Requires actual editorial/permission clearance and deliberate publication |
| Hosted community verification and production release | Not performed or authorized |
| Gauntlet/Reath data migration or game/client changes | Not performed |

## Release gates and rollback boundary

This branch and draft PR do not authorize a release. Production main, Netlify, Supabase, Auth settings and all game/legacy pipelines remain unchanged. No infrastructure was provisioned, no spend was incurred and no remote migration was run.

Before a future separately approved release: choose the canonical EGGS production origin and SMTP sender; review Auth/credential settings and leaked-password protection; review unnecessary execution access to `rls_auto_enable()`; re-audit current production schema/grants; approve identity → Hub → rooms → community candidates in order; grant intended publisher membership; perform isolated hosted user-token/RLS/session and moderation checks; obtain explicit deployment authorization. Confirm the existing Para data/imports/newsroom/Gemini pipeline under `/para/poker` before enabling consumer accounts and then any rooms/community gates.

Operational rollback disables `EGGS_COMMUNITY_ENABLED` and, if necessary, rooms plus incompatible Hub expression readers, while retaining restrictive grants and stored data. It must not restore the former broad expression/bio grants. After real users write data, dropping the new schema or reverting to a pre-privacy reader is not a safe routine rollback. Transaction-failure rollback is tested only in disposable databases.

Residual risks: these local fixtures cannot prove hosted SMTP/PKCE, real session configuration or production load. Moderation needs an assigned publisher and operating process. Conversation replies are currently returned as a complete visible thread; a high-volume release should add bounded reply pagination. Body-free rate-event and audit storage should be monitored at scale; there is no automatic content/evidence deletion policy. A public post is deliberately public and may have been copied before an author makes a profile private. Published third-party video links load only after a visitor follows the external link, and platform availability/rights still need editorial review. No arbitrary embeds, remote user images or uploaded assets are accepted.
