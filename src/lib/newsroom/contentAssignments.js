export const contentAssignments = {
  player_profile: {
    id: "player-profile-assignment-v1",
    title: "Player Profile Assignment",
    role: "Write a public Para League player profile draft from verified data.",
    outputShape: [
      "headline: player-facing identity line",
      "subheadline: current public record in one sentence",
      "profile_body: 3-5 paragraphs of profile prose",
      "player_blurbs: short labeled notes",
      "admin_notes: what needs review",
    ],
    rules: [
      "Make the player proud to share it.",
      "Do not invent style, motive, emotion, rivalry, or private scouting.",
      "Use early-sample language when data is thin.",
    ],
    defaultVariation: "shareable_profile",
    variations: [
      {
        key: "shareable_profile",
        label: "Shareable profile",
        instruction:
          "Write the public identity version: polished, concise, and player-facing. Lead with what the player has earned or shown, then explain what is still early.",
      },
      {
        key: "result_first",
        label: "Result first",
        instruction:
          "Lead from rank, points, finish, or biggest verified result. Use the numbers as the doorway into the player story, not as the story itself.",
      },
      {
        key: "signature_moment_led",
        label: "Signature moment led",
        instruction:
          "Open from the strongest supplied moment or pot, then connect it back to the player's wider preseason identity. If no meaningful moment is supplied, say that plainly in admin notes.",
      },
      {
        key: "early_file",
        label: "Early file",
        instruction:
          "Use restrained early-sample language. Make the player feel legitimate without pretending the record is complete.",
      },
    ],
  },
  player_session_recap: {
    id: "player-session-recap-assignment-v1",
    title: "Player Session Recap Assignment",
    role: "Write a public recap of one player's lane through one session.",
    outputShape: [
      "headline: player plus session angle",
      "subheadline: finish/result and strongest supplied evidence",
      "article_body: 3-5 paragraphs",
      "key_takeaways: concise player-facing takeaways",
    ],
    rules: [
      "Keep it public, not private coaching.",
      "Respect losing sessions.",
      "Do not invent mistakes, emotions, or strategic intent.",
    ],
    defaultVariation: "moment_led",
    variations: [
      {
        key: "moment_led",
        label: "Moment led",
        instruction:
          "Start from the player's most meaningful supplied hand or sequence, then show how it affected their session line.",
      },
      {
        key: "winner_lane",
        label: "Winner lane",
        instruction:
          "If the player won, write the earned-winner version: result, turning point, and why the finish stands. If the player did not win, use this only as contrast.",
      },
      {
        key: "resistance_lane",
        label: "Resistance lane",
        instruction:
          "For a non-winner, focus on verified resistance: late pots, pressure, survival, or meaningful involvement. Do not turn a loss into a fake victory.",
      },
      {
        key: "next_session_setup",
        label: "Next-session setup",
        instruction:
          "Frame the session as a public record marker that sets up what the next session can confirm or challenge.",
      },
    ],
  },
  standings_summary: {
    id: "standings-summary-assignment-v1",
    title: "Standings Summary Assignment",
    role: "Write a public standings summary from approved standings data.",
    outputShape: [
      "headline: current standings angle",
      "subheadline: leader and chase line",
      "article_body: compact standings prose",
      "key_takeaways: 3-5 standings notes",
    ],
    rules: [
      "Do not invent movement, streaks, clinches, or qualification stakes.",
      "Explain rank and points in plain league terms.",
    ],
    defaultVariation: "leaderboard_snapshot",
    variations: [
      {
        key: "leaderboard_snapshot",
        label: "Leaderboard snapshot",
        instruction:
          "Write the clean standings version: who leads, who is next, and what the current board says without inventing movement.",
      },
      {
        key: "chase_line",
        label: "Chase line",
        instruction:
          "Emphasize the gap between leader and closest challengers using only supplied points and ranks.",
      },
      {
        key: "first_marker",
        label: "First marker",
        instruction:
          "Use this for early-season tables. Keep the language provisional but make the first standings line feel meaningful.",
      },
      {
        key: "movement_watch",
        label: "Movement watch",
        instruction:
          "Use only if before/after standings or prior ranks are supplied. If movement data is missing, keep movement claims in admin warnings.",
      },
    ],
  },
  moment_blurb: {
    id: "moment-blurb-assignment-v1",
    title: "Moment Blurb Assignment",
    role: "Write a short public blurb explaining one detected hand or moment.",
    outputShape: [
      "headline: role of the moment",
      "subheadline: hand/winner/pot if supplied",
      "article_body: 1-2 short paragraphs",
      "key_takeaways: why it mattered",
    ],
    rules: [
      "Do not invent action, bluffs, reads, emotion, or rivalry.",
      "Do not overstate small pots.",
      "Keep it sharp and player-facing.",
    ],
    defaultVariation: "impact_blurb",
    variations: [
      {
        key: "impact_blurb",
        label: "Impact blurb",
        instruction:
          "Explain why the moment mattered in one clear public beat: pot, winner, consequence, and session/player meaning if supplied.",
      },
      {
        key: "recap_card",
        label: "Recap card",
        instruction:
          "Write a compact card-style version with a strong headline and short body. Keep it punchy and not overexplained.",
      },
      {
        key: "player_facing",
        label: "Player-facing",
        instruction:
          "Write it as a player would want to see it attached to their public record, while staying factual and respectful to opponents.",
      },
      {
        key: "quiet_marker",
        label: "Quiet marker",
        instruction:
          "Use restrained language for smaller or less decisive moments. Do not inflate the hand beyond the supplied facts.",
      },
    ],
  },
  league_article: {
    id: "league-article-assignment-v1",
    title: "League Article Assignment",
    role: "Write a broader Para League article from the editorial request and structured data.",
    outputShape: [
      "headline: specific article angle",
      "subheadline: why this article exists now",
      "article_body: public article prose",
      "key_takeaways: main public takeaways",
    ],
    rules: [
      "Use supplied data as the story engine.",
      "Put missing information in admin notes, not the article body.",
      "Do not invent news, quotes, rivalry, or future events.",
    ],
    defaultVariation: "beat_report",
    variations: [
      {
        key: "beat_report",
        label: "Beat report",
        instruction:
          "Write like a league beat note: specific, direct, grounded, and readable as public coverage.",
      },
      {
        key: "digest",
        label: "Digest",
        instruction:
          "Write a compact multi-item digest if the request covers multiple players, moments, or standings notes.",
      },
      {
        key: "feature_angle",
        label: "Feature angle",
        instruction:
          "Write the most article-like version with a clear angle and measured narrative flow. Do not invent quotes or behind-the-scenes context.",
      },
      {
        key: "preview_setup",
        label: "Preview setup",
        instruction:
          "Use only when the article request asks for a preview. Discuss what is known and what is upcoming without inventing future outcomes.",
      },
    ],
  },
};

export function getContentAssignment(type) {
  return contentAssignments[type] || null;
}

export function getVariationOptions(type) {
  return getContentAssignment(type)?.variations || [];
}

export function getSelectedVariation(type, requestedKey = "") {
  const assignment = getContentAssignment(type);
  if (!assignment) return null;

  const requested = String(requestedKey || "").trim();
  return (
    assignment.variations.find((variation) => variation.key === requested) ||
    assignment.variations.find((variation) => variation.key === assignment.defaultVariation) ||
    assignment.variations[0] ||
    null
  );
}
