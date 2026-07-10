export const sessionRecapDraftSchema = {
  name: "para_session_recap_draft",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "headline",
      "subheadline",
      "recap_body",
      "key_moments",
      "player_blurbs",
      "confidence_notes",
      "missing_data_warnings",
    ],
    properties: {
      headline: { type: "string" },
      subheadline: { type: "string" },
      recap_body: { type: "string" },
      primary_angle: { type: "string" },
      supporting_angles: {
        type: "array",
        items: { type: "string" },
      },
      story_plan: {
        type: "object",
        additionalProperties: false,
        properties: {
          primary_result: { type: "string" },
          main_character: { type: "string" },
          strongest_non_winner_note: { type: "string" },
          turning_point: { type: "string" },
          session_texture: { type: "string" },
          pressure_sequence: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                hand_no: { type: "string" },
                winner_name: { type: "string" },
                pot_text: { type: "string" },
                role: { type: "string" },
              },
            },
          },
          what_changed: { type: "string" },
          what_not_to_overstate: {
            type: "array",
            items: { type: "string" },
          },
          missing_context: {
            type: "array",
            items: { type: "string" },
          },
          recommended_angle: { type: "string" },
        },
      },
      admin_notes: {
        type: "array",
        items: { type: "string" },
      },
      key_moments: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "hand_no", "summary", "why_it_mattered"],
          properties: {
            title: { type: "string" },
            hand_no: { type: ["string", "number", "null"] },
            summary: { type: "string" },
            why_it_mattered: { type: "string" },
          },
        },
      },
      player_blurbs: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["player_name", "blurb"],
          properties: {
            player_name: { type: "string" },
            blurb: { type: "string" },
          },
        },
      },
      confidence_notes: {
        type: "array",
        items: { type: "string" },
      },
      missing_data_warnings: {
        type: "array",
        items: { type: "string" },
      },
    },
  },
  strict: true,
};

export const profileDraftSchema = {
  name: "para_player_profile_draft",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["headline", "subheadline", "profile_body", "player_blurbs", "confidence_notes", "missing_data_warnings"],
    properties: {
      headline: { type: "string" },
      subheadline: { type: "string" },
      profile_body: { type: "string" },
      player_blurbs: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "body"],
          properties: {
            label: { type: "string" },
            body: { type: "string" },
          },
        },
      },
      confidence_notes: { type: "array", items: { type: "string" } },
      missing_data_warnings: { type: "array", items: { type: "string" } },
    },
  },
  strict: true,
};

export const articleDraftSchema = {
  name: "para_article_draft",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["headline", "subheadline", "article_body", "key_takeaways", "confidence_notes", "missing_data_warnings"],
    properties: {
      headline: { type: "string" },
      subheadline: { type: "string" },
      article_body: { type: "string" },
      key_takeaways: { type: "array", items: { type: "string" } },
      confidence_notes: { type: "array", items: { type: "string" } },
      missing_data_warnings: { type: "array", items: { type: "string" } },
    },
  },
  strict: true,
};

export function validateDraftShape(value, requiredKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return ["AI response was not a JSON object."];
  }

  return requiredKeys.filter((key) => !(key in value)).map((key) => `Missing required key: ${key}`);
}
