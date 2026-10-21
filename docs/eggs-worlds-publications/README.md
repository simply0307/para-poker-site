# Existing Reath releases, world dossiers and player pages

This extends draft PR #5 from `d416b62584087249fddd47c5a271971917126a6b`. It changes the local EGGS hub and its review candidates only. No deployment, hosted SQL, Auth setting, source-system write, game change or paid infrastructure is authorized or performed.

## What was missing and what changed

The previous Reath reader queried only new Hub work snapshots. It therefore omitted already released material at the **public** [Reath Digest](https://reath-digest.carrd.co/) and [EGGS YouTube channel](https://www.youtube.com/@EternalGalaxyGamingStudio). That was a catalog integration gap; private Drive backing files did not establish that those public releases were unavailable.

The reader now combines a checked-in, source-verified public release index with separately publisher-reviewed Hub snapshots. It never queries private Drive/editorial data at runtime or assigns a fictional Hub publisher to an existing release. Canonical public sources and creator credit remain attached. Normal preview no longer needs fabricated Reath publications to show a reading shelf.

- `/reath-digest` contains **A Natural Choice**, **Moon Bars**, both **Reath in Review** archive editions and the three Reath-specific channel uploads. Search includes the printed article titles, story subjects and aliases.
- **Commissioner Infinitimer** is the printed name in *A Natural Choice*; the user's search spelling **Infatimer** also finds it. **Miro Bloom** is the singer in *Moon Bars*. These are linked to their actual reading copies, not invented standalone publications.
- `/reath-digest/[slug]` displays the original public page images with page navigation, shareable page queries, keyboard controls and fit-width/150%/200%/300%/500% reading sizes. Enlarged pages scroll inside their frame. Full-size images and the original edition remain available through source links.
- `/watch` contains all **eleven** verified public channel uploads, correctly distinguished as Reath, world introductions, Gauntlet or studio videos. `/watch/[id]` creates YouTube's privacy-enhanced iframe only after the visitor chooses Play; no YouTube media, thumbnail or player is requested automatically. The original watch link remains available, and source AI disclosures are preserved.
- Homepage discovery includes the actual source editions. The current EGGS text masthead is retained by the user's explicit choice.

The separately requested *Thirteenth Inkgredient* was not located in the currently linked public material. The user explicitly dropped that item; no placeholder, fabricated work or release blocker was added for it.

## Lore is a separate section

`/lore` leads to world/collection overviews. Each has its own `/lore/[world]` page and five sections: **factions, people, events, terms, places**. Section search and individual `/lore/[world]/[kind]/[slug]` dossiers retain world scope, plain-text body, continuity note, public source and credit. A released comic or character film is not silently promoted into governing canon.

The loopback development preview contains 17 source-grounded reader introductions across Paralleon and the stories within Reath. They cite existing public comics and character/faction films. They are brief reading guides, not replacements for controlling manuscripts. Source spellings and fiction-within-fiction distinctions are preserved.

The audit also located 42 actual working dossiers in the user's existing local lore CSV. They are loaded **only as private, unreviewed drafts in the disposable owner's preview** when its ignored review manifest is present. Their raw text, private source IDs and registry controls are not checked into public application data, returned anonymously, published by the migration or imported into a hosted project. Longer unreviewed source dossiers and public reading introductions use distinct scoped slugs so neither silently overwrites the other.

`/eggs-admin/lore` uses the existing explicit EGGS editor/publisher membership. Editors create and save drafts; only publishers can release or archive a saved revision after source review and public-use permission. Source/canon/release decisions remain distinct. Private saved preview, revision conflicts, editorial history and archived-world suppression are implemented. Archiving a world hides its child reader snapshots while retaining drafts and audit.

## Additive schema and API

The only new candidate in this increment is `supabase/migrations/20261021025603_eggs_lore_dossiers.sql`, generated with the installed Supabase CLI after reading its help. Its SHA-256 is `f1e3b953cd8d7c158370ef3dee8da6e9551c2e2f9d5a82a5370df67c41c3a34c`. The exact patch is [migration.diff](migration.diff). The four existing migration files retain their original worktree bytes and Git blobs; [verification.json](verification.json) records all hashes.

`public.eggs_lore_drafts` holds editor-only source drafts. `public.eggs_lore` holds published snapshots with private source fields removed. `eggs_lore_private` contains privileged helpers and durable audit. Every new table has forced RLS, no raw write grants, explicit execution grants and fixed function search paths. Public functions use invoker security. Mutating and audit definers are private and validate current Auth/editor membership; the narrow anonymous `world_is_public(text)` predicate checks only published-world availability for public RLS. There are no source imports or changes to Poker tables/grants in the candidate.

| Interface | Behavior |
| --- | --- |
| `GET /api/eggs/lore?world=&kind=&slug=` | Anonymous published-only DTO. Strict filter validation; no owner, draft, private source, permission-review or audit data. Uses the same anonymous client/projection as SSR. |
| `POST /api/eggs/hub/lore` | Same-origin, confirmed live-session editor/publisher; strict complete fields and actions `save`, `publish`, `archive`. No caller-selected owner. |
| `save_eggs_lore(...)` | Stable world/kind/slug, saved-preview release, row locks and expected integer revision; stale conflicts return HTTP 409. |
| `eggs_lore_audit(id)` | Live explicit editor/publisher only; publication/review history survives account deletion with nullable actor IDs. |

Text is rendered as text, never arbitrary HTML. Citations accept public HTTPS URLs without credentials, private Drive hosts or token-like query/fragment data. Queries are rejected except the exact canonical YouTube watch form; human anchors are bounded. Internal source records never enter published snapshots. Anonymous lore reads work independently of consumer rollout. `EGGS_LORE_ENABLED=false` is an independent default and is not a privacy boundary.

Lore bodies allow 20,000 characters. Only its guarded save route opts into a 96 KiB streaming JSON limit; all pre-existing consumer routes retain their 8 KiB default. Overflow is cancelled before parsing. No arbitrary upload, iframe, script, CSS, remote user image or automatic source synchronization was added.

## Player-page infrastructure

The existing reviewed identity/rooms candidates already provide permanent canonical handles, Auth-derived owner identity, atomic saves/revisions, curated appearance registries, separate favorites/showcase, public/private projections, discovery and independent Poker consent. No replacement account schema is needed.

This increment fixes stale owner-only edit controls after logout/revocation or account changes, and changes public visibility copy to acknowledge People/community discovery. Fresh signup fixtures now provision the matching disposable Auth row once; deleted identities are never resurrected by token reuse.

The actual local UI has been exercised from new signup through same-browser PKCE confirmation, private profile creation, room save/reload, public opt-in with hidden fields, discovery/community participation, privacy opt-out, re-login, cross-tab logout and revoked-session controls. PostgreSQL, PostgREST and built Next are real; **Auth issuance and email confirmation are explicitly synthetic**. Hosted SMTP, genuine email delivery and production Auth configuration are not established by these tests.

Manual local signup now has a clearly labelled confirmation inbox and sample login. It can appear only when the local launcher explicitly opts in and **app, Auth server and inbox are all HTTP loopback origins**, with the inbox on the same Auth origin. Hosted URLs and private credentials are rejected. The synthetic inbox escapes content, uses a restrictive CSP, shows only the newest pending synthetic confirmation and refuses hosted callback destinations. No deployment environment variable enables this, no real mail is sent, and the page warns that local accounts/pages reset with the disposable preview.

## Evidence and remaining release boundary

[verification.json](verification.json) and the accompanying test/build/lint/validator output record actual results. Browser packets distinguish public-source reading evidence from synthetic account/editor evidence. Screenshots cover both themes at 320/390/768/1024/1440 pixels, including zoom overflow, headings, labels, focus, 44px controls and reduced motion. The existing identity, handle/claim concurrency, deletion, room privacy, Poker imports, seven generation guards and Gemini gateway suites remain required regressions.

The official Windows PostgREST 16.4 binary and native PostgreSQL 17.6 are reused from the earlier verified local toolchain. No Docker, new project, database subscription or hosted branch was provisioned. Security advisors ran on an independent disposable loopback cluster; performance advisors identify only the existing Para duplicate indexes, which are preserved.

Reproduce using the existing `EGGS_TEST_POSTGRES_BIN` and `EGGS_TEST_POSTGREST_BIN`: build, `npm test`, ESLint, all four repository validators, then `check-eggs-account-browser.mjs`, `check-eggs-lore-browser.mjs` and `check-eggs-reath-browser.mjs`. `preview-eggs-worlds.mjs` starts loopback port 3114; `stop` cleans up that disposable environment. The optional ignored `.reference/lore-source-review.json` is never read by production application routes.

Production remains unchanged and consumer rollout remains disabled. Future release still requires canonical EGGS origin/SMTP/Auth/security decisions, a current production schema/grants audit, explicit ordered identity → Hub → rooms → community → lore migration approval, publisher membership, isolated hosted verification and explicit deployment authorization. Private lore drafts require source/canon corrections and deliberate publication review. Operational rollback disables the new availability gates while retaining restrictive grants, data and audit; it does not restore permissive legacy bio/expression access or drop live-user data.

Residual limits: original Carrd reading images and YouTube availability depend on those existing public hosts; no byte backup or automatic feed sync is created. Printed pages have source overview text but no invented full transcription. Video autoplay/availability depends on YouTube's current policies; the original watch link is the fallback. Local fixtures cannot prove hosted email delivery or production sessions. Existing development-tool dependency advisories remain documented; dependency and lockfiles are unchanged.
