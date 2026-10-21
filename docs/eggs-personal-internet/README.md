# EGGS Personal Internet — review packet

Implementation branch: `codex/eggs-personal-internet`.
Pinned dependency: [PR #4](https://github.com/simply0307/para-poker-site/pull/4), commit `b6dc351e37264f70bf825e14cdd2263d1f527c26`.
Draft PR base: `codex/eggs-shell`. Its full diff includes the unmerged PR #4 dependency.

This packet covers local implementation and local verification. No hosted database,
Auth configuration, production game, deployment, merge, or paid resource was changed.
All three feature flags remain false in the checked-in environment example.

## Delivered behavior

| Area | Implemented | Deliberately outside this change |
| --- | --- | --- |
| Studio | Carton Classic and After Hours; browser-persisted studio preference; compact real-data bulletin | Music, synthetic activity, spotlight feeds |
| Discovery | Published project pages; game/league directory and canonical redirects; published works library | Gauntlet/Reath persistence migrations |
| Rooms | Independent saved theme, 6 wallpapers, 4 covers, 12 selectable stamps, 4 avatars, accents | Uploads, remote image URLs, custom CSS/HTML |
| Editing | Identity, five favorites, affiliation, pin/note, 8 ordered mixed selections, module order/visibility; preview, atomic Save, Discard, visual reset | Handle changes, automatic identity matching |
| Publication | Editor drafts, saved previews, publisher publication/archive, source permissions, immutable audit | General media ingestion or arbitrary asset approval |
| Privacy | Anonymous database projection; owner-only editing; direct-read grant closure; hidden values omitted before serialization | Production enablement |
| Poker | Existing claims, consent, results, evidence, operator mapping and generation guards retained | New claims policy, retention, new game behavior |

The work catalog starts empty in the migration. Local tests deliberately create and
publish fixture works through the actual editorial SQL/API/UI. Production works must
go through the same draft → saved preview → explicit publisher action. No fixture
user, publisher membership, work publication, or personal room is seeded by this migration.

## Schema and exact migration changes

The only new candidate is
[20261016080147_eggs_personal_internet.sql](../../supabase/migrations/20261016080147_eggs_personal_internet.sql).
[The exact additive diff](migration.diff) contains the complete new candidate.
The two predecessor files are untouched, including their working-file bytes.

| Predecessor | SHA-256 captured before and after implementation | Git blob |
| --- | --- | --- |
| Identity: 20260922231308 | `01602fc25c95d4c03480379d6f0b6c7ab6e2ab7d58887b38fe5a9de8f83ea561` | `987df848ce0412a4ad7ad54b08843e2a8a50afde` |
| Hub: 20261016030028 | `4631d41abafe53ec5b4b2e612ce6271ff82a53a4320341c3599be924919c3ec4` | `a3ec7dfc981b1a2c88b4ce08ca38ee9e31648d9d` |

Working-file hashes describe this isolated checkout; Git blob IDs also establish
identity with the pinned dependency regardless of another checkout's line endings.

New objects:
- Private `eggs_rooms_private` schema: asset provenance registry, rooms, ordered
  selections, work audit, validation/read/write helpers.
- Public `eggs_work_drafts` (editor-only) and `eggs_works` (published snapshots).
- Public SECURITY INVOKER RPCs: `get_my_eggs_room()`,
  `get_public_eggs_room(p_handle)`, `save_my_eggs_room(p_revision,p_value)`,
  `save_eggs_work(...)`, and `eggs_work_audit(p_id)`.
- RLS is enabled and forced on every new table. Explicit revocations precede grants.
  Private helpers have fixed empty search paths, no default PUBLIC execution, and
  authorize the exact owner/editor action or construct only public output.
- Indexed work-audit and selection foreign keys support deletion and audit reads.

Intentional changes to existing EGGS interfaces:
- Revoke raw SELECT(bio) from anon/authenticated. The compatibility public view now
  calls a visibility-aware public-bio helper; hidden bio is SQL NULL there.
- Remove the public expression policy and anon SELECT. Authenticated direct reads
  remain owner-only. Revoke direct expression writes and its legacy save RPC.
- Revoke direct profile updates. Preserve minimal profile inserts for onboarding,
  profile deletion, immutable/permanently reserved handles, and a live owner read RPC.
- The profile API no longer requests raw bio in INSERT/PATCH return clauses.
- The compatibility public profile reader excludes expression entirely. With rooms
  enabled, both public API and SSR use the same anonymous room projection.
- Existing archived favorites/pins can be retained during an owner save, while new
  unavailable selections are rejected.

No Poker table, evidence record, operator mapping, generation endpoint, or Gemini
gateway implementation is modified.

## API and privacy contract

| Route | Authentication / behavior |
| --- | --- |
| GET `/api/eggs/room` | Confirmed live owner session; complete owner editing projection |
| PUT `/api/eggs/room` | Same-origin + live owner; complete editor value and expected revision; atomic transaction |
| GET `/api/eggs/rooms/[handle]` | Anonymous client only; public projection or 404; no shared response caching |
| POST `/api/eggs/hub/works` | Same-origin + live editor membership; publisher required for publish/archive |
| `/profile/edit` | Live owner; redirects to onboarding when no profile exists |
| `/eggs-admin/works` | Existing independent editor/publisher authority; never Poker operator authority |
| `/library/[slug]` | Published work only; draft/archived/unknown slugs unavailable |
| `/games/[slug]` | 308 to the published game/league's canonical project URL |

A room save accepts `{revision,value}`. Value contains:
`profile` (display_name, bio, visibility), `expression` (existing favorites,
affiliation, pin/note/accent), `appearance` (registered IDs/stamps),
`module_visibility`, `module_order`, and `showcase` (ordered type/id pairs).
It contains no owner ID, handle change, or Poker association/consent.
The server obtains ownership from the verified session; the database rechecks it.

The first revision is 0. Successful saves increment once. Owner-row locking also
serializes the first insert. Stale saves raise SQLSTATE PT409, producing HTTP 409
through real PostgREST and the application. Errors roll back all fields/selections.

The public projection contains only identity, appearance, module order, and permitted
module data. Hidden module keys/values are absent, not fetched and then filtered in
the application. Published-target joins omit archived targets and their assets.
Owner output retains those IDs with `unavailable:true` for replacement.
Overall private profiles return no public row. Metadata is generic.

The public compatibility view has a fixed bio column, so it masks hidden bio to NULL;
it does not expose the stored value. Raw bio selection is denied even to an authenticated
owner; owners use the checked owner RPC. This is deliberate column-level enforcement.

Poker summary consent is a separate existing write path and is never reset by room
Save/Discard/Reset. Account deletion cascades rooms/selections, detaches live player
links, and preserves reviewed claims, editorial audits, permanent handles and league history.

## Local evidence and reproduction

See [verification.json](verification.json), [browser results](screenshots/browser-results.json),
the [full test output](test-results.txt), [build output](build-results.txt),
and [the provenance inventory](provenance.json). Screenshots include both themes on
home/profile at 320, 390, 768, 1024 and 1440 pixels, plus editor views.

- **Real:** disposable PostgreSQL 17, SQL roles/grants/RLS, row-lock races, rollback,
  PostgREST 16.4 HTTP, built Next application, Edge browser interactions and screenshots.
- **Simulated:** Supabase Auth issuer, synthetic users/tokens/email/passwords. Tokens
  are re-signed for real PostgREST; active-session rows are maintained in disposable Auth tables.
- **Not performed:** hosted Auth, email delivery, remote schema changes, production AI
  requests or production rollout. Existing gateway/guard tests use local fixtures.

PostgREST download: official `v16.4`, `postgrest-v16.4-windows-x86-64.zip`.
SHA-256: `29a5b56e5a09b7168bb552ef14aa7ade40bf0a81dd0687cffa86610187b89d78`.
Executable SHA-256: `c4155000dfb0befb59215b65d61a621bbaea1515f36a6e758fc504c7ca0dcbee`.
Extract to `.reference/postgrest-16.4`, or set `EGGS_TEST_POSTGREST_BIN` to its executable.
Use the existing native PG17 tools via `EGGS_TEST_POSTGRES_BIN`.
No helper accepts a hosted database URL.

Run `npm ci`, `npm run build`, `npm test`, `npm run lint`, and the four existing
`validate:*` commands. Run `node scripts/check-eggs-rooms-browser.mjs` with Edge
installed for the recorded browser flow. `node scripts/preview-eggs-rooms.mjs`
starts an independent loopback preview on 3114 with disposable data; type `stop`
to clean up. Existing preview 3113 is not changed.
Preview-only sign-ins: `alice@fixture.invalid`, `editor@fixture.invalid`, or
`publisher@fixture.invalid`, all using `fixture-password`. These are synthetic local
fixtures, not staging or production credentials. Alice's room is `/profile/local_alice`.

Optional `scripts/audit-eggs-rooms-local.mjs` accepts only a generated loopback
database and a local CLI path (`EGGS_TEST_SUPABASE_CLI`). The CLI's generic
“Connecting to remote database” wording refers to its explicit-db-url mode; the
script verifies 127.0.0.1 and hub_test before invoking it.

Explicit failure injection immediately before migration COMMIT verifies transaction
rollback restores the old view, grants, catalog data and legacy schema. Operational
rollback is separately tested by restarting with rooms/Hub disabled: stored revisions
and hidden fields remain protected. With rooms on and Hub editing off, catalog reads
still use published database rows; archived projects cannot reappear from static seeds.
The `/profile/edit` page also has an expired-cookie refresh and Set-Cookie persistence test.

## Release gates and rollback boundary

This PR does **not** authorize release. The future sequence is:

1. Choose the canonical EGGS origin and SMTP sender; review production Auth callbacks,
   credential recovery, leaked-password protection and unnecessary `rls_auto_enable()`
   grants. Obtain explicit migration/deployment authorization and a verified backup.
2. Keep consumer writes and all new feature flags disabled during the schema transition.
   Approve and apply identity → Hub → Personal Internet candidates in timestamp order.
   The third candidate changes EGGS grants; an older consumer writer is incompatible.
3. Deploy the reviewed compatible shell with consumer/Hub/rooms flags still disabled.
   Verify existing real Para data, imports, public dossiers, newsroom, operator auth,
   all seven generation guards and the unchanged Gemini gateway under `/para/poker`.
4. Grant the separately approved publisher UUID. Complete hosted isolation/Auth tests
   with the reviewed application, then enable Hub/rooms and consumer access only under
   explicit launch authorization. Publish works through saved previews.
5. Before migration COMMIT, a transactional rollback restores the prior local schema;
   this is tested. After COMMIT/room use, disable consumer and rooms (and Hub expression
   editing) and keep the privacy grants/projections. Roll back application code only
   to a compatible reader or the Poker-only baseline. Never restore permissive raw
   bio/expression grants or drop owner data to make an old reader work.

Residual risks:
- Hosted confirmation/PKCE/SMTP, real-world Auth security settings, and production
  acceptance remain launch gates; local simulated Auth is not evidence for them.
- The existing development-only ESLint → fast-glob → micromatch → braces advisory
  GHSA-vfj7-8cjw-p6xm remains. The production dependency audit has no vulnerabilities.
  No unrelated framework downgrade was made to suppress that development finding.
- Asset registration is intentionally code/database governed. The archive is not a
  rights-cleared media source. No archive art or “Eternal Galaxy” logo is published.
- Feature-off rollback intentionally loses public expression rendering and editing;
  stored selections/privacy stay intact. Turning a flag off never widens database grants.
