import { supabase } from "@/lib/supabase";

const RECAP_TABLE_CANDIDATES = ["recap_artifacts", "recaps"];

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function cleanName(value) {
  return text(value, "Unknown Player").replace(/\s+@\s+\S+\s*$/u, "").trim();
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value, fallback = "0") {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString("en-US") : text(value, fallback);
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function ordinalText(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return "";
  const remainder = number % 100;
  if (remainder >= 11 && remainder <= 13) return `${number}th`;
  if (number % 10 === 1) return `${number}st`;
  if (number % 10 === 2) return `${number}nd`;
  if (number % 10 === 3) return `${number}rd`;
  return `${number}th`;
}

function phraseSeed(...values) {
  const seed = values.filter(Boolean).join("|") || "para-poker";
  return seed.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
}

function pickPhrase(options, ...seedValues) {
  if (!options.length) return "";
  return options[phraseSeed(...seedValues) % options.length];
}

function fact(id, label, value, sourceTable, sourceId, confidence = "high") {
  return {
    id,
    label,
    value: text(value, "-"),
    sourceTable,
    sourceId: sourceId ? String(sourceId) : "",
    confidence,
  };
}

function normalizeTags(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === "string") {
    return value.split(",").map((tag) => tag.trim()).filter(Boolean);
  }
  return [];
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(text(value));
}

function publicSessionHref(value) {
  const cleanValue = text(value).trim();
  if (!cleanValue || isUuid(cleanValue)) return "";
  return `/sessions-v2/${encodeURIComponent(cleanValue)}`;
}

function momentAnchor(handNo) {
  const cleanHand = text(handNo).replace(/[^a-z0-9-]+/giu, "-").replace(/^-|-$/g, "");
  return cleanHand ? `moment-hand-${cleanHand}` : "";
}

function cleanActionText(action) {
  const cleanAction = text(action).trim();
  if (!cleanAction) return "acts";
  return cleanAction;
}

function formatActionAmount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed.toLocaleString("en-US") : "";
}

function normalizeAction(action) {
  return {
    street: text(action.street, "action").toLowerCase(),
    playerName: cleanName(action.player_name),
    position: text(action.position),
    action: cleanActionText(action.action),
    amount: formatActionAmount(action.amount),
    allIn: Boolean(action.all_in),
    facedRaise: Boolean(action.faced_raise),
    faced3bet: Boolean(action.faced_3bet),
    isOpenRaise: Boolean(action.is_open_raise),
    is3bet: Boolean(action.is_3bet),
    isLimp: Boolean(action.is_limp),
    isCallVsRaise: Boolean(action.is_call_vs_raise),
    order: Number(action.log_order) || 0,
  };
}

function distinctNames(values = []) {
  return [...new Set(values.map(cleanName).filter((name) => name && name !== "Unknown Player"))];
}

function buildStrategicReview(actions = [], hand = {}) {
  const allIn = actions.find((action) => action.allIn);
  if (allIn) {
    return pickPhrase(
      [
        `${allIn.playerName} moved all-in on the ${allIn.street}, turning the hand into a stack-depth test. The review starts with the pot size, the players still in, and how much room was left after the shove.`,
        `${allIn.playerName}'s all-in on the ${allIn.street} is the pause point. From there, the hand was less about style and more about who still had enough room to choose cleanly.`,
        `Once ${allIn.playerName} was all-in on the ${allIn.street}, the hand asked a direct question. Check the stack pressure, the response order, and whether the shove created fold equity or simply forced a showdown.`,
      ],
      allIn.playerName,
      allIn.street,
      hand.hand_no
    );
  }

  const threeBet = actions.find((action) => action.is3bet || action.faced3bet);
  if (threeBet) {
    return pickPhrase(
      [
        `${threeBet.playerName} brought 3-bet pressure into the hand. Once the price moved past a simple open, initiative became the real story.`,
        `The 3-bet sequence is the clean review point. ${threeBet.playerName} changed the price, and everyone after that had to decide whether the hand was still worth carrying.`,
        `${threeBet.playerName}'s 3-bet marker turns this from a routine entry into a leverage spot. The useful question is who kept control once the pot got heavier.`,
      ],
      threeBet.playerName,
      threeBet.street,
      hand.hand_no
    );
  }

  const openRaise = actions.find((action) => action.isOpenRaise);
  const callVsRaise = actions.find((action) => action.isCallVsRaise);
  if (openRaise && callVsRaise) {
    return pickPhrase(
      [
        `${openRaise.playerName} opened and ${callVsRaise.playerName} came along against the raise. That is where the hand stopped being automatic and started asking about range, position, and price.`,
        `The first real hinge came preflop: ${openRaise.playerName} set the price, ${callVsRaise.playerName} accepted it, and the rest of the hand had to justify that choice.`,
        `${openRaise.playerName}'s open drew ${callVsRaise.playerName} into the pot. Review why the call made sense there and how quickly the hand became worth defending.`,
      ],
      openRaise.playerName,
      callVsRaise.playerName,
      hand.hand_no
    );
  }

  const streetBet = actions.find((action) => /bets|raises/i.test(action.action));
  if (streetBet) {
    return pickPhrase(
      [
        `${streetBet.playerName}'s ${streetBet.action}${streetBet.amount ? ` for ${streetBet.amount}` : ""} on the ${streetBet.street} is the review point. That is where the hand moved from record-keeping into decision pressure.`,
        `The key action is ${streetBet.playerName}'s ${streetBet.action}${streetBet.amount ? ` for ${streetBet.amount}` : ""} on the ${streetBet.street}. From there, every response had a price attached.`,
        `${streetBet.playerName} put chips back in on the ${streetBet.street}. That bet is the moment to study: who was being tested, and who still had the easier path?`,
      ],
      streetBet.playerName,
      streetBet.action,
      hand.hand_no
    );
  }

  if (hand.winner_name || hand.winnerName) {
    return `${cleanName(hand.winner_name || hand.winnerName)} collected the pot. The action record is thin, so the right read is simple: record the result and wait for a fuller hand file before drawing a lesson.`;
  }

  return "The available action record is limited. The recap can keep the moment on file, but the review should not invent a lesson the hand data does not support.";
}

function buildHandHistory(hand, actions = []) {
  const normalizedActions = actions
    .map(normalizeAction)
    .sort((left, right) => left.order - right.order);

  return {
    handNo: text(hand.hand_no || hand.handNo),
    potText: hand.pot_collected ? `${formatNumber(hand.pot_collected)} chips` : "",
    winnerName: cleanName(hand.winner_name || hand.winnerName),
    board: text(hand.board),
    winningHand: text(hand.winning_hand || hand.winningHand),
    showdown: Boolean(hand.showdown),
    actions: normalizedActions,
    reviewPoint: buildStrategicReview(normalizedActions, hand),
  };
}

async function safeQuery(query) {
  const { data, error } = await query;
  if (error) return null;
  return data;
}

function normalizeStoredArtifact(row, fallback = {}) {
  if (!row) return null;

  return {
    id: text(row.id, fallback.id),
    scope: text(row.scope, fallback.scope || "player"),
    status: text(row.status, "draft"),
    visibility: text(row.visibility, fallback.visibility || "public"),
    tone: text(row.tone, fallback.tone || "archive"),
    title: text(row.title, row.headline || fallback.title),
    headline: text(row.headline, row.title || fallback.headline),
    dek: text(row.dek, fallback.dek),
    summary: text(row.summary || row.short_summary, fallback.summary),
    short_summary: text(row.short_summary || row.summary, fallback.short_summary || fallback.summary),
    body: text(row.body || row.long_body, fallback.body),
    long_body: text(row.long_body || row.body, fallback.long_body || fallback.body),
    key_takeaways: Array.isArray(row.key_takeaways)
      ? row.key_takeaways.map(String)
      : fallback.key_takeaways || [],
    sourceSessionId: text(row.source_session_id, fallback.sourceSessionId),
    sourceHandIds: Array.isArray(row.source_hand_ids)
      ? row.source_hand_ids.map(String)
      : fallback.sourceHandIds || [],
    source_hand_ids: Array.isArray(row.source_hand_ids)
      ? row.source_hand_ids.map(String)
      : fallback.sourceHandIds || [],
    source_fact_ids: Array.isArray(row.source_fact_ids)
      ? row.source_fact_ids.map(String)
      : fallback.source_fact_ids || [],
    sourcePlayerId: text(row.source_player_id, fallback.sourcePlayerId),
    seasonCode: text(row.season_code, fallback.seasonCode),
    tags: normalizeTags(row.tags).length ? normalizeTags(row.tags) : fallback.tags || [],
    sourceFacts: Array.isArray(row.source_facts)
      ? row.source_facts
      : fallback.sourceFacts || [],
    createdAt: text(row.created_at, fallback.createdAt),
    updatedAt: text(row.updated_at, fallback.updatedAt),
    stored: true,
  };
}

export function formatRecapSourceFacts(sourceFacts = []) {
  return sourceFacts
    .filter((item) => item?.label)
    .map((item) => `${item.label}: ${item.value}`)
    .join("; ");
}

function sourceFactIds(sourceFacts = []) {
  return sourceFacts.map((item) => item.id).filter(Boolean);
}

function recapInput(scope, sourceFacts, context = {}) {
  return {
    scope,
    tone: context.tone || "player-facing league recap",
    guardrails: [
      "Use only the supplied source facts for factual claims.",
      "The data says what happened; the prose explains why it mattered.",
      "Do not invent cards, stacks, winners, finishes, standings movement, rivalries, player intent, emotions, or table talk.",
      "Write like a Para Poker league recap desk: sports momentum, poker broadcast awareness, player dignity, and light archive flavor only when earned.",
      "Answer what changed, who shaped the session beyond the winner, and why a player or reader should care.",
      "Avoid cold database phrasing, solver-heavy language, fake sportsbook hype, parody sports cliches, and fantasy prophecy.",
      "Vary phrasing. Do not repeatedly lean on stock lines like pressure built, table changed shape, every orbit mattered, left a mark, statement win, or archive remembers.",
      "Separate concise public narrative from optional evidence/details.",
    ],
    context,
    sourceFacts,
  };
}

export function buildMomentRecapInput(moment) {
  return recapInput("moment", buildMomentRecapFacts(moment), {
    title: text(moment.displayTitle || moment.title, "Moment"),
    tags: normalizeTags(moment.raw?.tags || moment.tags || moment.displayTags),
    tone: "public moment blurb with poker-aware consequence",
  });
}

export function buildPlayerRecapInput(profileData) {
  return recapInput("player", buildPlayerRecapFacts(profileData), {
    playerName: cleanName(profileData.playerName),
    seasonCode: text(profileData.seasonStatus?.seasonCode, "S0"),
    tone: "public player dossier, positive and identity-building",
  });
}

export function buildSessionRecapInput(input) {
  return recapInput("session", buildSessionRecapFacts(input), {
    sessionCode: text(input.session?.session_code, "Session"),
    seasonCode: text(input.session?.season_code, "S0"),
    tone: "longform public session recap with FotMob-style momentum",
  });
}

export async function getStoredRecapArtifact({ scope, sourceSessionId, sourcePlayerId, sourceHandIds = [] }) {
  // The production schema for reviewed/stored recap artifacts has not been
  // installed in this repo yet. Try likely table names and fail closed so UI can
  // render grounded fallback artifacts without requiring an immediate migration.
  for (const table of RECAP_TABLE_CANDIDATES) {
    let query = supabase.from(table).select("*").eq("scope", scope).limit(1);

    if (sourceSessionId) query = query.eq("source_session_id", sourceSessionId);
    if (sourcePlayerId) query = query.eq("source_player_id", sourcePlayerId);
    if (sourceHandIds.length) query = query.contains("source_hand_ids", sourceHandIds);

    const rows = await safeQuery(query);
    if (rows?.length) return normalizeStoredArtifact(rows[0], { scope });
  }

  return null;
}

export function buildMomentRecapFacts(moment) {
  const source = moment.raw || moment;
  const handId = text(source.hand_code || source.hand_id || moment.hand_code || moment.hand_id || moment.id);
  const handNo = text(source.hand_no || moment.hand_no || moment.handNo);
  const tags = normalizeTags(source.tags || moment.tags || moment.displayTags);

  return [
    handNo ? fact("hand_no", "Hand", `#${handNo}`, "notable_hands", source.id || moment.id) : null,
    source.session_id || moment.sourceSessionId
      ? fact("session", "Session ID", source.session_id || moment.sourceSessionId, "notable_hands", source.id || moment.id)
      : null,
    source.winner_name || moment.winner_name
      ? fact("winner", "Winner", cleanName(source.winner_name || moment.winner_name), "notable_hands", source.id || moment.id)
      : null,
    source.pot_collected || moment.pot_collected || moment.potText
      ? fact("pot", "Pot", `${formatNumber(source.pot_collected || moment.pot_collected || moment.potText)} chips`, "notable_hands", source.id || moment.id)
      : null,
    source.board || moment.board ? fact("board", "Board", source.board || moment.board, "notable_hands", source.id || moment.id) : null,
    tags.length ? fact("tags", "Tags", tags.join(", "), "notable_hands", source.id || moment.id) : null,
    handId ? fact("hand_id", "Source hand", handId, "hands", handId) : null,
  ].filter(Boolean);
}

export function buildMomentRecapArtifact(moment, storedArtifact = null) {
  const source = moment.raw || moment;
  const tags = normalizeTags(source.tags || moment.tags || moment.displayTags);
  const handNo = text(source.hand_no || moment.hand_no || moment.handNo);
  const winner = cleanName(source.winner_name || moment.winner_name || moment.winner || moment.player_name || "This player");
  const pot = source.pot_collected || moment.pot_collected || moment.potText;
  const numericPot = numberValue(pot, 0);
  const potText = numericPot ? `${formatNumber(numericPot)} chips` : "the pot";
  const sourceFacts = buildMomentRecapFacts(moment);
  const handHistory = moment.handHistory || null;
  const involvedPlayers = distinctNames([
    source.winner_name,
    moment.winner_name,
    source.player_name,
    moment.player_name,
    ...(handHistory?.actions || []).map((action) => action.playerName),
  ]).slice(0, 4);
  const hasAllIn = tags.includes("All-In Hand") || handHistory?.actions?.some((action) => action.allIn);
  const hasThreeBet = handHistory?.actions?.some((action) => action.is3bet || action.faced3bet);
  const momentRole = tags.includes("Season Biggest Pot")
    ? "Season Biggest Pot"
    : hasAllIn
      ? "Pressure Pot"
      : hasThreeBet
        ? "Opening Signal"
        : tags.includes("River Pot")
          ? "Late Answer"
          : tags.includes("Showdown")
            ? "Showdown Marker"
            : tags.includes("Large Pot") || numericPot >= 1000
              ? "Signature Pot"
              : "Archive Marker";
  const title = text(moment.displayTitle || moment.title, `${momentRole}${handNo ? `, Hand #${handNo}` : ""}`);
  const impactOptions = {
    "Season Biggest Pot": [
      `${winner} won ${potText}, the largest pot attached to this profile so far.`,
      `${potText} moved to ${winner}, giving the profile its clearest early swing.`,
      `${winner} collected the hand that sits at the top of this player's public pot record.`,
    ],
    "Pressure Pot": [
      `${winner} came through an all-in hand, adding a direct pressure result to the profile.`,
      `The chips went in here, and ${winner} finished the hand with the pot.`,
      `${winner} won a hand where the decision point was no longer small.`,
    ],
    "Opening Signal": [
      `${winner} won a hand where the early price changed before the pot was settled.`,
      `The preflop action gave this hand more shape than a routine entry, and ${winner} took the result.`,
      `${winner} ended the hand with the pot after initiative entered early.`,
    ],
    "Late Answer": [
      `${winner} won a later-street pot that keeps the hand visible in the profile.`,
      `The hand reached the river before ${winner} secured the result.`,
      `${winner} found the answer late and added another hand to the public file.`,
    ],
    "Showdown Marker": [
      `${winner} reached showdown and collected ${potText}.`,
      `This one matters because the hand made it to reveal, and ${winner} had the winner.`,
      `${winner} added a showdown result to the profile record.`,
    ],
    "Signature Pot": [
      `${winner} collected ${potText}, large enough to belong near the top of the profile moments.`,
      `${winner} won a pot with enough size to say something about the early file.`,
      `${potText} moved to ${winner}, giving the profile a real hand to point at.`,
    ],
    "Archive Marker": [
      `${winner} won the hand, giving the profile another public marker without overstating it.`,
      `${winner} added a smaller but verified hand to the player file.`,
      `The pot went to ${winner}; useful context, not a finished identity.`,
    ],
  };
  const impactLabel = {
    "Season Biggest Pot": "The Separation",
    "Pressure Pot": "Pressure Read",
    "Opening Signal": "Opening Signal",
    "Late Answer": "Late Answer",
    "Showdown Marker": "Showdown Read",
    "Signature Pot": "Signature Pot",
    "Archive Marker": "Archive Note",
  }[momentRole] || "Why It Mattered";
  const momentPhrase = pickPhrase(
    impactOptions[momentRole],
    winner,
    handNo,
    potText,
    momentRole
  );
  const summary = text(
    moment.summary || moment.displaySummary || moment.description,
    momentPhrase
  );
  const dek = tags.length
    ? `${momentRole}${handNo ? ` / Hand #${handNo}` : ""}`
    : `${momentRole}${handNo ? ` / Hand #${handNo}` : ""}`;
  const sessionImpact = pickPhrase(
    [
      numericPot ? `${winner} collected ${potText}; the size determines how much weight the profile should give it.` : `${winner} won a verified hand that belongs in the public recap.`,
      handNo ? `Hand #${handNo} is useful because it gives the profile a real hand number, not just a stat line.` : `The result gives the profile a concrete hand to track.`,
      involvedPlayers.length > 1
        ? `${involvedPlayers.slice(0, 2).join(" and ")} are the names attached to the hand record.`
        : `${winner} is the public name attached to this hand's result.`,
    ],
    handNo,
    winner,
    potText
  );
  const longBody = [
    `${summary}`,
    handNo
      ? `${sessionImpact}`
      : `${sessionImpact}`,
  ].join("\n\n");
  const anchor = momentAnchor(handNo);
  const sessionHref = publicSessionHref(source.session_code || moment.sessionCode);

  const draft = {
    id: `moment-${text(moment.id || moment.hand_code || handNo, "unknown")}`,
    scope: "moment",
    status: "draft",
    visibility: "public",
    tone: "archive",
    title,
    headline: title,
    dek,
    summary,
    short_summary: summary,
    body: longBody,
    long_body: longBody,
    momentRole,
    potText,
    winnerName: winner,
    handNo,
    involvedPlayers,
    impactLabel,
    sessionImpact,
    key_takeaways: [
      pot ? potText : "",
      winner ? `${winner} won the hand` : "",
      tags[0] ? tags[0] : "",
    ].filter(Boolean),
    sourceSessionId: text(source.session_id || moment.session_id || moment.sourceSessionId),
    sourceHandIds: [
      ...(moment.sourceHandIds || []),
      source.hand_code,
      source.hand_id,
      moment.hand_code,
      moment.hand_id,
      moment.id,
    ].filter(Boolean).map(String).slice(0, 3),
    source_hand_ids: [
      ...(moment.sourceHandIds || []),
      source.hand_code,
      source.hand_id,
      moment.hand_code,
      moment.hand_id,
      moment.id,
    ].filter(Boolean).map(String).slice(0, 3),
    source_fact_ids: sourceFactIds(sourceFacts),
    tags,
    href: sessionHref && anchor ? `${sessionHref}#${anchor}` : sessionHref,
    anchorId: anchor,
    handHistory,
    sourceFacts,
    stored: false,
  };

  return storedArtifact
    ? { ...draft, ...storedArtifact, href: storedArtifact.href || draft.href, anchorId: storedArtifact.anchorId || draft.anchorId }
    : draft;
}

export function buildPlayerRecapFacts(profileData) {
  const seasonStatus = profileData.seasonStatus || {};
  const stats = new Map(
    [...(profileData.coreStats || []), ...(profileData.publicHud?.stats || [])]
      .map((item) => [item.sourceKey, item])
  );

  return [
    fact("player", "Player", profileData.playerName, "players", profileData.slug),
    fact("season", "Season", seasonStatus.seasonCode || "S0", "player_season_stats", profileData.slug),
    fact("rank", "Rank", seasonStatus.rankText || profileData.rankText || "-", "standings", profileData.slug),
    fact("points", "Points", seasonStatus.pointsText || profileData.pointsText || "0", "standings", profileData.slug),
    fact("hands", "Hands", stats.get("player_season_stats.hands")?.value || "0", "player_season_stats", profileData.slug),
    fact(
      "biggest_pot",
      "Biggest pot",
      stats.get("player_season_stats.biggest_pot_won")?.value || "0",
      "player_season_stats",
      profileData.slug
    ),
    fact("archetype", "Public labels", profileData.labelsText, "player_season_stats", profileData.slug),
  ];
}

export function buildPlayerRecapArtifact(profileData, storedArtifact = null) {
  const sourceFacts = buildPlayerRecapFacts(profileData);
  const playerName = cleanName(profileData.playerName);
  const seasonCode = text(profileData.seasonStatus?.seasonCode, "S0");
  const rank = text(profileData.seasonStatus?.rankText || profileData.rankText, "-");
  const points = text(profileData.seasonStatus?.pointsText || profileData.pointsText, "0");
  const hands = sourceFacts.find((item) => item.id === "hands")?.value || "0";
  const labels = text(profileData.labelsText, "still-forming table identity / table identity still developing");
  const sessionCount = Number(profileData.seasonStatus?.approvedSessions) || (profileData.recentSessions || []).length;
  const bestFinish = profileData.seasonStatus?.bestFinish;
  const biggestPot = sourceFacts.find((item) => item.id === "biggest_pot")?.value || "0";
  const resultLine = bestFinish
    ? `${ordinalText(bestFinish)} place`
    : rank !== "-"
      ? `${rank} on the board`
      : "a first public record";
  const summary = pickPhrase(
    [
      `${playerName}'s ${seasonCode} file starts with ${resultLine}, ${points} points, and ${biggestPot} as the largest collected pot. The profile is still early, but the opening read is clear enough to follow.`,
      `${playerName}'s preseason profile has a real first line: ${points} points, ${hands} hands, and ${biggestPot} at the top of the pot record. The archive has something to watch now.`,
      `${playerName} has not played enough to become a finished profile, but the first page is not empty: ${resultLine}, ${points} points, and a public style read of ${labels}.`,
    ],
    playerName,
    seasonCode,
    labels,
    hands
  );
  const longBody = [
    `${playerName}'s preseason file starts with the part that matters most: ${resultLine}, ${points} points, and ${biggestPot} as the largest pot on the public record. That is enough to give the profile an opening mark without pretending the story is finished.`,
    `The current public read is ${labels}. Keep it lightweight: this is an early profile note, not a final verdict or a private scouting report.`,
    pickPhrase(
      [
        `What the archive watches next is simple: whether the result repeats, whether the biggest pots keep finding this player, and whether a true signature moment gets pinned.`,
        `The next session matters because it can turn a first read into a pattern. For now, the dossier has an opening line and room to grow.`,
        `The profile is shareable because it is honest: strong enough to start the file, early enough to leave the next chapter open.`,
      ],
      playerName,
      points,
      rank
    ),
  ].join("\n\n");

  const draft = {
    id: `player-season-${profileData.slug || playerName}`,
    scope: "player",
    status: "draft",
    visibility: "public",
    tone: "sports",
    title: "Player Dossier",
    headline: `${playerName}'s ${seasonCode} dossier`,
    dek: sessionCount <= 1
      ? `${sessionCount || 1} verified session in the archive. The read has started, not settled.`
      : `${sessionCount} verified sessions shaping the current public read.`,
    summary,
    short_summary: summary,
    body: longBody,
    long_body: longBody,
    key_takeaways: [`${hands} tracked hands`, `${points} points`, `${rank} season standing`],
    sourcePlayerId: text(profileData.slug),
    seasonCode,
    tags: ["Player File", seasonCode],
    source_fact_ids: sourceFactIds(sourceFacts),
    sourceFacts,
    stored: false,
  };

  return storedArtifact || draft;
}

export function buildRecentFormRecap(profileData) {
  const sessions = profileData.recentSessions || [];
  const approved = sessions.filter((session) => session.approved);
  const facts = [
    fact("session_count", "Recent sessions listed", String(sessions.length), "player_session_stats", profileData.slug),
    fact("approved_count", "Public result rows listed", String(approved.length), "session_results", profileData.slug),
  ];

  sessions.slice(0, 3).forEach((session, index) => {
    facts.push(
      fact(
        `session_${index + 1}`,
        session.label || `Session ${index + 1}`,
        [session.dateText, `${session.handsText || "-"} hands`, session.resultText].filter(Boolean).join(" / "),
        "player_session_stats",
        session.id
      )
    );
  });

  const latestSession = sessions[0];
  const longBody = sessions.length
    ? [
        `${cleanName(profileData.playerName)} has ${sessions.length} verified session${sessions.length === 1 ? "" : "s"} in the archive. That is enough to start the read, but not enough to pretend the profile is finished.`,
        latestSession
          ? `The latest entry is ${latestSession.label || "a recent session"}${latestSession.resultText ? `, where the result line shows ${latestSession.resultText}` : ""}. The full session recap gives the run its shape beyond the result line.`
          : "Current form will gain sharper shape as more sessions enter the record.",
      ].join("\n\n")
    : "Current form will become clearer after more verified sessions.";

  return {
    id: `recent-form-${profileData.slug}`,
    scope: "player",
    status: "draft",
    visibility: "public",
    tone: "archive",
    title: "Recent Form",
    headline: "Recent form",
    dek: sessions.length
      ? `${sessions.length} verified session${sessions.length === 1 ? "" : "s"} shaping the current read.`
      : "Session history is still building.",
    summary: sessions.length
      ? `${cleanName(profileData.playerName)} has ${sessions.length} verified session${sessions.length === 1 ? "" : "s"} in the archive. The read has started, but the profile is still earning detail.`
      : "Current form will become clearer after more verified sessions.",
    short_summary: sessions.length
      ? `${cleanName(profileData.playerName)} has ${sessions.length} verified session${sessions.length === 1 ? "" : "s"} in the archive. The read has started, but the profile is still earning detail.`
      : "Current form will become clearer after more verified sessions.",
    body: longBody,
    long_body: longBody,
    key_takeaways: sessions.slice(0, 3).map((session) =>
      [session.label, session.resultText].filter(Boolean).join(" / ")
    ),
    sourcePlayerId: text(profileData.slug),
    seasonCode: text(profileData.seasonStatus?.seasonCode, "S0"),
    tags: ["Recent Form", "Sessions"],
    source_fact_ids: sourceFactIds(facts),
    sourceFacts: facts,
    stored: false,
  };
}

export async function buildProfileRecaps(profileData) {
  const featuredMomentCard = profileData.featuredDisplay?.featuredMoment;
  const featuredMoment =
    featuredMomentCard?.raw ||
    (featuredMomentCard?.sourceId
      ? (profileData.moments || []).find((moment) => String(moment.id) === String(featuredMomentCard.sourceId))
      : null) ||
    profileData.signatureMoment ||
    null;
  const [storedPlayer, storedFeatured] = await Promise.all([
    getStoredRecapArtifact({
      scope: "player",
      sourcePlayerId: profileData.slug,
    }),
    getStoredRecapArtifact({
      scope: "moment",
      sourceSessionId: featuredMoment?.sourceSessionId || featuredMoment?.session_id,
      sourceHandIds: [featuredMoment?.id].filter(Boolean),
    }),
  ]);
  const momentRecaps = (profileData.moments || profileData.notableHands || [])
    .map((moment) => buildMomentRecapArtifact(moment))
    .slice(0, 12);

  return {
    playerSeason: buildPlayerRecapArtifact(profileData, storedPlayer),
    featuredMoment: featuredMoment
      ? storedFeatured || buildMomentRecapArtifact(featuredMoment)
      : null,
    recentForm: buildRecentFormRecap(profileData),
    moments: momentRecaps,
  };
}

export function buildSessionRecapFacts({ session, sessionResults = [], playerSessionStats = [], notableHands = [], hands = [] }) {
  const biggestPot = [...notableHands, ...hands]
    .filter((row) => row.pot_collected)
    .sort((left, right) => numberValue(right.pot_collected) - numberValue(left.pot_collected))[0];
  const approvedResults = sessionResults.filter((result) => result.approved);

  return [
    fact("session", "Session", session.session_code || session.id, "sessions", session.id),
    fact("date", "Date", formatDate(session.played_at) || "Date pending", "sessions", session.id),
    fact("format", "Format", session.format || "-", "sessions", session.id),
    fact("hands", "Hands", session.hands_count || hands.length || "-", "sessions", session.id),
    fact("players", "Players with stats", String(playerSessionStats.length), "player_session_stats", session.id),
    fact("approved_results", "Approved results", String(approvedResults.length), "session_results", session.id),
    biggestPot
      ? fact("biggest_pot", "Biggest listed pot", `${formatNumber(biggestPot.pot_collected)} chips`, "notable_hands", biggestPot.id)
      : null,
  ].filter(Boolean);
}

export function buildSessionRecapArtifact(input, storedArtifact = null) {
  const { session, sessionResults = [], playerSessionStats = [], notableHands = [], hands = [] } = input;
  const sourceFacts = buildSessionRecapFacts(input);
  const approvedResults = sessionResults.filter((result) => result.approved);
  const winner = approvedResults
    .slice()
    .sort((left, right) => numberValue(left.finish, 99) - numberValue(right.finish, 99))[0];
  const strongestNonWinner = approvedResults
    .slice()
    .sort((left, right) => numberValue(left.finish, 99) - numberValue(right.finish, 99))
    .find((result) => String(result.player_id || result.player_name) !== String(winner?.player_id || winner?.player_name));
  const sessionLabel = text(session.session_code || session.id, "Session");
  const biggestPot = [...notableHands, ...hands]
    .filter((row) => row.pot_collected)
    .sort((left, right) => numberValue(right.pot_collected) - numberValue(left.pot_collected))[0];
  const biggestPotText = biggestPot ? `${formatNumber(biggestPot.pot_collected)} chips` : "";
  const playerCount = playerSessionStats.length || approvedResults.length;
  const isSmallField = playerCount > 0 && playerCount <= 2;
  const winnerName = cleanName(winner?.player_name || "The winner");
  const runnerUpName = cleanName(strongestNonWinner?.player_name || "the runner-up");
  const runnerUpPoints = text(strongestNonWinner?.league_points, "0");
  const biggestHandText = biggestPot?.hand_no ? `Hand #${biggestPot.hand_no}` : "the biggest pot";
  const title = `${sessionLabel} Recap`;
  const summary = winner
    ? isSmallField
      ? `${sessionLabel} was a two-player preseason record: ${winnerName} finished first, ${runnerUpName} finished second with ${runnerUpPoints} points, and ${biggestHandText}${biggestPotText ? ` for ${biggestPotText}` : ""} gave the session its clearest hinge.`
      : pickPhrase(
          [
            `${winnerName} gave ${sessionLabel} its headline, finishing first with ${text(winner.league_points, "0")} league points while the biggest pots gave the night its shape.`,
            `${winnerName} finished on top of ${sessionLabel}, turning a verified result into a first read worth following.`,
            `${sessionLabel} belongs first to ${winnerName}, who converted the table run into ${text(winner.league_points, "0")} league points and the clearest line of the night.`,
          ],
          sessionLabel,
          winner.player_name,
          winner.league_points
        )
    : `${sessionLabel} has been logged, with the public result still waiting for a fuller recap shape.`;
  const headline = winner
    ? isSmallField && biggestPot?.hand_no
      ? `${winnerName} Takes ${sessionLabel} as Hand #${biggestPot.hand_no} Sets the Mark`
      : pickPhrase(
          [
            `${winnerName} Tops ${sessionLabel}`,
            `${winnerName} Opens the Record in ${sessionLabel}`,
            `${winnerName} Wins ${sessionLabel}`,
          ],
          sessionLabel,
          winner.player_name
        )
    : `${sessionLabel} recap`;
  const dek = [
    formatDate(session.played_at),
    session.format,
    session.hands_count ? `${session.hands_count} hands` : "",
    biggestPotText ? `${biggestPotText} biggest pot` : "",
  ].filter(Boolean).join(" / ");
  const tableTexture = isSmallField
    ? `${sessionLabel} was not a crowded table. It was a direct two-player record, which makes the result easier to read and harder to overstate.`
    : pickPhrase(
    [
      "The table story starts with the result, then moves through the pots that made the night harder to ignore.",
      "This one has a clear public shape: a winner, a heaviest pot, and enough hand detail to show where the session tightened.",
      "The useful read is not only who finished first. It is where the heavy pot landed and which players stayed attached to the story.",
    ],
    sessionLabel,
    session.hands_count,
    biggestPotText
  );
  const longBody = [
    `${sessionLabel} played as a ${text(session.format, "tracked")} session${session.hands_count ? ` across ${session.hands_count} hands` : ""}. ${tableTexture}`,
    winner
      ? isSmallField
        ? `${winnerName} stands at the top with ${text(winner.league_points, "0")} league points. ${runnerUpName} stays in the record with ${runnerUpPoints} points, which matters because a two-player opener still needs both sides to tell the truth of the match.`
        : `${winnerName} stands at the top with ${text(winner.league_points, "0")} league points. That is the headline, but the recap does not stop at the finish. The best public read shows how the win sits next to the hands that shaped the result.`
      : "The final result line is not available in the current public data, so this recap stays close to verified session shape rather than pretending certainty.",
    strongestNonWinner
      ? isSmallField
        ? `${runnerUpName} finished #${text(strongestNonWinner.finish, "-")} with ${runnerUpPoints} points. That does not flip the result, but it keeps the session from reading like a one-line win.`
        : `${runnerUpName} gives the night its strongest non-winning run, finishing #${text(strongestNonWinner.finish, "-")} with ${runnerUpPoints} league points.`
      : "A strongest non-winner note will sharpen when the public result has enough approved detail.",
    biggestPot
      ? `${biggestHandText} is the cleanest hinge: ${cleanName(biggestPot.winner_name)} collected ${biggestPotText}. In a ${isSmallField ? "two-player record" : "session recap"}, a pot that large should not sit in the background.`
      : "No verified biggest-pot detail is attached yet. Once hand-level data is complete, the key swing will have a cleaner place in the recap.",
    notableHands.length
      ? `${notableHands.length} notable hand${notableHands.length === 1 ? "" : "s"} support the public story underneath. They are there for readers who want the action, not as a replacement for the recap itself.`
      : "Notable hand detail has not entered the recap yet, so the story stays close to the verified result.",
  ].join("\n\n");

  const draft = {
    id: `session-${session.id}`,
    scope: "session",
    status: "draft",
    visibility: "public",
    tone: "archive",
    title,
    headline,
    dek,
    summary,
    short_summary: summary,
    body: longBody,
    long_body: longBody,
    key_takeaways: [
      winner ? `${cleanName(winner.player_name)} finished first in the verified result` : "",
      biggestPotText ? `${biggestPotText} biggest listed pot` : "",
      session.hands_count ? `${session.hands_count} hands tracked` : "",
    ].filter(Boolean),
    sourceSessionId: text(session.id),
    sourceHandIds: notableHands.map((hand) => text(hand.hand_code || hand.hand_id || hand.id)).filter(Boolean),
    source_hand_ids: notableHands.map((hand) => text(hand.hand_code || hand.hand_id || hand.id)).filter(Boolean),
    source_fact_ids: sourceFactIds(sourceFacts),
    seasonCode: text(session.season_code, "S0"),
    tags: ["Session Recap", text(session.season_code, "S0")],
    sourceFacts,
    stored: false,
  };

  return storedArtifact || draft;
}

export async function getSessionRecapData(sessionIdOrCode) {
  const cleanId = text(sessionIdOrCode).trim();
  if (!cleanId) return null;

  const session =
    (await safeQuery(
      supabase.from("sessions").select("*").eq("id", cleanId).maybeSingle()
    )) ||
    (await safeQuery(
      supabase.from("sessions").select("*").ilike("session_code", cleanId).maybeSingle()
    ));

  if (!session) return null;

  const [sessionResults, playerSessionStats, notableHands, hands, players, storedSession] =
    await Promise.all([
      safeQuery(
        supabase
          .from("session_results")
          .select("*")
          .eq("session_id", session.id)
          .order("finish", { ascending: true })
      ),
      safeQuery(
        supabase
          .from("player_session_stats")
          .select("*")
          .eq("session_id", session.id)
          .order("player_name", { ascending: true })
      ),
      safeQuery(
        supabase
          .from("notable_hands")
          .select("*")
          .eq("session_id", session.id)
          .order("pot_collected", { ascending: false })
          .limit(25)
      ),
      safeQuery(
        supabase
          .from("hands")
          .select("*")
          .eq("session_id", session.id)
          .order("pot_collected", { ascending: false })
          .limit(25)
      ),
      safeQuery(supabase.from("players").select("id, display_name, slug, pokernow_name")),
      getStoredRecapArtifact({
        scope: "session",
        sourceSessionId: session.id,
      }),
    ]);

  const handNumbers = [
    ...(notableHands || []),
    ...(hands || []),
  ]
    .map((hand) => Number(hand.hand_no))
    .filter((handNo) => Number.isFinite(handNo));
  const uniqueHandNumbers = [...new Set(handNumbers)].slice(0, 25);
  const handActions = uniqueHandNumbers.length
    ? await safeQuery(
        supabase
          .from("actions")
          .select("*")
          .eq("session_id", session.id)
          .in("hand_no", uniqueHandNumbers)
          .order("log_order", { ascending: true })
      )
    : [];
  const actionsByHandNo = new Map();
  (handActions || []).forEach((action) => {
    const key = String(action.hand_no);
    if (!actionsByHandNo.has(key)) actionsByHandNo.set(key, []);
    actionsByHandNo.get(key).push(action);
  });

  const playersById = new Map((players || []).map((player) => [String(player.id), player]));
  const playersByName = new Map(
    (players || []).flatMap((player) =>
      [player.display_name, player.pokernow_name]
        .filter(Boolean)
        .map((name) => [cleanName(name).toLowerCase(), player])
    )
  );
  const participants = (playerSessionStats || []).map((row) => {
    const player = playersById.get(String(row.player_id)) || {};
    return {
      id: text(row.player_id),
      name: cleanName(player.display_name || row.player_name),
      slug: text(player.slug),
      hands: text(row.hands, "-"),
      vpip: text(row.vpip_pct, "-"),
      pfr: text(row.pfr_pct, "-"),
      biggestPot: text(row.biggest_pot_won, "0"),
      result: (sessionResults || []).find((result) => String(result.player_id) === String(row.player_id)) || null,
    };
  });
  const momentRecaps = (notableHands || []).map((moment) => {
    const handHistory = buildHandHistory(moment, actionsByHandNo.get(String(moment.hand_no)) || []);
    const recap = buildMomentRecapArtifact({
      ...moment,
      sessionCode: session.session_code,
      handHistory,
    });
    const relatedPlayer =
      playersById.get(String(moment.winner_player_id || moment.player_id || "")) ||
      playersByName.get(cleanName(moment.winner_name || moment.player_name).toLowerCase()) ||
      null;

    return {
      ...recap,
      relatedPlayerHref: relatedPlayer?.slug ? `/players-v2/${encodeURIComponent(relatedPlayer.slug)}` : "",
      relatedPlayerName: relatedPlayer ? cleanName(relatedPlayer.display_name || relatedPlayer.pokernow_name) : cleanName(moment.winner_name || moment.player_name, ""),
    };
  });
  const biggestPot = (hands?.length ? hands : notableHands || [])[0] || null;
  const approvedWinner = (sessionResults || [])
    .filter((result) => result.approved)
    .slice()
    .sort((left, right) => numberValue(left.finish, 99) - numberValue(right.finish, 99))[0] || null;
  const turningPoint = (notableHands || []).find((hand) =>
    normalizeTags(hand.tags).includes("Season Biggest Pot")
  ) || notableHands?.[0] || null;
  const sessionRecap = buildSessionRecapArtifact(
    {
      session,
      sessionResults: sessionResults || [],
      playerSessionStats: playerSessionStats || [],
      notableHands: notableHands || [],
      hands: hands || [],
    },
    storedSession
  );

  return {
    session,
    participants,
    results: sessionResults || [],
    stats: playerSessionStats || [],
    notableHands: notableHands || [],
    biggestPots: (hands?.length ? hands : notableHands || []).slice(0, 6),
    handHistories: (hands?.length ? hands : notableHands || []).slice(0, 6).map((hand) =>
      buildHandHistory(hand, actionsByHandNo.get(String(hand.hand_no)) || [])
    ),
    recaps: {
      session: sessionRecap,
      moments: momentRecaps,
    },
    editorial: {
      biggestPot,
      turningPoint,
      playerOfSession: approvedWinner
        ? {
            name: cleanName(approvedWinner.player_name),
            points: text(approvedWinner.league_points, "0"),
            finish: text(approvedWinner.finish, "1"),
          }
        : null,
    },
  };
}
