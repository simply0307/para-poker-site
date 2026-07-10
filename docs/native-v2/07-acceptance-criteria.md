# Native v2 Acceptance Criteria

## Navigation UX

- Primary public navigation links only to native v2/future-native routes.
- No main public nav links send users to Plasmic routes.
- Player cards link to `/players-v2/[slug]`.
- Session links use `/sessions-v2/[sessionIdOrCode]`.
- Player profile anchors are clear and mobile-safe: Story, Form, Moment, Top Moments, Sessions.
- Session page anchors are clear: Recap, Highlights, Players, Moments, Pots.
- Mobile navigation has no horizontal overflow.

## Player Profile UX

- Profile reads as a player dossier, not a dashboard dump.
- Hero preserves identity: name, subtitle/archetype, season hand count.
- Rank, points, hands, and biggest pot remain visible.
- Player Season Story is prominent.
- Recent Form summarizes recent session context.
- Featured Moment is editorial and grounded.
- Top Moments preview is limited to 3-5 cards.
- Full archive is linked out, not embedded as a large grid.
- Future modules can be locked without dominating the page.
- Empty states are player-facing.

## Session Recap UX

- `/sessions-v2/[sessionId]` is the main longform recap page.
- Page has headline, dek, short recap, and long body.
- Biggest pot, turning point, player of session candidate, participants, and notable moments are visible when data supports them.
- Participant names link to player profiles.
- Moment details are expandable if needed.
- Raw evidence is not the default reading experience.

## Public/Internal Separation

- Public pages do not show UUIDs, source hand arrays, source table names, deterministic labels, prompt metadata, or generation status.
- Source facts remain available only in small disclosures or dev/admin routes.
- Internal review fields are not rendered in public profile/session UI.
- Public recaps can show human-readable hand numbers and session codes.

## Recap Tone

- Copy is grounded in available facts.
- Recaps credit decisive action.
- Recaps do not shame players or turn losses into humiliation.
- Recaps avoid gambling/casino framing.
- Lore flavor is light, optional, and never presented as unsupported canon.
- Player style language is respectful.

## Mobile Usability

- No horizontal scroll at common phone widths.
- Cards stack cleanly.
- Longform recap text remains readable.
- Nav and CTAs remain reachable without covering content.
- Tables collapse or convert to cards where needed.
- Text does not overflow buttons, chips, or cards.

## Plasmic Safety

- Do not mutate Plasmic-owned/generated files.
- Existing Plasmic route `/plasmic-profile/[slug]` still works.
- Existing native route `/players-v2/[slug]` still works.
- Existing native route `/sessions-v2/[sessionId]` still works.
- Any old route redirects should keep user-facing traffic on native v2 without deleting the Plasmic fallback.

## Verification

Run before completing coding passes:

- `npm run lint`
- `npm run build`

Smoke test:

- `/players-v2`
- `/players-v2/para-poker-at-mt1ejg0x7`
- `/sessions-v2/S0-001`
- `/plasmic-profile/para-poker-at-mt1ejg0x7`
- desktop width
- mobile width

