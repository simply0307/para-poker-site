# Native v2 Para Poker Product Brief

## What This Is

Native v2 is the player-facing Para Poker product layer: a public sports archive for the Para Poker Preseason, built from the existing Supabase/game data and designed to eventually replace the Plasmic prototype without breaking it.

It should turn approved PokerNow sessions into readable league history:

- player dossiers
- standings context
- session recap pages
- notable moments
- achievements and badges
- archive previews
- future paid-tier scouting/HUD/coaching modules

Para Poker is a free-to-enter competitive poker league. PokerNow is where the game happens. Para Poker is where the game becomes a league record.

## Audience

- Players who want to see their season identity, stats, moments, and recognition.
- Friends/fans who want to follow the table without reading raw hand logs.
- League organizers who need clean public surfaces powered by reliable data.
- Future sponsors/supporters who need the league to feel organized, fair, and alive.

## What It Should Feel Like

- Premium public sports archive.
- Poker stat card crossed with a season dossier.
- Competitive, readable, player-forward, and grounded.
- Lightly mythic at the edges, but never confusing.
- Like the table is being remembered with care.

Good target feeling:

> This happened, it mattered, and the league remembers it.

## What It Should Not Feel Like

- An admin database viewer.
- A raw hand-history dump.
- A debug screen showing UUIDs, source tables, or generator status.
- A gambling funnel, casino page, or betting product.
- A fake lore page that invents destiny around ordinary data.
- A hostile scouting report that shames player style or mistakes.

## Core Product Loop

1. A visitor lands on a league/public page or a shared profile/session link.
2. They browse players, standings, sessions, or recent recaps.
3. A player profile gives a fast dossier: identity, rank, points, style, story, featured moment, and top moments.
4. CTAs move the visitor into the relevant session recap for longform context.
5. Session pages provide the main editorial recap: headline, dek, short recap, long recap, key moments, biggest pot, standings impact, and participants.
6. Moments link back to players and sessions, creating a loop through the archive.
7. Future archive, moments, standings, badges, and season pages deepen discovery without cluttering the profile.

## Product Principles

- Facts come from approved/available backend data.
- Editorial language may add rhythm, framing, and stakes, but cannot add unsupported poker facts.
- Public UI leads with narrative and human-readable stats.
- Internal evidence remains available behind small disclosures or dev/admin routes.
- Player profiles are dossiers and previews, not full archive dumps.
- Session pages are the primary longform recap surface.
- Players are not raw material for content; the profile should recognize them with dignity.

