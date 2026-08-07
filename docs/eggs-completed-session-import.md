# EGGS completed-session evidence import

The admin import control room accepts `para-completed-session-v2` JSON directly from durable EGGS authority. This is a second ingress into the existing immutable evidence ledger and evidence-revision transaction, not a second evidence architecture.

The direct adapter in `src/lib/imports/eggsSessionPackageArtifact.js` validates the strict producer-owned schema, canonical schema checksum, package checksum, event ordering, hand/action/settlement references, and public-only visibility. It does not import or call the legacy raw-hand parser. Display names are presentation fields only: every EGGS `sourcePlayerId` must map explicitly to an existing league player UUID, either through a package identity using `para-poker-league-player-id` or through the operator mapping controls.

The workflow is:

1. Upload the exact JSON package on `/admin/imports`.
2. Resolve every source participant to an existing league player UUID.
3. Create an immutable preview. The trusted server stores exact bytes and canonical metadata, manifest, validation report, and checksums.
4. Review the preview and explicitly commit it.
5. `commit_eggs_session_import` atomically creates or replaces one evidence revision and materializes the session, hands, actions, notable candidates, player-session statistics, and unapproved session-result rows.

Exact retry of a committed preview returns its prior commit report. A different revision of the same league session requires an explicit replacement preview and the expected current revision ID. Any write or count failure rolls the materialization back and leaves the current evidence revision unchanged.

The source package remains authoritative evidence. Imported results are always `awaiting_result_review`; this lane has no manual result-entry controls and does not approve league standings. Public events and faction metadata remain in the immutable manifest/source bytes. Seat-private events are forbidden by the contract and are never materialized.

Apply database files in repository order, ending with:

```text
sql/20260805213435_raw_hand_evidence_revisions.sql
sql/20260807_eggs_completed_session_v2.sql
```

Both RPCs are security-invoker, revoked from `public`, `anon`, and `authenticated`, and executable only by the trusted `service_role`. The browser calls same-origin admin routes and never receives the Supabase service-role key.

Verification:

```powershell
npm run test:imports:pure
npm run test:imports:acceptance
npm run test:imports:integration
npm run lint
npm run build
```

The database suite is destructive and skips unless all disposable-test variables and `ALLOW_DESTRUCTIVE_IMPORT_INTEGRATION_TESTS=true` are present. It refuses the application Supabase URL.
