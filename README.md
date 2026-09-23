# EGGS Web

An EGGS application shell with Para Poker League as its first project module.
This is an incremental adaptation of `simply0307/para-poker-site` at
`ca431bb734fab97c8da1dfeae0d515cf2ac1305f`, preserving its public dossiers,
competition records and operator newsroom.

Read [the architecture audit](docs/eggs-architecture-audit.md) for the current
identity boundaries, proposed additive schema, file map, risks and migration
sequence. `profiles.auth_user_id` remains the existing operator relationship;
consumer `eggs_profiles` and reviewed player claims are implemented behind a
disabled rollout flag, not deployed.
The [Phase 1 implementation report](docs/eggs-migration-status.md) records the
current boundaries and validation. The [consumer identity proposal](docs/eggs-consumer-identity-proposal.md)
is retained for comparison. The [Phase 2 audit](docs/eggs-phase2-identity-audit.md)
documents the verified live database and a tested additive migration candidate.
The [consumer implementation report](docs/eggs-consumer-identity-implementation.md)
contains the revised handle-reservation SQL, authentication and claim
flows, verification results, production plan and rollback limits.
The consumer migration remains unapplied to production.

## Development

On Windows PowerShell, run (Node 22 or later):

```powershell
npm.cmd ci
npm.cmd run dev
```

Then open http://localhost:3000.

The EGGS shell runs without credentials. League routes show an unavailable
state until the league variables in `.env.example` are configured in `.env.local`.
Only use the intended league database; do not copy credentials into client code.
The existing Supabase project was restored with user permission for the Phase 2
read-only audit. Schema, RLS, grants and Auth settings were verified; live account
login/session behavior remains a later rollout check. No live data is bundled;
synthetic identity fixtures are confined to local database and HTTP tests.
Consumer development additionally needs the reviewed schema in a disposable
environment, `EGGS_SITE_URL`, and `EGGS_CONSUMER_ENABLED=true`. Keep consumer
rollout disabled against production until the canonical EGGS domain is chosen
and the rollout plan is approved.

## Routes

- `/` is EGGS home; `/para` is the competition hub.
- `/para/poker` is the existing league homepage.
- `/para/poker/sessions` and `/para/poker/sessions/[sessionId]` show session coverage.
- `/para/poker/players` and `/para/poker/players/[playerId]` show player dossiers.
- `/para/poker/standings`, `/para/poker/moments`, and `/para/poker/articles` retain the league archive.
- Old public league paths redirect with 307 during review, preserving descendants
  and query strings. The original league domain's root needs a separate cutover decision.
- `/music` and `/library` remain placeholders.
- `/login`, `/auth/callback`, `/profile` and `/profile/claim` implement consumer
  authentication, minimal onboarding, owner editing and reviewed player claims
  behind the disabled consumer flag. Public `/profile/[handle]` pages expose only
  public presentation and an explicitly enabled Poker summary; private/unknown
  handles return 404.
- `/admin/player-claims` uses the existing operator boundary for manual claim
  decisions. Claims and their private evidence have no automatic expiration.
- `/admin` remains the authenticated Para Poker newsroom and league ops entry;
  it is not a universal EGGS administrator surface.
- `/admin/sessions/[sessionId]` is the main recap generation/edit/publish desk.
- `/admin/newsroom/dataset` is an optional future review tool for passively
  captured generation examples. It is not part of everyday recap publishing.
- `/admin/imports` previews and commits strict EGGS completed-session JSON or legacy raw-hand evidence.

League views, components, repositories and import/stat utilities live under
`src/modules/para-poker`. `src/app/para/poker` contains thin route adapters.
Operator pages and APIs use `(para-poker)` source route groups, which keep the
current URLs intact. The shared `src/lib/eggs` contains request-scoped consumer
authentication and access; it does not depend on the league service repository.
Existing admin and API addresses, SQL files, and local newsroom settings remain
stable. League route adapters render dynamically so unavailable configuration
is not cached into the public archive. Original view/data behavior is retained.

## Verification

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test
npm.cmd run validate:homepage
npm.cmd run validate:stats
npm.cmd run validate:training
npm.cmd run validate:parapoker-import
```

`npm test` includes all test files and requires a production build for the HTTP
suite. Its default runner explicitly disables the destructive remote test, which
reports a skip. The HTTP suite starts isolated loopback servers,
uses a disposable HTTP fixture for Supabase responses, and checks actual public
rendering, redirects, missing profiles, operator sessions, denied generation
requests across all 50 protected operator API methods and browser credential
boundaries. Consumer tests cover PKCE, refresh/logout, owner access, public
visibility and operator/consumer separation with real SDK HTTP requests.
The HTTP fixtures never write to a real database.
Existing PGlite acceptance tests use disposable in-memory databases. Neither is
proof of deployed schema or live-data parity. The separate destructive database
integration suite remains opt-in and must use a confirmed disposable database.

`npm run test:identity` tests the unapplied consumer migration in a fresh local
PostgreSQL 17 cluster, including RLS and real concurrent claim approval conflicts.
It never accepts a remote database URL. See the [Phase 2 report](docs/eggs-phase2-identity-audit.md#disposable-validation)
for binary setup and the [current consumer report](docs/eggs-consumer-identity-implementation.md#verification)
for expanded RLS, permanent handles, persistent evidence and concurrency coverage.
Missing local binaries produce an explicit
skip; migration review requires a run that actually executes the database tests.

## Data And Newsroom Flow

League data access is server-side only through `src/modules/para-poker/lib/supabase.js`. Do not import
that client into browser components or expose `SUPABASE_SERVICE_ROLE_KEY` to the
browser.

The normal editorial workflow is intentionally simple:

1. Generate recap.
2. Edit recap.
3. Save recap.
4. Publish recap.

The authoritative EGGS import contract and migration order are documented in
`docs/eggs-completed-session-import.md`.

The Supabase Auth operator boundary, role model, and complete privileged-route
inventory are documented in `docs/admin-operator-authorization.md`.

Training-data capture is passive. Generation stores the exact context packet and
untouched model output in `recap_training_examples`. Publishing copies the final
edited output into `approved_output` and marks the capture row
`ready_for_review`. Publishing never automatically includes an example in a
dataset or assigns a split.

## Supabase SQL Setup

The following is inherited league setup documentation, not a step in the EGGS
shell migration. Phase 1 changes no SQL and applies no database changes.

Run SQL from the Supabase SQL Editor or another trusted SQL client. After schema
changes, the migration files call `select pg_notify('pgrst', 'reload schema');`
so PostgREST refreshes its schema cache.

### Fresh Supabase Database

Run:

```sql
-- 1. Create passive capture table, immutability trigger, and indexes.
-- Paste and run:
-- sql/20260712_recap_training_capture.sql

-- 2. Optional but safe: run the passive compatibility patch too.
-- Paste and run:
-- sql/20260712_passive_training_capture.sql
```

The first file is enough for a fresh database. Running the passive patch after it
is idempotent and confirms the current passive-review constraints.

### Database Where The First Training Migration Was Already Applied

Run only:

```sql
-- sql/20260712_passive_training_capture.sql
```

That patch converts the earlier active-training shape into passive mode:

- `training_eligible` becomes nullable.
- `dataset_split` becomes nullable.
- `validation` split values are renamed to `development`.
- `capture_status` is added.
- the dataset split constraint is narrowed to `train`, `development`, `test`.
- a unique draft capture index is added only when no duplicate rows already
  exist.

If the patch reports that the unique index was skipped because duplicates exist,
review `recap_training_examples` for duplicate `(draft_table, draft_id)` rows
before adding the unique index manually.

If the app logs a `PGRST205` or schema-cache message for
`recap_training_examples`, the table is not visible to the Supabase Data API yet.
Re-run:

```sql
NOTIFY pgrst, 'reload schema';
```

If it still is not visible, confirm the `public` schema is exposed in Supabase
Project Settings > Data API. The normal newsroom workflow will continue while
passive capture is unavailable.

## Advanced Dataset Export

JSONL export is optional advanced setup and is not required for everyday newsroom
use. To enable it, set:

```env
NEWSROOM_DATASET_EXPORT_TOKEN=your-private-token
```

Then call `/api/admin/newsroom/dataset/export?split=train` with:

```http
Authorization: Bearer your-private-token
```

The caller must also have a valid operator session cookie. The export token is a
second control; it does not replace the shared admin authorization boundary.

Only examples explicitly marked `included`, with `approved_output` and an
assigned split, are exported.

## Homepage Presentation Settings

The public homepage presentation is controlled by a limited, code-approved
settings contract. Operators can choose module visibility, ordering, approved
variants, source mode, featured public content, section titles/deks, item limits,
and section-header visibility. The app does not expose raw CSS, arbitrary HTML,
Tailwind classes, color pickers, spacing controls, or freeform layout editing.

For local staging, homepage settings are stored in:

```text
newsroom-library/settings/homepage.json
```

All persistence must stay behind:

```text
src/modules/para-poker/lib/newsroom/homepageSettings.js
```

Components and view models should call the read/write settings helpers rather
than touching the filesystem directly. This keeps the settings contract
storage-agnostic.

Production should move homepage settings to Supabase or another durable store.
That migration should only replace the internals of the settings repository; it
should not require rewriting the public homepage renderer or admin form.

## Upcoming Event Drafts

Future event cards are staged through `/admin/events` and can be surfaced by the
homepage `upcoming_events` module. This is a placeholder newsroom workflow for
tables that will later come from the game site.

For local staging, event drafts are stored in:

```text
newsroom-library/settings/upcoming-events.json
```

All persistence must stay behind:

```text
src/modules/para-poker/lib/newsroom/upcomingEvents.js
```

When the game-site schedule feed is ready, replace the internals of that
repository without changing the homepage module or admin presentation contract.

## Raw Hand-History CSV Imports

The active import lane lives at:

```text
/admin/imports
```

Use it to upload a raw hand-history CSV, preview parsed sessions/hands/actions,
and commit the result to Supabase as live evidence. Public pages and newsroom
generation then read the imported rows through the existing session, player,
moment, and hand-history view models.

The CSV importer can accept either:

- a raw line column such as `raw_entry`, `raw`, `line`, `log_entry`, or `entry`
- normalized columns such as `hand_no`, `player_name`, `action`, `amount`,
  `street`, `board`, and explicit order fields

The admin flow is:

1. Upload a CSV or paste fallback PokerNow-style hand history.
2. Preview parsed hands, actions, players, and notable-hand candidates.
3. Confirm the session code, season, date, table name, and replace behavior.
4. Commit explicitly. The commit writes `sessions`, `players`, `hands`,
   `actions`, `notable_hands`, and basic `player_session_stats`.
5. Public pages then show the story layer plus the imported evidence layer.

The older completed-session JSON package route is no longer part of the active
admin workflow. Keep historical SQL migrations in place, but new operational
imports should use the CSV-first control room.
