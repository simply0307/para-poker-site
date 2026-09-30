function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function pointsForFinish(rules, finish) {
  const pointsByFinish = rules?.pointsByFinish || {};
  return Number(pointsByFinish[String(finish)] || 0) + Number(rules?.participationPoints || 0);
}

export function preserveAuthoritativeResultEvidence(existingResults = [], submittedResults = [], { rules = {} } = {}) {
  if (!existingResults.length) throw new Error("Authoritative result evidence is missing.");
  if (submittedResults.length !== existingResults.length) throw new Error("Authoritative result rows cannot be added or removed during approval.");
  const submittedByPlayerId = new Map(submittedResults.map((row) => [String(row.player_id || ""), row]));
  if (submittedByPlayerId.size !== existingResults.length || submittedByPlayerId.has("")) {
    throw new Error("Authoritative result approval requires each stable league player ID exactly once.");
  }
  return [...existingResults]
    .sort((left, right) => Number(left.finish) - Number(right.finish))
    .map((existing) => {
      const submitted = submittedByPlayerId.get(String(existing.player_id));
      if (!submitted
        || Number(submitted.finish) !== Number(existing.finish)
        || Number(submitted.final_stack || 0) !== Number(existing.final_stack || 0)
        || String(submitted.player_name || "") !== String(existing.player_name || "")) {
        throw new Error("Authoritative player, finish, and final-stack evidence cannot be changed during approval.");
      }
      return {
        ...existing,
        league_points: Number(submitted.league_points ?? submitted.points ?? pointsForFinish(rules, existing.finish)),
        notes: text(submitted.notes, existing.notes || ""),
        approved: true,
      };
    });
}
