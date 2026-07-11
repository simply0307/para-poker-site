export const DRAFT_TYPES = [
  { key: "session_recap", label: "Session Recap", endpoint: "/api/recaps/generate", requiredSource: "sessionId" },
  { key: "player_profile", label: "Player Profile", endpoint: "/api/profiles/generate", requiredSource: "playerId" },
  { key: "player_session_recap", label: "Player Session Recap", endpoint: "/api/player-session-recaps/generate", requiredSource: "playerId + sessionId" },
  { key: "standings_summary", label: "Standings Summary", endpoint: "/api/standings/generate", requiredSource: "seasonCode" },
  { key: "moment_blurb", label: "Moment Blurb", endpoint: "/api/moments/generate", requiredSource: "momentId" },
  { key: "league_article", label: "League Article", endpoint: "/api/articles/generate", requiredSource: "articleRequest" },
  { key: "social_caption", label: "Social Caption", endpoint: "", requiredSource: "future" },
];

export const VOICE_MODES = [
  "Official Recap",
  "Hype Recap",
  "Player Dossier",
  "Moment Archive",
  "Standings Pulse",
  "Social Caption",
  "Coach/Private Note",
  "Sporting Roast",
  "Technical Poker Note",
];

export const INTENSITY_LEVELS = ["Restrained", "Balanced", "Punchy", "Mythic", "Roast"];

export const LENGTH_OPTIONS = ["short", "medium", "long"];

export const FORMAT_OPTIONS = [
  "recap_article",
  "profile_card",
  "archive_blurb",
  "standings_note",
  "news_article",
  "social_card",
  "technical_note",
];

export const AUDIENCE_OPTIONS = ["public_player", "public_league", "admin_editor", "coach_private", "social"];

export const COVERAGE_FOCUS_OPTIONS = [
  "winner",
  "runner-up",
  "biggest pot",
  "late hands",
  "standings impact",
  "player form",
  "specific hand numbers",
  "specific player",
  "notable moments",
  "recent form",
  "top finishes",
];

function list(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value).trim();
}

export function normalizePromptConfig(input = {}, fallbackDraftType = "session_recap") {
  const draftType = text(input.draftType || input.draft_type, fallbackDraftType);
  const voiceMode = text(input.voiceMode || input.voice_mode, "Official Recap");
  const intensity = text(input.intensity, "Balanced");
  const length = text(input.length, "medium");
  const format = text(input.format, "recap_article");
  const audience = text(input.audience, "public_league");
  const coverageFocus = list(input.coverageFocus || input.coverage_focus);
  const mustMention = list(input.mustMention || input.requiredFacts || input.must_mention || input.required_facts);
  const avoid = list(input.avoid || input.avoidedTopics || input.avoided_topics);
  const customInstruction = text(input.customInstruction || input.custom_instruction);

  return {
    draftType,
    voiceMode,
    intensity,
    coverageFocus,
    mustMention,
    avoid,
    length,
    format,
    audience,
    customInstruction,
  };
}

export function buildPromptConfigInstructions(promptConfig = {}) {
  const config = normalizePromptConfig(promptConfig);
  return [
    `Draft type: ${config.draftType}`,
    `Voice mode: ${config.voiceMode}`,
    `Intensity: ${config.intensity}`,
    `Audience: ${config.audience}`,
    `Length: ${config.length}`,
    `Format: ${config.format}`,
    config.coverageFocus.length ? `Coverage focus: ${config.coverageFocus.join(", ")}` : "",
    config.mustMention.length ? `Required facts to mention if supplied: ${config.mustMention.join(", ")}` : "",
    config.avoid.length ? `Avoid: ${config.avoid.join(", ")}` : "",
    config.customInstruction ? `Custom instruction: ${config.customInstruction}` : "",
    "Prompt config controls voice, emphasis, length, and format. It must not alter, invent, or override source facts.",
  ].filter(Boolean);
}

export function buildPromptConfigContext(input = {}, fallbackDraftType = "session_recap") {
  const promptConfig = normalizePromptConfig(input, fallbackDraftType);
  return {
    prompt_config: promptConfig,
    prompt_config_instructions: buildPromptConfigInstructions(promptConfig),
  };
}
