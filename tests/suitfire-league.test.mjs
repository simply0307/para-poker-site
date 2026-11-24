import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { matchRecord, seasonRecords, storyHistory } from "../src/lib/suitfire/records.mjs";

const source = JSON.parse(readFileSync(new URL("./fixtures/gauntlet-para-match-v2.json", import.meta.url)));
const row = { id: "rev", session_id: "session", season: "S0", playedAt: source.match.completedAt,
  matchId: source.match.matchId, participants: source.participants,
  mappings: source.participants.map(p => ({ sourcePlayerId: p.participantId, leaguePlayerId: "league-" + p.playerNum })) };

test("human duel records use mapped player identity and source outcomes", () => {
  const match = matchRecord(row);
  assert.deepEqual(seasonRecords([match]).map(p => [p.id, p.win, p.loss]), [["league-1", 1, 0], ["league-2", 0, 1]]);
  assert.equal(matchRecord({ ...row, campaign: { id: "encounter" } }), null);
  assert.equal(matchRecord({ ...row, participants: [row.participants[0], { ...row.participants[1], identityType: "ai" }] }), null);
  assert.equal(seasonRecords([matchRecord({ ...row, mappings: [] })]).length, 0);
});

test("season arcs omit the current match, future results and other seasons", () => {
  const match = matchRecord(row);
  const prior = { ...match, playedAt: "2020-01-01", sessionId: "other" };
  const history = storyHistory(match, [match, prior, { ...prior, season: "S1" }, { ...prior, playedAt: "2030-01-01" }]);
  assert.equal(history.length, 1);
  assert.equal(history[0].playedAt, prior.playedAt);
});
