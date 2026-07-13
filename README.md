# Para-Poker Site

Next.js app for the Para-Poker League public site and admin newsroom. Supabase
stores league data, newsroom drafts, published text, hand history, and passive
generation-capture records on the server side.

## Development

On Windows PowerShell, run:

```powershell
npm.cmd run dev
```

Then open http://localhost:3000.

## Routes

- `/` is the public league homepage.
- `/sessions` and `/sessions/[sessionId]` show public session coverage.
- `/players` and `/players/[playerId]` show public player pages.
- `/standings`, `/moments`, and `/articles` are public archive/newsroom surfaces.
- `/admin` is the admin newsroom and league ops entry.
- `/admin/sessions/[sessionId]` is the main recap generation/edit/publish desk.
- `/admin/newsroom/dataset` is an optional future review tool for passively
  captured generation examples. It is not part of everyday recap publishing.

## Data And Newsroom Flow

Supabase access is server-side only through `src/lib/supabase.js`. Do not import
that client into browser components or expose `SUPABASE_SERVICE_ROLE_KEY` to the
browser.

The normal editorial workflow is intentionally simple:

1. Generate recap.
2. Edit recap.
3. Save recap.
4. Publish recap.

Training-data capture is passive. Generation stores the exact context packet and
untouched model output in `recap_training_examples`. Publishing copies the final
edited output into `approved_output` and marks the capture row
`ready_for_review`. Publishing never automatically includes an example in a
dataset or assigns a split.

## Supabase SQL Setup

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
src/lib/newsroom/homepageSettings.js
```

Components and view models should call the read/write settings helpers rather
than touching the filesystem directly. This keeps the settings contract
storage-agnostic.

Production should move homepage settings to Supabase or another durable store.
That migration should only replace the internals of the settings repository; it
should not require rewriting the public homepage renderer or admin form.
