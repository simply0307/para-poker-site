# Modular Player Profile Layout

## Purpose

The modular profile layout gives code a maintainable composition system while
keeping Plasmic as the editable visual layer. It is a proof alongside the live
profile, not a replacement for `PlayerProfileTemplate`.

## Ownership boundary

Code owns:

- normalized profile data from `getPlayerProfileData()`
- section order and responsive containment in `PlayerProfileLayout`
- reusable semantic modules and their safe fallback presentation
- routes, Supabase access, server actions, and future authorization
- warm display copy and removal of raw identifiers

Plasmic owns:

- the live public `PlayerProfileTemplate` composition
- page skins, section placement, spacing, typography, and responsive art direction
- section backgrounds and framing
- the existing named layers and content slots
- future visual variants that consume stable module contracts

## Module structure

`src/components/profile-layout/` contains:

- `PlayerProfileLayout`: code-owned composition for the complete preview page.
- `PlayerHeroModule`: identity, labels, bio, and core season summary.
- `FeaturedDisplayModule`: the normalized three-card player showcase.
- `PublicHudModule`: free public HUD statistics.
- `MomentsModule`: contextual season highlights without raw IDs.
- `AchievementsModule`: current public badges and milestones.
- `LockedSectionsModule`: future scouting placeholders only.
- `ProfileSectionFrame`: shared full-width section boundary, heading, and background.

Modules accept focused props and never fetch Supabase themselves. New modules
should follow that rule: normalize data in `playerProfileData.js`, pass only the
needed section data, and keep layout behavior responsive without fixed or
absolute positioning.

## Preview route

Use the development-only route:

`/dev/profile-layout/[slug]`

For the current test player:

`/dev/profile-layout/panicmixie-at-l57fne6bbg`

The route calls `getPlayerProfileData(slug, "S0")` and renders
`PlayerProfileLayout`. Its comparison link opens the unchanged public Plasmic
route at `/plasmic-profile/[slug]`.

This lets product direction be supervised at the section/module level instead
of manually wiring every repeated card. The code preview can mature until it is
proven, while the existing Plasmic profile remains available throughout.

## Initial Plasmic bridge

The existing `/plasmic-host` now registers:

- `ProfileSectionFrame`
- `FeaturedDisplayModule`

Registration is shared by the browser host and server loader through
`src/plasmic-register.js`. This ensures a module placed in Studio can also render
after publication.

`FeaturedDisplayModule` uses editable preview cards in Studio. It does not fetch
real player data inside Plasmic. Real profile data still enters through the
Next.js route and existing slot contract. A later bridge can introduce a
carefully scoped profile data context after these first components are proven.

`PlayerProfileLayout` and the remaining modules are intentionally not registered
yet. Register them incrementally only when their Plasmic editing contract is
clear and the existing slots remain available as a fallback.

## Migration rule

Do not remove `PlayerProfileTemplate`, `/plasmic-profile/[slug]`, or its current
slots until a modular Plasmic composition has been placed, published, tested
against multiple players, and explicitly selected as the public replacement.
