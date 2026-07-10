# Native v2 Navigation Map

## Navigation Goal

Users should always know where they are in the league record and how to jump to the next useful surface: players, profiles, standings, sessions, recaps, moments, or archive.

The main public path should feel like:

`Players -> Player Dossier -> Session Recap -> Moment -> Related Player/Profile -> Standings`

## Current Native Routes

### `/players-v2`

Purpose: public player directory.

Primary actions:

- Open a player dossier.
- Compare rank, points, hands, biggest pot, and public labels.
- Jump to standings when available.

Required links:

- player cards link to `/players-v2/[slug]`
- global nav links to Sessions, Standings, Moments/Archive when present

### `/players-v2/[slug]`

Purpose: player dossier and preview surface.

Primary sections:

- Hero identity and current season snapshot.
- Player Season Story.
- Recent Form.
- Featured Moment.
- Top Moments preview, limited to 3-5 cards.
- Session pathways linking to longform session recaps.
- Locked future modules for advanced HUD, scouting, coaching, archived seasons, badges, and achievements.

Required links:

- back to `/players-v2`
- first/recent session recap: `/sessions-v2/[sessionIdOrCode]`
- future standings: `/standings-v2`
- future full archive: `/archive-v2/players/[slug]` or `/moments-v2?player=[slug]`

Do not place the full archive grid on the main profile body.

### `/sessions-v2/[sessionId]`

Purpose: primary longform recap surface.

Primary sections:

- Session headline and dek.
- Short recap.
- Longform recap body.
- Biggest pot.
- Turning point.
- Player of the session candidate.
- Notable hands/moments.
- Participating players.
- Standings impact when applicable.

Required links:

- participating players link to `/players-v2/[slug]`
- moment cards can link to future moment detail pages
- breadcrumb/back link to Sessions index when available

## Future Public Routes

### `/standings-v2`

Purpose: current competitive table.

Should include:

- season selector
- approved-results-only note in plain public language
- rank, player, points, wins/top finishes, sessions, biggest pot
- player profile links
- latest approved session link

### `/sessions-v2`

Purpose: session/recap index.

Should include:

- upcoming/completed/approved sessions
- recap cards
- session status in public language
- filters by season
- links to session detail pages

### `/moments-v2`

Purpose: public moment index.

Should include:

- featured moments
- filters by player, season, tag, session
- no raw hand IDs in default cards
- optional "Hand details" disclosure inside a card or detail page

### `/moments-v2/[momentSlug]`

Purpose: expanded moment recap.

Should include:

- headline, short recap, expanded recap
- related players
- related session
- public hand summary if available
- source details hidden behind disclosure

### `/archive-v2`

Purpose: broader league archive gateway.

Should include:

- seasons
- sessions
- moments
- achievements
- players
- future digests

Archive pages should remain public-facing. Internal metadata belongs in dev/admin surfaces.

## Internal/Admin Routes

Dev/admin routes may show source facts, IDs, raw JSON, generator status, and review metadata. Public routes should not.

Recommended internal surfaces:

- `/dev/session-data/[sessionCode]`
- `/dev/standings-data`
- future `/admin/recaps`
- future `/admin/recaps/[artifactId]`

## Navigation Component Rules

- Primary nav should use native v2 destinations, not legacy Plasmic routes.
- Do not link public users to `/plasmic-profile/[slug]`.
- Keep Plasmic routes available but outside the main public navigation.
- On mobile, use a compact sticky nav or horizontal tab row with no overflow.
- Section anchors should be short: Story, Form, Moment, Sessions, Recap, Players, Moments.

