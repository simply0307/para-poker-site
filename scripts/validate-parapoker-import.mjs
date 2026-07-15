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

function parseCsvRows(csvText = "") {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const input = String(csvText || "").replace(/^\uFEFF/u, "");

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);
  const headers = rows[0].map((header) => String(header || "").trim().toLowerCase());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, String(values[index] || "").trim()])));
}

function csvOrderValue(row = {}) {
  const parsed = Number(row.order || row.log_order || row.action_order);
  if (Number.isFinite(parsed)) return parsed;
  return Date.parse(row.at || row.timestamp || "");
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
    const previousSequence = previousSequenceByHand.get(handNo) || 0;
    if (!sequence) errors.push(`Hand #${handNo} event ${event.eventId || "(missing)"} is missing sequenceNumber.`);
    else if (sequence <= previousSequence) errors.push(`Hand #${handNo} event ${event.eventId || "(missing)"} sequence ${sequence} must be greater than previous public sequence ${previousSequence}.`);
    if (sequence) previousSequenceByHand.set(handNo, sequence);
  }

  return errors;
}

function validateFixtureHandEvidence(pkg) {
  const errors = [];
  const participantSeats = new Set((pkg.participants || []).map((participant) => participant.seatId));
  for (const hand of pkg.hands || []) {
    const handNumber = numberValue(hand.handNumber, 0);
    let initialTotal = 0;
    let finalTotal = 0;
    let contributionTotal = 0;
    for (const seatId of hand.participantSeatIds || []) {
      if (!participantSeats.has(seatId)) errors.push(`Hand #${handNumber} references unknown participant ${seatId}.`);
      initialTotal += numberValue(hand.stackCheckpoints?.initial?.[seatId], 0);
      finalTotal += numberValue(hand.stackCheckpoints?.final?.[seatId], 0);
      contributionTotal += numberValue(hand.contributions?.[seatId], 0);
      if (!hand.positions?.[seatId]) errors.push(`Hand #${handNumber} is missing position evidence for ${seatId}.`);
    }
    const awardTotal = (hand.potAwards || []).reduce((sum, award) => sum + numberValue(award.amount, 0), 0);
    const refundTotal = (hand.potSummary?.refunds || []).reduce((sum, refund) => sum + numberValue(refund.amount, 0), 0);
    if (numberValue(hand.potSummary?.totalContributed) !== contributionTotal) errors.push(`Hand #${handNumber} contribution total does not match pot summary.`);
    if (numberValue(hand.potSummary?.totalAwarded) !== awardTotal) errors.push(`Hand #${handNumber} award total does not match pot summary.`);
    if (contributionTotal !== awardTotal + refundTotal) errors.push(`Hand #${handNumber} pot awards and refunds do not conserve contributed chips.`);
    if (initialTotal - contributionTotal + awardTotal + refundTotal !== finalTotal) errors.push(`Hand #${handNumber} stack checkpoints do not conserve chips.`);
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
const rawParser = read("src/lib/imports/rawHandHistoryParser.js");
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
assert.match(importer, /must be greater than previous public sequence/, "Importer must allow private-event gaps while rejecting duplicate or decreasing public sequences.");
assert.match(importer, /returns to Hand #/, "Importer must reject earlier hand groups after later hands.");
assert.match(importer, /numberValue\(left\.sequenceNumber/, "Importer must sort hand events by hand-local sequence.");
assert.match(importer, /orderedHandsFor/, "Importer must derive records in hand-number order.");
assert.match(importer, /target_contribution/, "Importer must preserve target contribution for action records.");
assert.match(importer, /raise_to/, "Importer must preserve raise-to values for raise/all-in records.");
assert.match(importer, /startedAt/, "Importer must validate per-hand start timestamps.");
assert.match(importer, /stackCheckpoints/, "Importer must validate per-hand stack checkpoints.");
assert.match(importer, /potSummary/, "Importer must validate per-hand pot construction evidence.");
assert.match(importer, /finishOrder/, "Importer must validate package result finish order.");
assert.match(importer, /stack checkpoints do not conserve chips/, "Importer must reject hand evidence that does not conserve chips.");

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
assert.match(adminPage, /RawHandImportPanel/, "Import control room must center the raw hand CSV import panel.");
assert.doesNotMatch(adminPage, /\/admin\/imports\/parapoker/, "Import control room must not promote the legacy package importer as the active lane.");
assert.match(packagePage, /ParaPokerPackageImportPanel/, "Package route must render the package import workspace.");
assert.match(previewRoute, /previewCompletedSessionPackage/, "Preview route must use server-side validation.");
assert.match(commitRoute, /commitCompletedSessionPackage/, "Commit route must use server-side commit.");
assert.match(handHistory, /boardCardsForStreet/, "Existing hand history normalizer must support board cards on streets.");
assert.match(rawParser, /chronologicalCsvRows/, "Raw hand CSV imports must normalize chronological row order.");
assert.match(rawParser, /rowSortValue/, "Raw hand CSV imports must sort by explicit order values when present.");
assert.match(rawParser, /ending\\s\+hand/, "Raw hand parser must ignore ending-hand markers as hand starts.");
assert.match(rawParser, /line\.match\(\/\\\(id:/, "Raw hand parser must prefer explicit hand IDs from starting hand lines.");
assert.match(rawParser, /collected\[collected\.length - 1\] \|\| winners/, "Raw hand parser must prefer collected-pot lines over match-win lines.");
assert.match(rawParser, /winningHandName/, "Raw hand parser must preserve winning hand text from collected-pot rows.");

const fixture = JSON.parse(read("tests/fixtures/para-completed-session-multi-hand-v1.json"));
const { integrity: _integrity, ...withoutIntegrity } = fixture;
assert.equal(fixture.schemaVersion, "para-completed-session-v1", "Multi-hand fixture must be package v1.");
assert.equal(fixture.source.app, "parapoker-official-client", "Multi-hand fixture must be from official client.");
assert.equal(fixture.integrity.eventCount, fixture.orderedPublicEvents.length, "Multi-hand fixture event count must match.");
assert.equal(fixture.integrity.handCount, fixture.hands.length, "Multi-hand fixture hand count must match.");
assert.equal(fixture.integrity.checksum, checksum(withoutIntegrity), "Multi-hand fixture checksum must be stable.");
assert.deepEqual(validateFixtureEventOrdering(fixture), [], "Valid multi-hand package with per-hand sequence restarts and private-event gaps must pass.");
assert.deepEqual(validateFixtureHandEvidence(fixture), [], "Valid multi-hand package must include conserving stack, contribution, award, and refund evidence.");
assert.equal(fixture.orderedPublicEvents.find((event) => event.handId === 2).sequenceNumber, 1, "Hand 2 must restart at sequence 1.");
assert.equal(fixture.orderedPublicEvents.find((event) => event.handId === 3).sequenceNumber, 1, "Hand 3 must restart at sequence 1.");

expectOrderingError(
  fixture,
  (copy) => {
    copy.orderedPublicEvents.find((event) => event.eventId === "hand-2-event-5").sequenceNumber = 6;
  },
  /Hand #2 event hand-2-event-5 sequence 6 must be greater than previous public sequence 6/,
  "Duplicate same-hand sequence must fail.",
);

{
  const copy = structuredClone(fixture);
  for (const event of copy.orderedPublicEvents.filter((candidate) => candidate.handId === 2 && candidate.sequenceNumber >= 7)) {
    event.sequenceNumber += 1;
  }
  assert.deepEqual(validateFixtureEventOrdering(copy), [], "Skipped public sequence numbers must pass because private events can occupy hidden slots.");
}

expectOrderingError(
  fixture,
  (copy) => {
    copy.orderedPublicEvents.find((event) => event.eventId === "hand-2-event-6").sequenceNumber = 3;
  },
  /Hand #2 event hand-2-event-6 sequence 3 must be greater than previous public sequence 7/,
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
  [4, 5, 6, 7, 9, 10, 12, 13, 14, 16, 17],
  "Derived hand 2 actions must preserve chronological hand-local sequence.",
);

const rawCsvFixture = read("tests/fixtures/parapoker-local-match-entry-order-hand-history.csv");
const rawCsvRows = parseCsvRows(rawCsvFixture);
assert.equal(rawCsvRows[0].entry, "-- ending hand #2 --", "Entry/order CSV fixture must be stored newest-first.");
const chronologicalEntries = [...rawCsvRows].sort((left, right) => csvOrderValue(left) - csvOrderValue(right)).map((row) => row.entry);
assert.equal(chronologicalEntries[0], "-- starting hand #1 (id: hand-1) No Limit Texas Hold'em (dealer: \"Maven\") --", "Entry/order CSV must sort to the first hand start.");
assert.equal(chronologicalEntries.at(-1), "-- ending hand #2 --", "Entry/order CSV must end with the latest hand after order sorting.");

console.log("ParaPoker package import validation passed.");
