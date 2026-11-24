export function matchRecord(row) {
  const players = row.participants || [];
  if (players.length !== 2 || players.some(player => player.identityType === "ai") || row.campaign) return null;
  return {
    sessionId: row.session_id, revisionId: row.id, matchId: row.matchId,
    season: row.season, playedAt: row.playedAt, format: row.format,
    players: players.map(({ participantId, playerNum, displayName, result, finalLife, faction }) => ({
      id: row.mappings?.find(mapping => mapping.sourcePlayerId === participantId)?.leaguePlayerId || null,
      seat: playerNum, name: displayName, result, finalLife, faction: faction?.name || null,
    })),
    decisiveTurn: row.decisiveTurn, largestAttack: row.largestAttack,
  };
}

export function seasonRecords(matches) {
  const records = new Map();
  for (const match of matches) {
    for (const player of match.players) {
      if (!player.id) continue;
      const record = records.get(player.id) || { id: player.id, name: player.name, win: 0, loss: 0, draw: 0 };
      if (["win", "loss", "draw"].includes(player.result)) record[player.result]++;
      records.set(player.id, record);
    }
  }
  return [...records.values()].sort((a, b) => b.win - a.win || a.loss - b.loss || a.name.localeCompare(b.name));
}

export function storyHistory(match, matches) {
  return matches.filter(other => other.season === match.season && other.sessionId !== match.sessionId &&
    Date.parse(other.playedAt) < Date.parse(match.playedAt)).slice(0, 12)
    .map(({ matchId, playedAt, players }) => ({ matchId, playedAt, players }));
}
