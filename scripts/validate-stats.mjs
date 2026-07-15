import assert from "node:assert/strict";
import {
  aggregatePlayerStats,
  derivePlayerSessionStatsFromRows,
  deriveSessionResultSuggestionsFromRows,
} from "../src/lib/stats/calculators.js";

const session = { id: "fixture-session", session_code: "S0-FIXTURE", season_code: "S0" };
const actions = [
  { session_id: session.id, hand_no: 1, hand_id: "hand-1", log_order: 1, street: "preflop", player_name: "Maven", action: "posts small blind", amount: 1, raw_entry: "\"Maven\" posts a small blind of 1" },
  { session_id: session.id, hand_no: 1, hand_id: "hand-1", log_order: 2, street: "preflop", player_name: "You", action: "posts big blind", amount: 2, raw_entry: "\"You\" posts a big blind of 2" },
  { session_id: session.id, hand_no: 1, hand_id: "hand-1", log_order: 3, street: "preflop", player_name: "Maven", action: "calls", amount: 1, raw_entry: "\"Maven\" calls 1" },
  { session_id: session.id, hand_no: 1, hand_id: "hand-1", log_order: 4, street: "preflop", player_name: "You", action: "raises", amount: 33, all_in: true, raw_entry: "\"You\" raises to 33 and goes all in" },
  { session_id: session.id, hand_no: 1, hand_id: "hand-1", log_order: 5, street: "preflop", player_name: "Maven", action: "calls", amount: 31, raw_entry: "\"Maven\" calls 31" },
  { session_id: session.id, hand_no: 1, hand_id: "hand-1", log_order: 6, street: "showdown", player_name: "Maven", action: "shows", raw_entry: "\"Maven\" shows a Jh, Ad." },
  { session_id: session.id, hand_no: 1, hand_id: "hand-1", log_order: 7, street: "showdown", player_name: "Maven", action: "collected", amount: 66, raw_entry: "\"Maven\" collected 66 from pot with High card" },
  { session_id: session.id, hand_no: 1, hand_id: "hand-1", log_order: 8, street: "showdown", player_name: "Maven", action: "wins", raw_entry: "\"Maven\" wins the match." },
  { session_id: session.id, hand_no: 2, hand_id: "hand-2", log_order: 9, street: "preflop", player_name: "Maven", action: "posts small blind", amount: 1, raw_entry: "\"Maven\" posts a small blind of 1" },
  { session_id: session.id, hand_no: 2, hand_id: "hand-2", log_order: 10, street: "preflop", player_name: "You", action: "posts big blind", amount: 2, raw_entry: "\"You\" posts a big blind of 2" },
  { session_id: session.id, hand_no: 2, hand_id: "hand-2", log_order: 11, street: "preflop", player_name: "Maven", action: "calls", amount: 1, raw_entry: "\"Maven\" calls 1" },
  { session_id: session.id, hand_no: 2, hand_id: "hand-2", log_order: 12, street: "preflop", player_name: "You", action: "raises", amount: 31, all_in: true, raw_entry: "\"You\" raises to 31 and goes all in" },
  { session_id: session.id, hand_no: 2, hand_id: "hand-2", log_order: 13, street: "preflop", player_name: "Maven", action: "folds", amount: 0, raw_entry: "\"Maven\" folds" },
  { session_id: session.id, hand_no: 2, hand_id: "hand-2", log_order: 14, street: "showdown", player_name: "You", action: "collected", amount: 33, raw_entry: "\"You\" collected 33 from pot" },
];
const hands = [
  { session_id: session.id, hand_no: 1, hand_id: "hand-1", winner_name: "Maven", pot_collected: 66, big_blind: 2, showdown: true },
  { session_id: session.id, hand_no: 2, hand_id: "hand-2", winner_name: "You", pot_collected: 33, showdown: false },
];
const stats = derivePlayerSessionStatsFromRows({ session, hands, actions });
const maven = stats.find((row) => row.player_name === "Maven");
const you = stats.find((row) => row.player_name === "You");

assert.ok(maven, "Maven stats must be derived from action evidence.");
assert.ok(you, "You stats must be derived from action evidence.");
assert.equal(maven.hands, 2, "Maven should have two tracked hands.");
assert.equal(maven.hands_won, 1, "Maven should have one hand win.");
assert.equal(maven.biggest_pot_won, 66, "Maven biggest pot should be the 66-chip hand.");
assert.equal(maven.biggest_pot_won_bb, 33, "Maven biggest normalized pot should be 33 BB.");
assert.equal(maven.total_collected_bb, 33, "Maven normalized collected total should be stored in BB.");
assert.equal(maven.vpip_pct, 100, "Maven voluntarily entered both fixture hands.");
assert.equal(you.pfr_pct, 100, "You raised preflop in both fixture hands.");

const mixedStoredIdStats = derivePlayerSessionStatsFromRows({
  session,
  hands: [
    { session_id: session.id, id: "stored-hand-1", hand_no: 1, hand_id: "source-hand-1", winner_name: "Maven", pot_collected: 66, showdown: true },
  ],
  actions: [
    { session_id: session.id, hand_id: "stored-hand-1", hand_no: 1, log_order: 1, street: "preflop", player_name: "Maven", action: "calls", amount: 1 },
    { session_id: session.id, hand_id: "stored-hand-1", hand_no: 1, log_order: 2, street: "showdown", player_name: "Maven", action: "collected", amount: 66 },
  ],
});
const mixedMaven = mixedStoredIdStats.find((row) => row.player_name === "Maven");
assert.equal(mixedMaven.hands, 1, "Stats must not double-count a hand when action rows and hand rows use different stored/source ids.");

const suggestions = deriveSessionResultSuggestionsFromRows({ session, sessionStats: stats, actions });
assert.equal(suggestions[0].player_name, "Maven", "Match winner line should make Maven the first suggested finisher.");

const aggregate = aggregatePlayerStats({
  seasonCode: "S0",
  sessions: [session],
  sessionStats: stats,
  sessionResults: [
    { session_id: session.id, player_name: "Maven", finish: 1, league_points: 10, approved: true },
    { session_id: session.id, player_name: "You", finish: 2, league_points: 7, approved: true },
  ],
});
const mavenSeason = aggregate.find((row) => row.player_name === "Maven");
assert.equal(mavenSeason.total_points, 10, "Season aggregate should include confirmed points.");
assert.equal(mavenSeason.wins, 1, "Season aggregate should include confirmed wins.");

console.log("Stats validation passed.");
