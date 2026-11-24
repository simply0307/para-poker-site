export function candidateFromMatch(input) {
  const record = input.match || input;
  if (typeof record.matchId !== "string" || !Array.isArray(input.participants || record.participants)) throw new Error("Choose a SuitFire match export.");
  const players = (input.participants || record.participants).slice(0, 2).map(p => ({
    name: String(p.displayName || p.name || "Unknown Vanguard").slice(0, 100),
    faction: String(p.faction?.name || (typeof p.faction === "string" ? p.faction : "")).slice(0, 100),
    result: ["win","loss","draw"].includes(p.result) ? p.result : null,
    life: Number.isFinite(p.finalLife) ? p.finalLife : null,
  }));
  const start = Date.parse(record.startedAt);
  const end = Date.parse(record.completedAt);
  return { id: record.matchId.slice(0,100), game: "SuitFire", title: players.map(p=>p.name).join(" vs. "),
    finished: Number.isFinite(end) && !record.abandonmentReason && !['abandoned','cancelled'].includes(record.completionReason) && !["pending","abandoned","cancelled"].includes(record.completion?.status) && (record.completion?.status === "finalized" || players.some(p => p.result)),
    durationMs: Number.isFinite(end-start) && end >= start ? end-start : null,
    date: Number.isFinite(end) ? new Date(end).toISOString() : null,
    opposition: (input.participants || record.participants).some(p => p.identityType==="ai" || p.identityType==="bot") ? "AI opponent" : (input.participants || record.participants).length===2 && (input.participants || record.participants).every(p=>["account","guest","human","player"].includes(p.identityType)) ? "Human opponents" : "Opponent type unconfirmed",
    decisiveTurn: Number.isInteger(record.notableMoments?.decisiveTurn) ? record.notableMoments.decisiveTurn : null,
    damageDealt: Number.isFinite(record.combatStats?.totalDamageDealt) ? record.combatStats.totalDamageDealt : null,
    largestAttack: Number.isFinite(record.combatStats?.largestAttack?.value) ? record.combatStats.largestAttack.value : null,
    turns: Number.isInteger(record.turnCount) ? record.turnCount : null, players };
}

export function matchesFilters(row, game, finished, long) {
  return (game === "All" || row.game === game) && (!finished || row.finished === true) && (!long || row.durationMs > 60000);
}
