# Recap Formats

## Shared Rules

All recap formats must be grounded in existing backend data or approved editorial fields.

Creative language may frame:

- significance
- momentum
- pressure
- contrast
- season context
- archive memory

Creative language may not invent:

- hole cards, actions, reads, bluffs, intentions, emotions, rivalries, quotes, or standings impact
- canon/lore events
- private context
- gambling stakes

## Moment Blurb

Purpose: make a single notable hand/moment readable on cards and previews.

Length: 1-2 sentences, 25-60 words.

Where it appears:

- player profile Top Moments preview
- session page moment list
- future moments index

Allowed data:

- public moment title
- session code/date
- hand number if useful
- winner
- pot size
- public hand result
- tags such as Large Pot, All-In, Showdown
- related player/profile link

Format:

- headline
- one compact summary
- optional public tags
- link to session recap

## Moment Expanded Recap

Purpose: provide more context for a featured or detail-view moment.

Length: 120-300 words.

Where it appears:

- Featured Moment on player profile
- session moment expansion
- future `/moments-v2/[momentSlug]`

Allowed data:

- all Moment Blurb fields
- board/runout if present and safe
- related session recap
- approved achievements triggered by the moment
- standings context only if directly supported

Public UI default:

- editorial recap first
- optional "Hand details" disclosure

## Session Recap

Purpose: the main longform public recap of a completed session.

Length:

- short recap: 75-150 words
- long body: 300-900 words for early v2

Where it appears:

- `/sessions-v2/[sessionId]`
- session index cards
- linked from player profiles and moments

Required elements:

- session code/title
- date
- format
- participants
- winner/result when approved
- biggest pot
- turning point if supported by notable hand data
- player of session candidate when supported by approved results
- notable moments
- standings impact when applicable

Allowed data:

- `sessions`
- `session_results`
- `player_session_stats`
- `notable_hands`
- `hands`
- approved `recap_artifacts`/`recaps` when present
- public player registry

## Player Dossier

Purpose: summarize a player's public season identity and lead users into session recaps.

Length:

- season story: 100-220 words
- recent form: 60-140 words
- featured moment: 80-180 words

Where it appears:

- `/players-v2/[slug]`

Allowed data:

- public player identity fields
- current season standings
- player season/session stats
- public achievements/badges
- selected notable moments
- approved recaps

Rules:

- profile is a dossier/preview, not full archive dump
- max 3-5 moment cards in main body
- link to session pages for longform detail

## League Digest

Purpose: summarize the state of a season/division/week.

Length: 400-900 words.

Where it appears:

- future `/archive-v2`
- future `/standings-v2`
- future season/division pages
- social/newsletter exports

Allowed data:

- approved sessions
- standings
- public achievements
- player/profile links
- top moments
- sponsor notes if approved

Rules:

- distinguish official standings from editorial takeaways
- do not imply qualification/rewards unless confirmed
- keep lore flavor light and optional

