export const DEFAULT_ARTICLE_CONTEXT_SELECTION = {
  sessionIds: [],
  playerIds: [],
  momentIds: [],
  includeStandings: true,
  includeRecentSessions: false,
  includeTopMoments: false,
  handRefs: [],
  editorNotes: "",
  angle: "",
  evidenceMode: "selected",
};

const EVIDENCE_MODES = new Set(["selected", "selected_plus_recent", "broad"]);

function arrayOfText(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function booleanValue(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  return fallback;
}

export function normalizeArticleContextSelection(input = {}) {
  const value = input && typeof input === "object" ? input : {};
  const evidenceMode = String(value.evidenceMode || value.evidence_mode || DEFAULT_ARTICLE_CONTEXT_SELECTION.evidenceMode);

  return {
    sessionIds: arrayOfText(value.sessionIds || value.session_ids),
    playerIds: arrayOfText(value.playerIds || value.player_ids),
    momentIds: arrayOfText(value.momentIds || value.moment_ids),
    includeStandings: booleanValue(value.includeStandings ?? value.include_standings, DEFAULT_ARTICLE_CONTEXT_SELECTION.includeStandings),
    includeRecentSessions: booleanValue(
      value.includeRecentSessions ?? value.include_recent_sessions,
      DEFAULT_ARTICLE_CONTEXT_SELECTION.includeRecentSessions
    ),
    includeTopMoments: booleanValue(value.includeTopMoments ?? value.include_top_moments, DEFAULT_ARTICLE_CONTEXT_SELECTION.includeTopMoments),
    handRefs: arrayOfText(value.handRefs || value.hand_refs),
    editorNotes: String(value.editorNotes || value.editor_notes || ""),
    angle: String(value.angle || ""),
    evidenceMode: EVIDENCE_MODES.has(evidenceMode) ? evidenceMode : DEFAULT_ARTICLE_CONTEXT_SELECTION.evidenceMode,
  };
}

export function summarizeArticleContextSelection(selectionInput = {}) {
  const selection = normalizeArticleContextSelection(selectionInput);

  return {
    evidence_mode: selection.evidenceMode,
    selected_sessions: selection.sessionIds.length,
    selected_players: selection.playerIds.length,
    selected_moments: selection.momentIds.length,
    selected_hand_refs: selection.handRefs.length,
    includes_standings: selection.includeStandings,
    includes_recent_sessions: selection.includeRecentSessions || selection.evidenceMode !== "selected",
    includes_top_moments: selection.includeTopMoments || selection.evidenceMode === "broad",
    angle: selection.angle,
    has_editor_notes: Boolean(selection.editorNotes.trim()),
  };
}
