import { getDraftType, getDraftVariation, getDraftVariationOptions } from "@/lib/newsroom/draftTypes";

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
      "Make the player want to share it.",
      "Fragments, rhythm, and dossier-style attitude are allowed.",
      "Do not invent hands, results, actions, quotes, emotions, rivalries, or private scouting.",
    ],
    defaultVariation: "shareable_profile",
    variations: [
      {
        key: "shareable_profile",
        label: "Shareable profile",
        instruction:
          "Write the public identity version: polished, punchy, and player-facing. Lead with the cleanest earned fact and make it feel like the player's first page.",
      },
      {
        key: "result_first",
        label: "Result first",
        instruction:
          "Lead from rank, points, finish, or biggest verified result. Use the numbers like a match strike, not a spreadsheet.",
      },
      {
        key: "signature_moment_led",
        label: "Signature moment led",
        instruction:
          "Open from the strongest supplied moment or pot, then make the profile snap into focus. If no meaningful moment is supplied, say that plainly in admin notes.",
      },
      {
        key: "early_file",
        label: "Early file",
        instruction:
          "Use early-sample language with edge. The player can feel real without being crowned.",
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
      "Do not invent mistakes, cards, emotions, quotes, or strategic intent.",
    ],
    defaultVariation: "moment_led",
    variations: [
      {
        key: "moment_led",
        label: "Moment led",
        instruction:
          "Start from the player's most meaningful supplied hand or sequence. Let the pot, result, and finish do the talking.",
      },
      {
        key: "winner_lane",
        label: "Winner lane",
        instruction:
          "If the player won, write the earned-winner version with punch: result, turning point, and the hand or line that makes it stick.",
      },
      {
        key: "resistance_lane",
        label: "Resistance lane",
        instruction:
          "For a non-winner, focus on verified resistance: late pots, pressure, survival, or meaningful involvement. Make the loss worthy without making it fake.",
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
          "Write the current-board version: who owns the first line, who owns the chase, and why the board is no longer blank.",
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
          "Use this for early-season tables. Make the first standings line feel sharp without pretending it is final.",
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
      "Keep it sharp, player-facing, and memorable.",
    ],
    defaultVariation: "impact_blurb",
    variations: [
      {
        key: "impact_blurb",
        label: "Impact blurb",
        instruction:
          "Explain why the moment mattered in one sharp public beat: pot, winner, consequence, and the dent it left on the session if supplied.",
      },
      {
        key: "recap_card",
        label: "Recap card",
        instruction:
          "Write a compact card-style version with a strong headline and short body. Make it hit fast.",
      },
      {
        key: "player_facing",
        label: "Player-facing",
        instruction:
          "Write it as a player would want to see it attached to their public record. Cool for the winner, respectful to the opponent.",
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
          "Write a current league beat report from the supplied data. Lead with the newest verified development and give it newsroom bite without declaring the race over.",
      },
      {
        key: "feature_angle",
        label: "Feature angle",
        instruction:
          "Write a focused feature-style article around one supplied angle, player, session, or standings thread. Do not invent quotes, motives, rivalries, or completed-season conclusions.",
      },
      {
        key: "preseason_context",
        label: "Preseason context",
        instruction:
          "Use ongoing-season language. Frame results as early signals, opening markers, and current table shape. Do not write as if the preseason is complete.",
      },
      {
        key: "player_race",
        label: "Player race",
        instruction:
          "Use only current standings data. Do not say anyone has clinched, locked, closed, or finished unless qualification data is explicitly supplied.",
      },
      {
        key: "weekly_digest",
        label: "Weekly digest",
        instruction:
          "Summarize current approved beats from the available data. If only one session or limited data is supplied, say this is a short current update, not a full week in review.",
      },
      {
        key: "preview_setup",
        label: "Preview setup",
        instruction:
          "Set up an upcoming session, player watch, or standings question using only supplied schedule/context. Do not predict outcomes or imply the race is settled.",
      },
    ],
  },
  social_caption: {
    id: "social-caption-assignment-v1",
    title: "Social Caption Assignment",
    role: "Write short Para League social/card copy from verified league data.",
    outputShape: [
      "headline: internal card label",
      "subheadline: concise context line",
      "caption: primary social caption",
      "alt_caption: alternate caption with different rhythm",
      "card_text: short on-image/card copy",
      "platform_variants: short variants for social surfaces",
      "confidence_notes: admin review notes",
      "missing_data_warnings: missing context warnings",
    ],
    rules: [
      "Make it fast, player-facing, and shareable.",
      "Punch, humor, and attitude are allowed when grounded by facts.",
      "Do not invent hands, quotes, emotions, rivalries, or season outcomes.",
      "Roast or coach/private tones are admin-only unless explicitly published later.",
    ],
    defaultVariation: "recap_card",
    variations: [
      {
        key: "recap_card",
        label: "Recap card",
        instruction:
          "Write a compact public card caption around the strongest supplied result, pot, player, or moment. Make it hit quickly.",
      },
      {
        key: "winner_post",
        label: "Winner post",
        instruction:
          "Center the winner and the cleanest verified reason the win matters. Cool, clipped, and shareable.",
      },
      {
        key: "moment_post",
        label: "Moment post",
        instruction:
          "Center one supplied hand or moment. Include hand number, pot, winner, or consequence when supplied.",
      },
      {
        key: "standings_post",
        label: "Standings post",
        instruction:
          "Write a current-board caption. Treat standings as live and provisional unless the supplied data says otherwise.",
      },
      {
        key: "sporting_roast_admin",
        label: "Sporting roast admin",
        instruction:
          "Use playful sports edge for admin review only. No personal insults, no private information, no unsupported weakness claims.",
      },
    ],
  },
  private_note: {
    id: "private-note-assignment-v1",
    title: "Private/Admin Note Assignment",
    role: "Write an admin-only Para League note from verified data. This is not public copy.",
    outputShape: [
      "headline: internal note label",
      "subheadline: concise scope/context",
      "private_body: admin-only note body",
      "review_points: specific review bullets",
      "public_safe_summary: optional public-safe one-liner",
      "confidence_notes: admin review notes",
      "missing_data_warnings: missing context warnings",
    ],
    rules: [
      "Keep this admin-only by default.",
      "Technical notes must stay close to verified hand/action data.",
      "Coach notes may identify review questions but must not invent player intent.",
      "Roast notes may be playful, but not personal, cruel, or unsupported.",
      "Do not invent hands, actions, quotes, emotions, rivalries, or season outcomes.",
    ],
    defaultVariation: "coach_private",
    variations: [
      {
        key: "coach_private",
        label: "Coach private",
        instruction:
          "Write a private review note for editors/coaches. Use verified hands, actions, and results. Separate what is known from what needs review.",
      },
      {
        key: "technical_poker",
        label: "Technical poker",
        instruction:
          "Write a technical note grounded in chronological hand/action data. Avoid unsupported strategy conclusions; frame uncertain points as review questions.",
      },
      {
        key: "sporting_roast",
        label: "Sporting roast",
        instruction:
          "Write an admin-only playful roast. Keep it league-safe: no personal insults, no private info, no invented emotions, no unsupported weakness claims.",
      },
    ],
  },
};

export function getContentAssignment(type) {
  const assignment = contentAssignments[type] || null;
  const draftType = getDraftType(type);
  if (!assignment && !draftType) return null;
  return {
    ...(assignment || {}),
    ...(draftType || {}),
    defaultVariation: draftType?.defaultVariation || assignment?.defaultVariation,
    variations: draftType?.variations || assignment?.variations || [],
  };
}

export function getVariationOptions(type) {
  return getDraftVariationOptions(type);
}

export function getSelectedVariation(type, requestedKey = "") {
  return getDraftVariation(type, requestedKey);
}
