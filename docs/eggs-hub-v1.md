# EGGS Hub v1 — implementation and review

October 15, 2026 (America/New_York). Isolated branch `codex/eggs-hub-v1`, based on integration `f64e486`. Target: `codex/eggs-shell` / PR #2. Production `main` remains `629e5b4`.

## Scope and authority

The current user brief explicitly authorizes this repository, integration base, new worktree, local implementation/testing, commit and draft PR. It supersedes the earlier no-profile-expression scope. It does not authorize merge, deploy, remote migration, production Auth changes, spending, or live game changes.

The local registry describes an older autonomous Para League pipeline and a separately unbound EGGS Center project. This interactive implementation follows the user's exact repository/branch/task rather than claiming an Agent Queue dispatch or changing either registry. No Drive governance, canon, rights, project state or artwork approval is changed or asserted. Existing EGGS typography/palette and the repository's Para wordmark are reused. Other projects use text initials, not fabricated official logos or newly generated artwork. Existing Poker artwork and module styling are untouched.

## Implemented versus planned

| Area | Implemented now | Boundary / planned later |
| --- | --- | --- |
| Discovery | Studio homepage, category-filtered directory, stable showcase slugs, status, participation and publication links, featured/order controls, desktop/mobile navigation | Four confirmed existing projects only; no invented releases or new game capabilities |
| Catalog | Durable PostgreSQL drafts, independent published snapshots, immutable audit, editor/publisher roles, preview, publish, archive, revision conflicts | No uploads, arbitrary HTML, media library, rich document editor or editorial role-management UI |
| Profile expression | Five favorites maximum, curated Player/Explorer/Maker/Reader affiliation, one pinned published project, 160-character featured note, four colors, initials avatar, owner preview | No faction canon invented; favorites do not link accounts or verify achievements |
| Privacy | Existing private-by-default identity, owner writes, public visibility inheritance, archived-project suppression, narrow grants/RLS | No social feed, messaging, comments or unmoderated content uploads |
| Para Poker | Existing module, routes/redirects, claims, summary opt-in, imports/evidence, results, operator auth and seven generation guards preserved | No league-engine rewrite or production verification claimed for this new milestone |
| Para Core | Typed port definitions and explicit Poker ownership boundary | Contract only; no generic league/standings engine implemented |
| Other projects | Official destinations remain external and authoritative | No Gauntlet, Poker-client or Reath service/database/auth migration |

Initial destinations and content provenance are the existing integration portal and its audit: Para Poker `/para/poker`, Gauntlet `https://gauntlet-online.vercel.app`, EGGS Poker `https://eggspoker.netlify.app`, Reath `https://reath-digest.netlify.app`. “Independent destination” is not a release or availability guarantee. Reath remains invitation-only; its internal stories are not imported. Starter catalog copy is proposed code-review content, not new live publication.

## Routes and ownership

| Route | Access / purpose |
| --- | --- |
| `/`, `/projects?category=…` | Anonymous published discovery |
| `/projects/[slug]` | Published showcase only; drafts/archived/unknown slugs 404 |
| `/eggs-admin` | Separate EGGS editorial workspace |
| `/eggs-admin/projects/new`, `/[id]`, `/[id]/preview` | Live authenticated EGGS editor role; publisher required to publish/archive |
| `POST /api/eggs/hub/projects` | Same-origin JSON, strict fields, user-token RPC; database rechecks permission and version |
| `/profile`, `/profile/[handle]` | Existing owner/public identity routes, extended with expression |
| `PUT /api/eggs/expression` | Same-origin confirmed live user; owner resolved in the database |
| `/para/poker/**`, `/admin/**`, existing generation APIs | Existing Para module boundaries; not moved into EGGS admin |

`src/lib/hub/repository.mjs` defines the persistence interface using a publishable-key client carrying the caller's token. It never uses a service key or filesystem writes. Public catalog reads use an anonymous client. Preview uses an independently authorized user client and cannot be made public by guessing an ID.

`EGGS_HUB_ENABLED=false` is the default. This preserves a read-only bootstrap of the four existing public portal entries while the new migration remains unapplied. With the flag true, the database is the sole catalog authority. Empty or failed database queries never fall back to bootstrap data, which would resurrect archived entries. Expression and editorial writes require both the existing consumer Auth configuration and the Hub flag.

## Separate additive migration

New candidate: `supabase/migrations/20261016030028_eggs_hub_catalog_expression.sql` (CLI-generated UTC filename; local date October 15). It must follow the reviewed identity migration. It has never been applied remotely.

The original identity candidate is unchanged, LF SHA-256:
`4413c817e9bd5e0473e093e4c3894c18ffc4f6fcfe8a1a702d7a8ad6a37aa292`.

New objects:

- `public.eggs_project_drafts`: canonical immutable slug, validated draft content, state and revision. Authenticated editors can read; direct writes are denied.
- `public.eggs_projects`: published snapshots only, readable anonymously. No draft text, editor identity or audit is exposed.
- `public.eggs_profile_expression`: profile FK with cascade, bounded favorites/affiliation/pin/note/color. Public SELECT follows the existing profile visibility; owner SELECT/INSERT/UPDATE is limited to authenticated live owners.
- Unexposed `eggs_hub_private`: explicit editorial memberships and immutable audit. All tables enable and force RLS; inherited grants are revoked.
- Public RPC wrappers are SECURITY INVOKER. The few private SECURITY DEFINER helpers have fixed empty search paths, revoked default execution, explicit role/session checks, and no arbitrary SQL.

Catalog writes lock the editorial membership and draft. A caller must supply the saved revision. Publication copies that exact revision into the public table and appends the audit in the same transaction; stale/concurrent writes receive a conflict. Draft edits never affect the existing public snapshot. Archive removes only the public snapshot and records the decision; draft/slug/audit remain. Only an explicitly granted publisher can publish/archive. Consumers, self-asserted metadata and existing Poker operators receive no implicit editorial authority.

The four initial public entries are seeded from existing portal destinations. No real account receives a role in the migration. Deployment requires an independently approved membership bootstrap by Auth UUID, for example:

```sql
-- Separately approved administrative action; substitute a verified existing Auth UUID.
insert into eggs_hub_private.editors(auth_user_id, role)
values ('<verified-auth-uuid>', 'publisher');
```

No application role can grant itself this membership. No legacy `profiles` row changes.

Profile expression has no ownership parameter in its API. The database derives the profile ID from the live user. Favorites/pins must reference published projects when saved; archived choices are suppressed on presentation and can be removed by saving the owner form. Personal notes are escaped text. No HTML interpretation, URL-based avatars, credentials in links, uploads, or achievement claims are added.

Deleting the consumer account cascades expression only through the existing consumer profile. The original migration remains responsible for permanent handles, durable claim evidence/review and detached Poker associations. No retention, timeout or hold machinery is added.

## Local verification

The reproducible production build, full tests, lint and validators run from the isolated worktree. Native PostgreSQL 17 is mandatory for Hub/RLS acceptance; its helper creates a fresh loopback-only cluster and never accepts a remote database URL.

```powershell
$env:EGGS_TEST_POSTGRES_BIN = 'C:\path\to\postgresql-17\bin'
npm ci --ignore-scripts
npm run build
npm test
npm run lint
npm run validate:training
npm run validate:homepage
npm run validate:parapoker-import
npm run validate:stats
node scripts/preview-eggs-hub.mjs
```

The preview uses port 3113, synthetic `@fixture.invalid` users and disposable PostgreSQL. Its Auth and PostgREST transport is simulated; catalog/profile mutations and RLS execute in real PostgreSQL. Type `stop` in its terminal to stop the application and remove the exact disposable database directory. It does not send email, call AI providers, or use hosted credentials.

Local-only preview accounts are `publisher@fixture.invalid`, `editor@fixture.invalid`, `alice@fixture.invalid` and `bob@fixture.invalid`; their synthetic password is `fixture-password`. Run the preview in an interactive terminal. None of these credentials is valid on a hosted EGGS or Poker site.

Automated evidence includes native anonymous/owner/unrelated/editor/publisher/legacy-operator behavior, publication race with observed lock blocking, stale-preview rejection, role/session revocation, audit immutability, content/URL validation, expression privacy, account deletion, rollback and unchanged legacy catalog/grants. Built-app HTTP journeys cover authorization/CSRF, creation → private preview → publication, durable catalog across an application restart, profile expression/visibility, archival and logout. Existing identity tests retain their claim-approval races, canonical handles, deletion and evidence preservation coverage.

Final regression result: **130 tests, 129 passed, 0 failed, 1 skipped**. The skipped legacy raw-hand database integration test requires an explicitly configured disposable Supabase environment; no remote destructive suite was enabled. All new Hub database and HTTP scenarios ran, as did the existing native identity suite, claim/handle races, seven generation guards, Gemini gateway checks, import adapters, dossiers and redirects. The production build, ESLint and all four validators passed.

The first broad run exposed an outdated route-inventory assertion, which now explicitly checks the stronger Hub editor guard while retaining the existing consumer and Poker assertions. A later run exposed local database startup/connection timeouts under load. Test files now run sequentially; individual race tests still use simultaneous PostgreSQL connections. The disposable helper permits a five-second connection timeout and two-minute initialization, and skips only initdb's final disk sync. Normal server fsync and transaction behavior remain enabled. The final complete run used `node --test --test-concurrency=1 tests/*.test.mjs` with native PostgreSQL configured (the same file set/concurrency as `npm test`).

These are new local results, not hosted or production passes. September's hosted identity checks remain historical evidence for PR #2; Hub requires its own approved staging migration/test before launch.

Browser verification used 1280×900 desktop and 390×844 mobile viewports. The anonymous journey reached Gauntlet's existing official destination without operating the game. A synthetic publisher created a draft, reviewed the saved preview, published it and saw the directory update. A synthetic consumer created a private profile, saved favorites/affiliation/pin/note/color on mobile, received a not-found public route while private, changed visibility and saw the correct public card. After sign-out, the public card remained visible and the owner route redirected to login. The consumer was denied editorial access. Mobile navigation and category filtering worked; the public profile had no horizontal overflow. Local screenshots are in ignored `.reference/hub-browser/` (homepage, editor preview, owner form, directory and public profile). The temporary viewport override was reset.

An early browser run encountered the same local harness connection timeouts described above. The final run with the corrected harness completed successfully. No hosted Auth, email/PKCE or production verification was rerun in this milestone.

## Security and separate production gates

Compatible patches update Next and its ESLint config from 16.3.6 to 16.3.8; lockfile updates include patched Sharp and source-map-js. Production dependency audit is clean. The full development audit still reports five high dependency findings in the ESLint → fast-glob → micromatch → braces chain. The [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists no patched release. No framework downgrade, suppressed audit or unreviewed dependency substitution was made.

Before any rollout, separately review:

1. **Migration:** unchanged identity candidate first, then this Hub candidate; current production audit, recoverable checkpoint, new private schema excluded from Data API, exact schema/grant review and explicit authorization. No blind migration push or replacement of existing Poker objects.
2. **Security:** explicit editor/publisher UUID grants, fresh advisors, the previously rehearsed `rls_auto_enable()` grant correction, unresolved leaked-password protection under the $0 rule, and the development-tool advisory.
3. **SMTP/Auth:** canonical EGGS origin still required; exact site/callback URLs; a production sender beyond Resend's own-account-only test sender. No production configuration changed here.
4. **Deployment:** explicit approval and available included Free credits. Deploy consumers/Hub disabled, verify Para data and operator/generation behavior under `/para/poker`, then enable only approved features after isolated hosted Hub acceptance.
5. **Rollback:** pre-commit SQL transaction rollback; after commit disable Hub/consumer flags and preserve published/draft/audit/profile/claim/handle data. Application rollback must retain `629e5b4`'s guards and Gemini gateway. Do not drop durable records to undo a release.

The implementation commit and draft PR title include `[skip netlify]` to suppress branch deployments and PR previews respectively, following [Netlify's documented skip controls](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/). No site configuration or build settings are changed.

## Prioritized follow-up

1. Complete the core identity production gates and run the Hub migration/journeys on an explicitly approved isolated staging target; reconcile any schema drift first.
2. Implement one Para Core adapter increment at a time, starting with season/event identity and result approval. Keep Poker hands, chips, evidence interpretation and scoring inside Poker. Use versioned adapters and explicit operator permissions; do not generalize by renaming Poker tables.
3. Audit Gauntlet's deployed persistence authority, then design separately approved stable-ID account linking. Preserve Gauntlet authentication, guests, progression and matches.
4. Add a bounded EGGS publications model with source ownership and editorial review; keep Reath's ingestor/editorial/AI pipeline independent until a dedicated migration is approved.
5. Introduce curated music with source rights and playback/privacy decisions before profile songs.
6. Consider moderated social features only after consent, privacy, abuse controls and deletion policy are defined. No feed/comments/DM implementation is included now.
