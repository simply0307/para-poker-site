export const DEFAULT_LEAGUE_RULES = {
  seasonCode: "S0",
  name: "S0 preseason rules",
  pointsByFinish: {
    1: 10,
    2: 7,
    3: 5,
    4: 3,
    5: 2,
    6: 1,
  },
  participationPoints: 0,
  minimumHandsForPoints: 0,
  tiebreakers: ["wins", "best_finish", "avg_finish"],
  importRules: {
    duplicateSessionPolicy: "block",
    csvPreferred: true,
    rawTextFallback: true,
  },
};
