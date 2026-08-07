import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildGauntletMatchImportArtifact,
  computeGauntletContentHash,
} from "../src/lib/imports/gauntletMatchArtifact.js";

const fixtureBytes = fs.readFileSync(new URL("./fixtures/gauntlet-para-match-v2.json", import.meta.url));
const fixture = JSON.parse(fixtureBytes);
const participantMappings = {
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:p1": "11111111-1111-4111-8111-111111111111",
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:p2": "22222222-2222-4222-8222-222222222222",
};
const leaguePlayers = Object.values(participantMappings).map((id, index) => ({ id, display_name: index ? "League Beta" : "League Alpha" }));

function artifact(value = fixture, mappings = participantMappings) {
  const sourceBytes = value === fixture ? new Uint8Array(fixtureBytes) : new TextEncoder().encode(JSON.stringify(value));
  return buildGauntletMatchImportArtifact({
    sourceBytes,
    source: { filename: "gauntlet-para-match-v2.json", mediaType: "application/json" },
    metadata: { sessionCode: "S0-GAUNTLET-1", seasonCode: "S0" },
    participantMappings: mappings,
    leaguePlayers,
  });
}

function rehash(value) {
  value.verification.contentHash = computeGauntletContentHash(value);
  return value;
}

test("the producer-generated fixture validates and maps directly into Para canonical evidence", () => {
  const first = artifact();
  const second = artifact();
  assert.equal(first.validationReport.valid, true);
  assert.deepEqual(first.validationReport.errors, []);
  assert.equal(first.manifest.sourceIdentity.application, "gauntlet-online");
  assert.equal(first.manifest.sourceIdentity.sourceContractVersion, "gauntlet.para-match.v2");
  assert.equal(first.manifest.sourceContract.evidenceSchemaVersion, "gauntlet.league-evidence.v1");
  assert.equal(first.sourceChecksum, second.sourceChecksum);
  assert.equal(first.manifestChecksum, second.manifestChecksum);
  assert.equal(first.manifest.actions.length, fixture.evidence.entries.length);
  assert.equal(first.manifest.publicEvents[2].eventType, "attack.declared");
  assert.equal(first.manifest.sessionResults[0].finish, 1);
  assert.deepEqual(JSON.parse(first.manifest.notableHands[0].rawResult), first.manifest.authorityConsequences.recapEvidence);
});

test("account identities require explicit stable mapping while AI and guests never create fake humans", () => {
  const unmapped = artifact(fixture, {});
  assert.equal(unmapped.validationReport.valid, false);
  assert.deepEqual(unmapped.validationReport.unresolvedPlayerMappings.map((row) => row.sourcePlayerId), Object.keys(participantMappings));

  const campaignLike = structuredClone(fixture);
  campaignLike.participants[1].identityType = "ai";
  campaignLike.participants[1].gauntletAccountId = null;
  rehash(campaignLike);
  const ai = artifact(campaignLike, { [campaignLike.participants[0].participantId]: participantMappings[campaignLike.participants[0].participantId] });
  assert.equal(ai.validationReport.valid, true);
  assert.equal(ai.manifest.players.length, 1);
  assert.equal(ai.manifest.sessionResults.length, 1);
  assert.ok(ai.manifest.sourceParticipants.some((participant) => participant.identityType === "ai"));

  const guestMatch = structuredClone(campaignLike);
  guestMatch.participants[1].identityType = "guest";
  rehash(guestMatch);
  const guest = artifact(guestMatch, { [guestMatch.participants[0].participantId]: participantMappings[guestMatch.participants[0].participantId] });
  assert.equal(guest.validationReport.valid, true);
  assert.ok(guest.validationReport.warnings.some((warning) => warning.includes("source-only")));
});

test("contradictory outcomes, reordered evidence, wrong producer, and tampering fail closed", () => {
  const contradiction = structuredClone(fixture);
  contradiction.results.participants[0].result = "loss";
  rehash(contradiction);
  assert.ok(artifact(contradiction).validationReport.errors.some((error) => error.includes("contradicts")));

  const reordered = structuredClone(fixture);
  [reordered.evidence.entries[0], reordered.evidence.entries[1]] = [reordered.evidence.entries[1], reordered.evidence.entries[0]];
  rehash(reordered);
  assert.ok(artifact(reordered).validationReport.errors.some((error) => error.includes("contiguous")));

  const wrongProducer = structuredClone(fixture);
  wrongProducer.source.producerId = "not-gauntlet";
  rehash(wrongProducer);
  assert.ok(artifact(wrongProducer).validationReport.errors.some((error) => error.includes("authoritative Gauntlet")));

  const tampered = structuredClone(fixture);
  tampered.recapEvidence.damageDealt += 1;
  assert.ok(artifact(tampered).validationReport.errors.includes("Gauntlet content hash is invalid."));
});

test("the adapter preserves every ordered action, result, provenance field, and factual recap input", () => {
  const result = artifact();
  assert.deepEqual(result.manifest.actions.map((row) => row.logOrder), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(result.manifest.actions.map((row) => row.eventId), fixture.evidence.entries.map((entry) => entry.eventId));
  assert.equal(result.manifest.actions.find((row) => row.action === "damage.dealt").amount, 8);
  assert.deepEqual(result.manifest.authorityConsequences.gauntletResults, fixture.results);
  assert.deepEqual(result.manifest.authorityConsequences.recapEvidence, fixture.recapEvidence);
  assert.deepEqual(result.manifest.authorityConsequences.provenance, fixture.source);
  assert.equal(result.manifest.session.resultReviewStatus, "awaiting_result_review");
});
