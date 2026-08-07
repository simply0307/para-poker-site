# Gauntlet match import

Para accepts the server-authored `gauntlet.para-match.v2` contract through Admin → Imports. It is a direct JSON adapter: no CSV cleanup, hand transcription, action entry, or result reconstruction occurs.

## Boundary and provenance

The adapter validates exact uploaded bytes and builds Para's existing `raw-hand-manifest-v1` canonical evidence artifact. It deliberately reuses the deployed immutable preview and explicit-commit RPC boundary used by durable completed-session imports; it does not create a parallel league database.

The original Gauntlet bytes are stored in `game_session_imports.source_bytes`. Stable source identity columns contain `gauntlet-online`, the authoritative Gauntlet match ID, and the producer's substantive content hash. `parsed_manifest.sourceContract` retains `gauntlet.para-match.v2`, `gauntlet.league-evidence.v1`, record version, producer, and reported storage capability. `sourceParticipants`, `publicEvents`, explicit Gauntlet results, full recap evidence, and source provenance remain in the canonical manifest/evidence revision.

The existing database RPC's internal target-manifest discriminator remains `para-completed-session-v2` / `poker-event-v2`; those values describe the normalized Para materialization lane, not the uploaded source contract. Source contract identity is never inferred from those compatibility fields.

## Validation

Preview fails closed unless all of the following agree:

- schema `gauntlet.para-match.v2` and producer `gauntlet-online` / Gauntlet Online;
- server-authored source and authoritative source/match ID;
- match record version 2 and evidence schema `gauntlet.league-evidence.v1`;
- valid export/start/completion timestamps in chronological order;
- unique participant IDs/player numbers and supported account, guest, or AI identity types;
- one explicit result per participant, including final life;
- winner metadata, winner participant ID, and participant outcomes;
- complete, contiguous, uniquely identified ordered evidence;
- evidence count, final public-state checksum, and canonical SHA-256 content hash.

The adapter reports Gauntlet's storage capability as a warning. In `account-only` mode, the export is valid while available but its source record is process-local until Para stores the exact bytes.

## Identity mapping

Gauntlet account IDs never become Para player IDs automatically.

- `account`: an operator must map the match-scoped Gauntlet participant to an existing stable Para `players.id` UUID before preview is valid.
- `guest`: remains source-only by default, or can be deliberately mapped to an existing league player.
- `ai`: always remains source-only. Supplied mappings are ignored, and no fake human player is created.

All participants remain in `sourceParticipants` and recap/result provenance. Only mapped human participants produce canonical `session_results` rows. AI/system actions retain source names and event IDs with a null canonical league-player foreign key.

## Canonical materialization

One Gauntlet match becomes one Para session and one match evidence row in `hands`. Every ordered Gauntlet evidence entry becomes one `actions` row with stable source event/command IDs and its typed public payload in `raw_entry`. Explicit mapped-human outcomes become pending-review `session_results`. Factual recap inputs and notable moments become one `notable_hands` evidence row and remain losslessly available in the evidence revision manifest.

This mapping uses poker-era table names because they are the current canonical Para evidence model; it does not pretend a Gauntlet duel is a poker hand.

## Preview, commit, and idempotency

Upload first creates a persisted immutable preview. The operator can inspect source match, mode, times, participants and identity types, outcome, evidence count, producer, durability warning, mappings, validation messages, and checksums. Only explicit commit can atomically create/replace canonical evidence.

The source identity is the tuple `(gauntlet-online, authoritative match ID, gauntlet.para-match.v2, content hash)`. Repeating the exact payload returns the existing preview/commit result. A previously committed source match is surfaced for reconciliation and cannot silently create duplicate sessions, actions, results, or recap evidence.

The producer fixture at `tests/fixtures/gauntlet-para-match-v2.json` is byte-identical to Gauntlet's checked-in producer-generated fixture. Pure contract tests and a PGlite acceptance test prove preview → explicit commit → canonical session/actions/results/recap → idempotent retry.
