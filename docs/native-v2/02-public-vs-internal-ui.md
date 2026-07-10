# Public vs Internal UI Rules

## Core Rule

The archive can store more than the public UI shows.

Public pages should feel like league coverage. Internal pages can feel like data inspection. Do not mix those jobs.

## Public UI Can Show

- Player display names.
- Player slugs in URLs.
- Public avatar/banner images.
- Public profile labels and respectful archetypes.
- Season code, rank, points, hands, sessions, biggest pot.
- Approved or clearly public session outcomes.
- Human-readable session codes such as `S0-001`.
- Session date, format, participants, hand count, and recap.
- Notable moments with public titles and summaries.
- Public achievements, badges, and cosmetics.
- Player-facing empty states.
- Sponsor/supporter placements when approved.

## Public UI Should Hide By Default

- UUIDs.
- Raw database primary keys.
- Raw hand IDs and source hand arrays.
- Source table names.
- `deterministic`, `draft`, generator labels, model names, prompt metadata.
- `source_fact_ids`.
- Raw `sourceFacts` blocks.
- Confidence labels when they read like admin state instead of public clarity.
- Unapproved results presented as final.
- Moderator notes, dispute notes, private review status.
- Raw hand histories.
- Database field names such as `source_session_id` or `player_session_stats`.

## Public Disclosures

Use small disclosures only when useful:

- "Hand details"
- "Session details"
- "Source facts"
- "How this was counted"

Disclosure content should still be human-readable. Prefer:

> Hand #6, 15,290 chips, Para-Poker won with two pair.

Avoid:

> source_hand_ids: ["..."], source_table: "notable_hands"

## Internal UI Can Show

- UUIDs and raw IDs.
- Source table names.
- Raw source facts.
- Artifact status, generation metadata, prompt input, model metadata.
- Draft/approved/archive workflow fields.
- Reviewer identity, version history, approval history.
- Low-level confidence and audit fields.
- Raw JSON payloads.

## Recap Artifact Public Display

Public pages should render:

- headline
- dek
- short summary
- long body
- key takeaways
- public tags
- related players/sessions

Public pages should not render by default:

- status
- visibility
- source IDs
- prompt input
- raw facts
- version metadata

## Empty States

Public empty states should sound like the archive is still forming:

- "No featured moment has been selected yet."
- "Session recaps will appear here after results are approved."
- "This player's story will sharpen as more approved sessions enter the archive."

Avoid:

- "No rows returned."
- "Missing sourceFacts."
- "No deterministic artifact available."

