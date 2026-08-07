# Raw-hand evidence import PR 1

`sql/20260805213435_raw_hand_evidence_revisions.sql` is the authoritative migration. The disposable database test reads that file directly; there is no Supabase migration mirror to drift.

## Deployment order

1. Compare the target schema with the assumptions below using read-only inspection.
2. Configure an explicitly disposable Supabase project and run `npm run test:imports:integration`.
3. Run Supabase security and performance advisors against that disposable project.
4. Run the complete application validation gate.
5. If `public.game_session_imports` is absent, apply `sql/20260713_game_session_imports.sql` first without modifying it.
6. Apply the authoritative `sql/20260805213435_raw_hand_evidence_revisions.sql` migration.
7. Verify that `create_raw_hand_import_preview` and `commit_raw_hand_session_import` are executable by `service_role` only.
8. Reload the Data API schema, deploy the application, and exercise a non-production preview/commit.

Do not apply `tests/database/raw-hand-import-core-schema.sql` anywhere except a disposable integration-test database. It drops/recreates no objects itself, but the test harness resets the disposable project's `public` schema before applying it.

## Deployed-schema assumptions

Core table creation migrations are not present in this repository. The authoritative migration fails before changing application code dependencies when a required table or required column is absent. Read-only inspection of the connected target on 2026-08-07 confirmed the required legacy poker tables and columns, found no `game_session_imports` table, and found no entries in Supabase migration history. The remaining contract is:

- `sessions` has UUID `id`, unique session code semantics, season/session numbering, played timestamp, table/format/status, and raw/hands/player counts.
- `players` has UUID `id`, `display_name`, `pokernow_name`, and a unique-compatible `slug`.
- `hands`, `actions`, `notable_hands`, and `player_session_stats` have the columns written by `rawHandImportRepository.js`, `20260713_game_session_imports.sql`, and the stat calculators.
- `session_results` is keyed to sessions and exposes `approved`.
- `standings` and `player_season_stats` expose `season_code`. Identifier types are deliberately not assumed: the inspected schema mixes UUID and bigint identifiers.
- `recap_drafts` has session scope/source, visibility, generation/publication fields; `published_articles` has `draft_id`, publication, and unpublication fields.
- Supabase roles `anon`, `authenticated`, and `service_role` exist.
- `pgcrypto` is installed and available through the `extensions` schema on the inspected target.

Optional normalized pot/stat columns are added defensively before the new RPC is compiled. Existing evidence remains nullable and is labeled `legacy_unversioned` through the session pointer/review state.
The migration explicitly grants the invoker RPC's required table and sequence privileges to `service_role`; it revokes direct ledger/revision access and RPC execution from `PUBLIC`, `anon`, and `authenticated`.

## Canonical artifact and checksum contract

The server accepts an exact `Uint8Array`, decodes UTF-8 with a fatal decoder (allowing one BOM for parsing), parses once, and emits `raw-hand-manifest-v1` with parser `raw-hand-csv-v1`. Recursive object keys are sorted; array order is preserved; canonical artifacts contain no generated database IDs or wall-clock timestamps.

- `sourceChecksum = SHA256(exact source bytes)`
- `metadataChecksum = SHA256(UTF8(canonical metadata))`
- `manifestChecksum = SHA256(UTF8(canonical manifest))`
- `validationReportChecksum = SHA256(UTF8(canonical validation report))`
- `previewChecksum = SHA256(UTF8("raw-hand-preview-v1\n" + sourceChecksum + "\n" + metadataChecksum + "\n" + parserVersion + "\n" + manifestChecksum + "\n" + validationReportChecksum + "\n" + targetSessionId + ":" + expectedRevisionId))`

PostgreSQL recomputes every checksum. The preview ledger and evidence-revision triggers prevent later mutation of source/artifact fields.

## Replacement aggregate fallback

PR 1 does not introduce PR 3's official-result revision model. On replacement, the atomic RPC removes the target session's official results, sets `result_review_status = 'awaiting_result_review'`, and removes standings/season aggregates for both the old and new season codes plus career aggregates. This is the narrow safe fallback: no superseded result contribution remains public, but aggregate surfaces can be temporarily unavailable until results are approved and the existing deterministic recalculation path runs.

## Disposable integration environment

The database suite requires all of:

- `SUPABASE_TEST_URL`
- `SUPABASE_TEST_SERVICE_ROLE_KEY`
- `SUPABASE_TEST_DATABASE_URL`
- `SUPABASE_TEST_PROJECT_REF`
- `ALLOW_DESTRUCTIVE_IMPORT_INTEGRATION_TESTS=true`

The project reference must contain `test`, or `SUPABASE_TEST_CONFIRMED_DISPOSABLE=true` must also be set. The harness refuses a URL/reference matching `.env.local`.

## Intentionally deferred

Operator authentication/authorization, official-result revisioning, full season/career rebuild orchestration, multi-entity draft dependency graphs, general article lineage, and reconciliation reporting remain PR 2–5 work.
