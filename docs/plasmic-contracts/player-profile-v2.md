# Player Profile Template V2 Contract

## Plasmic component

The required Plasmic component name is:

`PlayerProfileTemplate`

Next.js fetches this component with `PLASMIC.maybeFetchComponentData()` and renders it through `PlasmicProfileClient`. Plasmic owns the visual layout. Next.js owns data fetching, normalization, and simple props/slot content.

## Data flow

`src/lib/playerProfileData.js` exports:

`getPlayerProfileData(slug, seasonCode = "S0")`

The route `/plasmic-profile/[slug]` passes one normalized `profileData` object into `PlasmicProfileClient`.

## Current working Plasmic layer names

These are the current live bindings and must keep working:

- `playerNameText`: player display name.
- `playerLabelsText`: public primary and secondary labels.
- `bioText`: player bio or generated fallback copy.
- `rankText`: current season standings rank, formatted like `#1`.
- `pointsText`: current season points.
- `handsText`: current season tracked hands.
- `biggestPotText`: current season biggest tracked pot won.
- `avatarSlot`: avatar image or initial fallback.

## Future-safe slot names

These optional slots are supported by the client. If a slot does not exist in Plasmic yet, it is not passed, so the current profile keeps rendering.

- `statTilesSlot`: legacy V2 core stat cards.
- `pokerStatsSlot`: legacy V2 poker stat cards.
- `positionStatsSlot`: legacy V2 position stat cards.
- `notableHandsSlot`: legacy V2 notable hand cards.
- `sessionHistorySlot`: recent session rows.
- `badgeShelfSlot`: badge shelf placeholders.
- `featuredDisplaySlot`: player-selected featured stat, badge, achievement, moment, or display item.
- `publicHudSlot`: free public HUD stats.
- `styleProfileSlot`: visual identity metadata such as label pairing, theme, banner, and equipped badges.
- `achievementsSlot`: public achievement placeholders.
- `momentsSlot`: public moment placeholders.
- `lockedSectionsSlot`: cards for future locked product areas.
- `advancedHudSlot`: future advanced HUD placeholder.
- `poolComparisonsSlot`: future pool comparison placeholder.
- `coachingSignalsSlot`: future coaching signal placeholder.
- `archivedSeasonsSlot`: future archived season placeholder.

## profileData sections

The adapter returns compatibility fields plus expanded top-level sections:

- `playerName`, `slug`, `avatarUrl`, `bio`, `rankText`, `pointsText`, `labelsText`: compatibility fields for the current Plasmic template.
- `coreStats`, `pokerStats`, `positionStats`, `notableHands`, `recentSessions`, `badges`: legacy V2 arrays kept for current/future bindings.
- `identity`: public identity fields such as name, slug, avatar, bio, and labels.
- `seasonStatus`: current season code, rank, points, and public labels.
- `publicHud`: free public stats only: hands, VPIP, PFR, biggest pot, rank, and points.
- `featuredDisplay`: Featured Display mode, three normalized showcase cards, and compatibility aliases for earlier featured fields.
- `styleProfile`: profile display customization metadata, currently defaulted.
- `achievements`: public achievement placeholders.
- `moments`: public moment placeholders, currently derived from notable hands when available.
- `access`: placeholder access object with `tier: "free"`.
- `lockedSections`: placeholder cards for future locked product surfaces.
- `advancedHud`: locked placeholder for future advanced HUD data.
- `poolComparisons`: locked placeholder for future pool HUD/comparison data.
- `coachingSignals`: locked placeholder for future generated study/coaching notes.
- `archivedSeasons`: locked placeholder for previous season access.

## Free public sections

These are intended to remain visible on free public profiles:

- `identity`
- `seasonStatus`
- `publicHud`
- `featuredDisplay`
- `styleProfile`
- `achievements`
- `moments`
- `recentSessions`

`publicHud` is intentionally limited to hands, VPIP, PFR, biggest pot, rank, and points.

## Placeholder locked premium sections

These sections exist in the contract now, but they are placeholders only:

- Pool HUD
- Individual Scout
- Advanced HUD
- Archived Seasons
- Coaching Signals

The corresponding data sections are `lockedSections`, `advancedHud`, `poolComparisons`, `coachingSignals`, and `archivedSeasons`.

Payments, subscriptions, account gating, entitlement checks, checkout flows, and real paid HUD behavior are intentionally not implemented yet.

## Supabase table mapping

- `players`: identity, slug, avatar, bio, and future display fields such as banner.
- `player_season_stats`: season-level hands, VPIP, PFR, labels, poker stats, and biggest pot.
- `standings`: rank and points.
- `player_session_stats`: recent session-level player stats.
- `session_results`: result details joined by session id when available.
- `notable_hands`: public hand highlights filtered for rows involving the player.
- `player_profile_display`: optional season-specific Featured Display choices, theme metadata, banner, and custom title.

## Featured Display / Player Showcase

`player_profile_display` stores optional player-selected presentation choices for
one player and season. Its ordered `featured_cards` JSON contains the three
cards assigned to `featured_1`, `featured_2`, and `featured_3`.

The normalized contract is:

```js
featuredDisplay: {
  mode: "default" | "player_selected",
  cards: [{ slot, type, label, title, value, subtitle, source, sourceId }]
}
```

When no saved row or usable cards exist, `getPlayerProfileData()` generates
three smart defaults from public HUD stats, season results, and the best
available moment or badge. When saved cards exist, the adapter normalizes and
uses them with `mode: "player_selected"`.

The current editor is `/admin/profile-display/[slug]`. It is an admin utility
and is intentionally unauthenticated for now. Future player accounts can use
the same table and card contract after authentication and authorization are
added.

Plasmic remains responsible for the visual placement and sizing of
`featuredDisplaySlot`. Next.js supplies minimal fallback cards inside that
slot; changing the saved card choices does not change the Plasmic layout.

The SQL definition is `sql/player_profile_display.sql`. It must be run manually
in the Supabase SQL Editor. Until it is installed, public profiles silently use
smart defaults and the editor displays a readable storage warning.

## Section background customization

`sql/player_profile_display_customization.sql` adds optional image URL fields
for the hero and five profile content sections. The adapter exposes them as:

```js
customization: {
  profileTheme,
  bannerUrl,
  customTitle,
  sectionBackgrounds: {
    hero,
    featuredDisplay,
    publicHud,
    moments,
    achievements,
    lockedSections
  }
}
```

The exact Plasmic outer section layer names are:

- `Public HUD Section`
- `Featured Display Section`
- `Locked Sections`
- `Moments Section`
- `Achievements`

The exact inner content slot names are:

- `publicHudSlot`
- `featuredDisplaySlot`
- `lockedSectionsSlot`
- `momentsSlot`
- `achievementsSlot`

Outer section boxes own visual backgrounds and framing. Inner slot boxes receive
the React content supplied by Next.js. Do not rename either set without updating
this contract.

The client passes a background style override to an outer section only when the
Plasmic component metadata exposes that exact name as an overrideable prop. If
it is not exposed, the client does not pass an invalid prop; instead, the saved
background is applied to a bounded wrapper inside the corresponding slot. The
outer names are not guaranteed to be registered component props, so the slot
wrapper remains the reliable fallback until those elements are explicitly
exposed in Plasmic.

`hero_bg_url` is stored and returned in the profile contract, but no hero outer
layer name or hero slot is currently part of this contract. It is therefore not
applied by the fallback client yet.

Background URLs are entered manually in the unauthenticated admin editor and
stored in `player_profile_display`. Upload support, an image gallery, and preset
backgrounds are future work.

## Editing rule

Do not hard-code a giant React profile page. Keep data shaping in `getPlayerProfileData()`, keep route logic thin, and edit the profile visuals in Plasmic by binding supported layers and slots.
