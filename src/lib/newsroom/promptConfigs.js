export const DRAFT_TYPES = [
  { key: "session_recap", label: "Session Recap", endpoint: "/api/recaps/generate", requiredSource: "sessionId" },
  { key: "player_profile", label: "Player Profile", endpoint: "/api/profiles/generate", requiredSource: "playerId" },
  { key: "player_session_recap", label: "Player Session Recap", endpoint: "/api/player-session-recaps/generate", requiredSource: "playerId + sessionId" },
  { key: "standings_summary", label: "Standings Summary", endpoint: "/api/standings/generate", requiredSource: "seasonCode" },
  { key: "moment_blurb", label: "Moment Blurb", endpoint: "/api/moments/generate", requiredSource: "momentId" },
  { key: "league_article", label: "League Article", endpoint: "/api/articles/generate", requiredSource: "articleRequest" },
  { key: "social_caption", label: "Social Caption", endpoint: "/api/social-captions/generate", requiredSource: "sessionId/playerId/momentId" },
  { key: "private_note", label: "Private/Admin Note", endpoint: "/api/private-notes/generate", requiredSource: "sessionId/playerId/momentId" },
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

export const INTENSITY_LEVELS = ["Restrained", "Balanced", "Punchy", "Loud", "Mythic", "Roast"];

export const LENGTH_OPTIONS = ["short", "medium", "long"];

export const FORMAT_OPTIONS = [
  "recap",
  "recap_article",
  "profile_card",
  "archive_blurb",
  "standings_note",
  "news_article",
  "social_card",
  "social_caption",
  "technical_note",
  "private_note",
  "sporting_roast",
];

export const AUDIENCE_OPTIONS = ["public", "public_player", "public_league", "admin_editor", "coach_private", "social", "private_admin"];

export const COVERAGE_FOCUS_OPTIONS = [
  "winner",
  "runner-up",
  "rank",
  "points",
  "sessions",
  "biggest pot",
  "late hands",
  "standings impact",
  "player form",
  "specific hand numbers",
  "specific player",
  "notable moments",
  "notable hands",
  "recent form",
  "top finishes",
];

export const PROMPT_PRESETS = {
  official_session_recap: {
    draftType: "session_recap",
    voiceMode: "Official Recap",
    intensity: "Punchy",
    coverageFocus: ["winner", "biggest pot", "runner-up"],
    mustMention: [],
    avoid: ["generic sports filler", "too much myth"],
    length: "medium",
    format: "recap",
    audience: "public",
    customInstruction: "Write like a poker league recap, not a generic sports article.",
  },
  hype_session_recap: {
    draftType: "session_recap",
    voiceMode: "Hype Recap",
    intensity: "Loud",
    coverageFocus: ["winner", "biggest pot", "late hands", "notable moments"],
    mustMention: [],
    avoid: ["fake rivalry", "invented emotion", "generic sports filler"],
    length: "medium",
    format: "recap",
    audience: "public",
    customInstruction: "Let the table feel alive, but do not invent facts.",
  },
  player_dossier: {
    draftType: "player_profile",
    voiceMode: "Player Dossier",
    intensity: "Punchy",
    coverageFocus: ["rank", "points", "sessions", "recent form", "top finishes", "notable hands"],
    mustMention: [],
    avoid: ["database summary", "generic motivation", "fake scouting"],
    length: "medium",
    format: "profile_card",
    audience: "public_player",
    customInstruction: "Make this feel like a shareable player card, not a database summary.",
  },
  runner_up_dossier: {
    draftType: "player_profile",
    voiceMode: "Player Dossier",
    intensity: "Punchy",
    coverageFocus: ["runner-up", "recent form", "notable hands", "late hands"],
    mustMention: [],
    avoid: ["moral victory cliché", "fake emotion", "private scouting"],
    length: "medium",
    format: "profile_card",
    audience: "public_player",
    customInstruction: "Make the non-winner feel worthy when the verified record supports it.",
  },
  moment_archive_note: {
    draftType: "moment_blurb",
    voiceMode: "Moment Archive",
    intensity: "Punchy",
    coverageFocus: ["biggest pot", "specific hand numbers", "notable moments"],
    mustMention: [],
    avoid: ["unsupported hand action", "fake emotion", "overstating small pots"],
    length: "short",
    format: "archive_blurb",
    audience: "public_player",
    customInstruction: "Write a sharp public moment note with hand, pot, winner, and consequence when supplied.",
  },
  standings_pulse: {
    draftType: "standings_summary",
    voiceMode: "Standings Pulse",
    intensity: "Balanced",
    coverageFocus: ["rank", "points", "winner", "runner-up"],
    mustMention: [],
    avoid: ["clinched", "final standings", "season is over"],
    length: "short",
    format: "standings_note",
    audience: "public_league",
    customInstruction: "Make the board feel current and alive without pretending it is final.",
  },
  social_caption: {
    draftType: "social_caption",
    voiceMode: "Social Caption",
    intensity: "Loud",
    coverageFocus: ["winner", "biggest pot", "notable moments"],
    mustMention: [],
    avoid: ["too much explanation", "generic sports filler"],
    length: "short",
    format: "social_caption",
    audience: "social",
    customInstruction: "Make it hit fast.",
  },
  sporting_roast: {
    draftType: "private_note",
    voiceMode: "Sporting Roast",
    intensity: "Roast",
    coverageFocus: ["winner", "runner-up", "biggest pot", "notable moments"],
    mustMention: [],
    avoid: ["personal insults", "fake rivalry", "invented emotion"],
    length: "short",
    format: "sporting_roast",
    audience: "private_admin",
    customInstruction: "Use playful sports edge without making personal or unsupported claims.",
  },
  technical_poker_note: {
    draftType: "private_note",
    voiceMode: "Technical Poker Note",
    intensity: "Restrained",
    coverageFocus: ["specific hand numbers", "late hands", "notable hands"],
    mustMention: [],
    avoid: ["unsupported strategy claims", "private coaching language in public copy"],
    length: "medium",
    format: "technical_note",
    audience: "coach_private",
    customInstruction: "Stay close to verified hand/action data and separate technical notes from public prose.",
  },
  coach_private_note: {
    draftType: "private_note",
    voiceMode: "Coach/Private Note",
    intensity: "Balanced",
    coverageFocus: ["specific hand numbers", "player form", "notable hands"],
    mustMention: [],
    avoid: ["public-facing hype", "invented intent", "unsupported weakness claims"],
    length: "medium",
    format: "private_note",
    audience: "coach_private",
    customInstruction: "Write an admin-only review note grounded in available hand/action data. Keep it reviewable, not publish-ready.",
  },
};

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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getPromptPreset(key) {
  return clone(PROMPT_PRESETS[key] || PROMPT_PRESETS.official_session_recap);
}

export function getPromptPresetOptions() {
  return Object.entries(PROMPT_PRESETS).map(([key, preset]) => ({
    key,
    label: key
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    draftType: preset.draftType,
    voiceMode: preset.voiceMode,
  }));
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
    "Prompt config is the current creative brief. Honor it over broad docs when they conflict on tone, intensity, format, or emphasis.",
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
