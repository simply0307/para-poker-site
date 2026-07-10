# Native Recap Archive Contract

This note documents the existing data available for recap generation/display.
It is intentionally lightweight because the current task avoids schema changes.

## Existing grounded sources

- `players`: public identity, slug, avatar URL, PokerNow name, optional bio.
- `sessions`: season code, session number/code, played date, table name, format,
  status, raw log row count, hand count, player count.
- `hands`: hand number/id, board, winner id/name, pot collected, winning hand,
  showdown flag, raw result.
- `actions`: street-level action records, player ids/names, action text, amount,
  all-in flag, raise/3-bet/limp/call-vs-raise markers.
- `raw_log_entries`: source log entries and ordering for audit trails.
- `notable_hands`: derived public moment records with tags, winner, pot,
  board, involved players, summary, raw result.
- `player_season_stats`: season-level public HUD and player labels.
- `player_session_stats`: session-level public HUD and player labels.
- `session_results`: finish, league points, confidence, notes, approval flag.
- `standings`: season rank, points, wins, top finishes, latest session.
- `player_profile_display`: optional profile customization/featured cards. This
  table may be absent; the adapter already falls back to defaults.

## Recap artifacts

The native v2 layer now expects recap-shaped data through `RecapArtifact`,
`MomentRecap`, `SessionRecap`, and `PlayerRecap` contracts. A reviewed storage
table is not installed in this repo yet. `getStoredRecapArtifact()` therefore
tries likely table names (`recap_artifacts`, `recaps`) and falls back to
deterministic draft artifacts when they do not exist.

The public artifact shape is editorial-first:

- `scope`: moment, session, player, division, or season.
- `status`: draft, approved, or archived. Status is internal unless an admin
  surface chooses to show it.
- `headline`, `dek`, `short_summary`, `long_body`, and `key_takeaways`: public
  recap copy.
- `source_fact_ids`, `source_hand_ids`, and `sourceFacts`: grounding metadata
  for review, generation, and optional details disclosures.
- `tone`, `visibility`, `created_at`, and `updated_at`: editorial workflow
  metadata for future storage.

## Grounding rule

Every factual sentence displayed by native v2 recap components should be backed
by `RecapSourceFact` entries. The public UI should lead with narrative copy and
hide raw IDs, UUIDs, artifact status, and source tables from the main reading
experience. Human-readable source details may appear behind small disclosures.

## TODOs

- Add a reviewed recap artifact table when the review/versioning workflow is
  ready.
- Store artifact version, generator/model metadata, reviewer id, and approval
  timestamps when the editorial flow exists.
- Attach exact `hands.id` UUIDs to notable hand recaps when the moment adapter
  joins `notable_hands.hand_code` back to `hands.hand_id`.
