import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function checksum(value) {
  const json = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < json.length; index += 1) {
    hash ^= json.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function eventHandNumber(event = {}) {
  return numberValue(event.handId || event.handNumber || event.payload?.handId, 0);
}

function validateFixtureEventOrdering(pkg) {
  const errors = [];
  const events = Array.isArray(pkg.orderedPublicEvents) ? pkg.orderedPublicEvents : [];
  const handNumbers = new Set((pkg.hands || []).map((hand) => numberValue(hand.handNumber, 0)).filter(Boolean));
  const eventIds = new Set();
  const previousSequenceByHand = new Map();
  const completedHands = new Set();
  let activeHandNumber = null;
  let highestHandNumberSeen = 0;

  for (const event of events) {
    if (eventIds.has(event.eventId)) errors.push(`Duplicate event ID: ${event.eventId}.`);
    eventIds.add(event.eventId);

    const handNo = eventHandNumber(event);
    if (!handNo) {
      errors.push(`Event ${event.eventId || "(missing)"} is missing a hand reference.`);
      continue;
    }
    if (!handNumbers.has(handNo)) {
      errors.push(`Event ${event.eventId} references unknown hand #${handNo}.`);
      continue;
    }

    if (activeHandNumber === null) {
      activeHandNumber = handNo;
      highestHandNumberSeen = handNo;
    } else if (handNo !== activeHandNumber) {
      if (completedHands.has(handNo) || handNo < highestHandNumberSeen) {
        errors.push(`Event ${event.eventId || "(missing)"} returns to Hand #${handNo} after later hand events were already seen.`);
      }
      completedHands.add(activeHandNumber);
      activeHandNumber = handNo;
      highestHandNumberSeen = Math.max(highestHandNumberSeen, handNo);
    }

    const sequence = numberValue(event.sequenceNumber, 0);
    const expectedSequence = (previousSequenceByHand.get(handNo) || 0) + 1;
    if (!sequence) errors.push(`Hand #${handNo} event ${event.eventId || "(missing)"} is missing sequenceNumber ${expectedSequence}.`);
    else if (sequence !== expectedSequence) errors.push(`Hand #${handNo} event ${event.eventId || "(missing)"} expected sequence ${expectedSequence} but received ${sequence}.`);
    if (sequence) previousSequenceByHand.set(handNo, sequence);
  }

  return errors;
}

function deriveFixtureActionLogs(pkg) {
  let logOrder = 0;
  return [...(pkg.hands || [])]
    .sort((left, right) => numberValue(left.handNumber, 0) - numberValue(right.handNumber, 0))
    .flatMap((hand) => {
      const handNumber = numberValue(hand.handNumber, 0);
      return (pkg.orderedPublicEvents || [])
        .filter((event) => eventHandNumber(event) === handNumber)
        .sort((left, right) => numberValue(left.sequenceNumber, 0) - numberValue(right.sequenceNumber, 0))
        .filter((event) => event.type === "blindPosted" || event.type === "actionApplied")
        .map((event) => {
          logOrder += 1;
          return {
            hand_no: handNumber,
            sequenceNumber: numberValue(event.sequenceNumber, 0),
            log_order: logOrder,
            type: event.type,
          };
        });
    });
}

function expectOrderingError(fixture, mutate, pattern, label) {
  const copy = structuredClone(fixture);
  mutate(copy);
  const errors = validateFixtureEventOrdering(copy);
  assert.match(errors.join("\n"), pattern, label);
}

const importer = read("src/lib/imports/parapokerPackageImporter.js");
const sql = read("sql/20260713_game_session_imports.sql");
const panel = read("src/components/admin-newsroom/ParaPokerPackageImportPanel.jsx");
const adminPage = read("src/app/admin/imports/page.jsx");
const packagePage = read("src/app/admin/imports/parapoker/page.jsx");
const previewRoute = read("src/app/api/admin/imports/parapoker/preview/route.js");
const commitRoute = read("src/app/api/admin/imports/parapoker/commit/route.js");
const handHistory = read("src/lib/poker/handHistory.js");
read("src/app/api/admin/imports/raw-hands/preview/route.js");
read("src/app/api/admin/imports/raw-hands/commit/route.js");

assert.match(importer, /para-completed-session-v1/, "Importer must support the completed-session package schema.");
assert.match(importer, /parapoker-official-client/, "Importer must restrict source application.");
assert.match(importer, /poker-event-v1/, "Importer must validate event schema version.");
assert.match(importer, /stableChecksum/, "Importer must implement stable checksum validation.");
assert.match(importer, /BLOCKED_KEYS/, "Importer must reject private or sensitive fields.");
assert.match(importer, /deckorder|rngstate|entropy|canonicalgamestate|holecardsdealt/i, "Importer must include private-data rejection keys.");
assert.match(importer, /validateMappingForCommit/, "Importer must block missing participant mapping.");
assert.match(importer, /archiveOnly/, "Importer must allow explicit archive-only human confirmation.");
assert.match(importer, /participant\.kind === "npc" \? null/, "NPCs must not map to league player IDs.");
assert.match(importer, /sourceMatchId/, "Importer must use stable source match ID.");
assert.match(importer, /readExistingImport/, "Importer must check existing imports for idempotency.");
assert.match(importer, /commit_parapoker_session_import/, "Importer must commit through the package RPC.");
assert.doesNotMatch(importer, /from\("players"\)\.insert/, "Package importer must not auto-create league players.");
assert.doesNotMatch(importer, /let previousSequence = 0/, "Importer must not validate event sequence as one global counter.");
assert.match(importer, /previousSequenceByHand/, "Importer must validate event sequence per hand.");
assert.match(importer, /expected sequence \$\{expectedSequence\}/, "Importer must return hand-specific sequence errors.");
assert.match(importer, /returns to Hand #/, "Importer must reject earlier hand groups after later hands.");
assert.match(importer, /numberValue\(left\.sequenceNumber/, "Importer must sort hand events by hand-local sequence.");
assert.match(importer, /orderedHandsFor/, "Importer must derive records in hand-number order.");

assert.match(sql, /create table if not exists public\.game_session_imports/, "Migration must create import audit table.");
assert.match(sql, /unique index if not exists game_session_imports_source_uidx/, "Migration must enforce source app/match idempotency.");
assert.match(sql, /create or replace function public\.commit_parapoker_session_import/, "Migration must create commit RPC.");
assert.match(sql, /for update/, "RPC must lock import/session rows during commit.");
assert.match(sql, /delete from public\.actions/, "RPC must replace session evidence atomically on retry.");
assert.match(sql, /revoke all on function public\.commit_parapoker_session_import/, "RPC execute must not be public.");
assert.match(sql, /grant execute .* to service_role/s, "RPC must be callable by the server service role.");
assert.match(sql, /status = 'failed'/, "RPC must retain auditable failed imports.");

assert.match(panel, /type="file"/, "Admin panel must support JSON file upload.");
assert.match(panel, /Paste package JSON/, "Admin panel must support pasted JSON.");
assert.match(panel, /Participant mapping/, "Admin panel must expose participant mapping.");
assert.match(panel, /Commit Import/, "Admin panel must require explicit commit.");
assert.match(panel, /migration\/RPC is not installed/, "Admin panel must explain missing migration state.");
assert.match(adminPage, /\/admin\/imports\/parapoker/, "Import control room must link to package importer.");
assert.match(packagePage, /ParaPokerPackageImportPanel/, "Package route must render the package import workspace.");
assert.match(previewRoute, /previewCompletedSessionPackage/, "Preview route must use server-side validation.");
assert.match(commitRoute, /commitCompletedSessionPackage/, "Commit route must use server-side commit.");
assert.match(handHistory, /boardCardsForStreet/, "Existing hand history normalizer must support board cards on streets.");

const fixture = JSON.parse(read("tests/fixtures/para-completed-session-multi-hand-v1.json"));
const { integrity: _integrity, ...withoutIntegrity } = fixture;
assert.equal(fixture.schemaVersion, "para-completed-session-v1", "Multi-hand fixture must be package v1.");
assert.equal(fixture.source.app, "parapoker-official-client", "Multi-hand fixture must be from official client.");
assert.equal(fixture.integrity.eventCount, fixture.orderedPublicEvents.length, "Multi-hand fixture event count must match.");
assert.equal(fixture.integrity.handCount, fixture.hands.length, "Multi-hand fixture hand count must match.");
assert.equal(fixture.integrity.checksum, checksum(withoutIntegrity), "Multi-hand fixture checksum must be stable.");
assert.deepEqual(validateFixtureEventOrdering(fixture), [], "Valid multi-hand package with per-hand sequence restarts must pass.");
assert.equal(fixture.orderedPublicEvents.find((event) => event.handId === 2).sequenceNumber, 1, "Hand 2 must restart at sequence 1.");
assert.equal(fixture.orderedPublicEvents.find((event) => event.handId === 3).sequenceNumber, 1, "Hand 3 must restart at sequence 1.");

expectOrderingError(
  fixture,
  (copy) => {
    copy.orderedPublicEvents.find((event) => event.eventId === "hand-2-event-5").sequenceNumber = 4;
  },
  /Hand #2 event hand-2-event-5 expected sequence 5 but received 4/,
  "Duplicate same-hand sequence must fail.",
);

expectOrderingError(
  fixture,
  (copy) => {
    copy.orderedPublicEvents.find((event) => event.eventId === "hand-2-event-5").sequenceNumber = 6;
  },
  /Hand #2 event hand-2-event-5 expected sequence 5 but received 6/,
  "Skipped same-hand sequence must fail.",
);

expectOrderingError(
  fixture,
  (copy) => {
    copy.orderedPublicEvents.find((event) => event.eventId === "hand-2-event-6").sequenceNumber = 3;
  },
  /Hand #2 event hand-2-event-6 expected sequence 6 but received 3/,
  "Decreasing same-hand sequence must fail.",
);

expectOrderingError(
  fixture,
  (copy) => {
    const [lateHandOneEvent] = copy.orderedPublicEvents.splice(4, 1);
    copy.orderedPublicEvents.push(lateHandOneEvent);
  },
  /returns to Hand #1 after later hand events were already seen/,
  "Earlier hand group must not reappear after later hands.",
);

expectOrderingError(
  fixture,
  (copy) => {
    copy.orderedPublicEvents.find((event) => event.eventId === "hand-3-event-1").eventId = "hand-1-event-1";
  },
  /Duplicate event ID: hand-1-event-1/,
  "Duplicate event IDs across hands must fail.",
);

expectOrderingError(
  fixture,
  (copy) => {
    const event = copy.orderedPublicEvents.find((candidate) => candidate.eventId === "hand-2-event-1");
    event.handId = 99;
    event.payload.handId = 99;
  },
  /references unknown hand #99/,
  "Unknown hand references must fail.",
);

const oneHandFixture = structuredClone(fixture);
oneHandFixture.hands = [oneHandFixture.hands[0]];
oneHandFixture.orderedPublicEvents = oneHandFixture.orderedPublicEvents.filter((event) => eventHandNumber(event) === 1);
oneHandFixture.integrity.eventCount = oneHandFixture.orderedPublicEvents.length;
oneHandFixture.integrity.handCount = oneHandFixture.hands.length;
assert.deepEqual(validateFixtureEventOrdering(oneHandFixture), [], "One-hand package validation must still pass.");

const derivedActionLogs = deriveFixtureActionLogs(fixture);
assert.ok(derivedActionLogs.some((action) => action.hand_no === 1), "Derived logs must include hand 1 actions.");
assert.ok(derivedActionLogs.some((action) => action.hand_no === 2), "Derived logs must include hand 2 actions.");
assert.ok(derivedActionLogs.some((action) => action.hand_no === 3), "Derived logs must include hand 3 actions.");
assert.deepEqual(
  derivedActionLogs.map((action) => action.log_order),
  Array.from({ length: derivedActionLogs.length }, (_, index) => index + 1),
  "Derived global log_order must be strictly increasing.",
);
assert.deepEqual(
  derivedActionLogs.filter((action) => action.hand_no === 2).map((action) => action.sequenceNumber),
  [2, 3, 4, 5, 7, 8, 10, 11, 12, 14, 15],
  "Derived hand 2 actions must preserve chronological hand-local sequence.",
);

console.log("ParaPoker package import validation passed.");
