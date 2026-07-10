# Native v2 Implementation Brief

## Objective

Continue the native Para Poker v2 product by making navigation and recap UX feel public-facing, editorial, and easy to move through while preserving the existing backend flow and Plasmic fallback.

## Do Not Do

- Do not edit Plasmic generated files.
- Do not remove the Plasmic route.
- Do not invent a new backend architecture unless a real gap is found.
- Do not expose source UUIDs or raw hand IDs in public UI.
- Do not turn player profiles into archive/debug dumps.
- Do not call an AI API yet unless an existing approved API path is already present.

## Primary Coding Tasks

1. Navigation
   - Audit all native/public links.
   - Remove public links to legacy/Plasmic pages.
   - Ensure primary navigation targets native v2 routes.
   - Add a clean session/profile breadcrumb pattern.
   - Make mobile nav compact and overflow-safe.

2. Player Dossier
   - Keep `/players-v2/[slug]` as a profile dossier.
   - Prioritize Player Season Story, Recent Form, Featured Moment, Top Moments preview, and session CTAs.
   - Keep full archive/moment depth linked out.
   - Hide public debug/source/generation metadata.

3. Session Recap
   - Treat `/sessions-v2/[sessionId]` as the main longform recap.
   - Improve hierarchy around headline, dek, short recap, long body, highlights, participants, moments, and standings impact.
   - Link participants back to player profiles.
   - Hide evidence behind "Hand details" or "Source facts" disclosure.

4. Recap Artifact Model
   - Keep or refine the existing `RecapArtifact` shape:
     - scope
     - status
     - headline
     - dek
     - short_summary
     - long_body
     - key_takeaways
     - source_fact_ids/source_hand_ids
     - tone
     - visibility
     - created_at/updated_at
   - Public components should render editorial fields first.
   - Internal/admin components may render source/review fields.

5. Generation Boundary
   - Keep deterministic fact builders.
   - Maintain prompt/input builders:
     - `buildMomentRecapInput()`
     - `buildSessionRecapInput()`
     - `buildPlayerRecapInput()`
   - Use placeholders only when derived from available facts.
   - Shape fallback copy like public recap copy, not debug copy.

6. Future Route Preparation
   - Plan for `/standings-v2`.
   - Plan for `/sessions-v2` index.
   - Plan for `/moments-v2`.
   - Plan for `/archive-v2`.
   - Do not block current routes on these future pages.

## Suggested Component Direction

- `NativeArchiveNav`
- `PlayerProfilePage`
- `PlayerHero`
- `PlayerSeasonStory`
- `RecentFormPanel`
- `FeaturedMomentPanel`
- `TopMomentsPreview`
- `SessionRecapPage`
- `RecapHero`
- `RecapPanel`
- `MomentRecapCard`
- `SessionParticipantList`
- `HandDetailsDisclosure`
- `ArchiveCTA`

## Data Flow To Preserve

- `getPlayerProfileData()`
- `getSessionRecapData()`
- existing Supabase client/adapters
- existing deterministic source fact helpers
- existing native route compatibility

## Public Copy Standard

Use the voice guide in `04-recap-voice-guide.md`.

Every new public recap component should answer:

- What happened?
- Why does it matter?
- Which player gets credited?
- Where can the visitor go next?

## Verification

Run:

- `npm run lint`
- `npm run build`

Smoke test:

- `/players-v2/para-poker-at-mt1ejg0x7`
- `/sessions-v2/S0-001`
- `/plasmic-profile/para-poker-at-mt1ejg0x7`

Confirm:

- no Plasmic generated files touched
- no public UUID/source ID leakage
- no invented game facts
- mobile pages have no horizontal overflow

