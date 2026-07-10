const CARD_TYPES = new Set([
  "stat",
  "result",
  "moment",
  "achievement",
  "team",
  "quote",
  "custom",
  "placeholder",
]);

const FEATURED_SLOTS = ["featured_1", "featured_2", "featured_3"];

export function sanitizeBackgroundUrl(value) {
  const candidate = safeText(value).trim();
  if (!candidate) return "";
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;

  try {
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function safeText(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

export function normalizeFeaturedCard(card, index = 0) {
  const value = card && typeof card === "object" ? card : {};
  const type = CARD_TYPES.has(value.type) ? value.type : "placeholder";

  return {
    slot: FEATURED_SLOTS[index] || safeText(value.slot, `featured_${index + 1}`),
    type,
    label: safeText(value.label, "Featured Display"),
    title: safeText(value.title, "Coming soon"),
    value: safeText(value.value),
    subtitle: safeText(value.subtitle),
    source: safeText(value.source, "placeholder"),
    sourceId: safeText(value.sourceId),
  };
}

export function normalizeFeaturedCards(cards) {
  if (!Array.isArray(cards)) return [];
  return cards.slice(0, 3).map((card, index) => normalizeFeaturedCard(card, index));
}

export function enrichFeaturedCards(cards, profileData) {
  const seasonCode = safeText(profileData.seasonStatus?.seasonCode, "S0");
  const approvedSessions = Number(profileData.seasonStatus?.approvedSessions) || 0;
  const sessionWord = approvedSessions === 1 ? "session" : "sessions";

  return normalizeFeaturedCards(cards).map((card, index) => {
    if (card.source === "publicHud") {
      const stat = (profileData.publicHud?.stats || []).find(
        (item) => item.sourceKey === card.sourceId
      );
      return normalizeFeaturedCard({
        ...card,
        label: "Season Snapshot",
        title: safeText(stat?.label, card.title),
        value: safeText(stat?.value, card.value),
        subtitle: `Public record \u00b7 ${seasonCode}`,
      }, index);
    }

    if (card.source === "seasonStatus") {
      if (card.sourceId === "rankText") {
        const rank = safeText(profileData.seasonStatus?.rankText, card.value || "-");
        const points = safeText(profileData.seasonStatus?.pointsText, "0");
        return normalizeFeaturedCard({
          ...card,
          label: "Season Standing",
          title: `Ranked ${rank} in ${seasonCode}`,
          value: rank,
          subtitle: `${points} points through ${approvedSessions} verified ${sessionWord}`,
        }, index);
      }

      if (card.sourceId === "pointsText") {
        const points = safeText(profileData.seasonStatus?.pointsText, card.value || "0");
        return normalizeFeaturedCard({
          ...card,
          label: "Season Points",
          title: `${points} points in ${seasonCode}`,
          value: points,
          subtitle: `Through ${approvedSessions} verified ${sessionWord}`,
        }, index);
      }
    }

    if (card.source === "recentSessions") {
      const session = (profileData.recentSessions || []).find(
        (item) => item.sessionCode === card.sourceId
      );
      if (session) {
        return normalizeFeaturedCard({
          ...card,
          label: "Session Result",
          title: `Top ${session.finish} Finish`,
          value: session.finishText,
          subtitle: `${session.sessionCode} \u00b7 ${session.pointsText} points awarded`,
        }, index);
      }
    }

    if (card.source === "moments") {
      const moment = (profileData.moments || []).find(
        (item) => String(item.id) === String(card.sourceId)
      );
      if (moment) {
        return normalizeFeaturedCard({
          ...card,
          label: "Featured Moment",
          title: moment.displayTitle || card.title,
          value: moment.handNo ? `Hand #${moment.handNo}` : card.value,
          subtitle: [
            moment.sessionCode,
            moment.potText ? `${moment.potText}-chip pot` : "",
          ].filter(Boolean).join(" \u00b7 "),
        }, index);
      }
    }

    if (card.source === "achievements") {
      const title = /^Top \d+$/i.test(card.title)
        ? `${card.title} Season Standing`
        : card.title;
      return normalizeFeaturedCard({
        ...card,
        label: "Profile Badge",
        title,
        subtitle: `Profile badge \u00b7 ${seasonCode}`,
      }, index);
    }

    return normalizeFeaturedCard(card, index);
  });
}

export function buildDefaultFeaturedCards({ publicHud, seasonStatus, moments, achievements }) {
  const stats = publicHud?.stats || [];
  const preferredStat =
    findUsefulStat(stats, "Action Rate") ||
    findUsefulStat(stats, "First Raise Rate") ||
    findUsefulStat(stats, "Biggest Pot") ||
    findUsefulStat(stats, "Hands") ||
    stats[0];
  const rankText = safeText(seasonStatus?.rankText, "-");
  const pointsText = safeText(seasonStatus?.pointsText, "0");
  const seasonCode = safeText(seasonStatus?.seasonCode, "S0");
  const approvedSessions = Number(seasonStatus?.approvedSessions) || 0;
  const sessionWord = approvedSessions === 1 ? "session" : "sessions";
  const bestMoment = moments?.[0];
  const bestAchievement = achievements?.[0];

  const cards = [
    {
      type: "stat",
      label: "Season Snapshot",
      title: safeText(preferredStat?.label, "Hands"),
      value: safeText(preferredStat?.value, "0"),
      subtitle: `Public record \u00b7 ${seasonCode}`,
      source: "publicHud",
      sourceId: safeText(preferredStat?.sourceKey, "hands"),
    },
    {
      type: "result",
      label: rankText !== "-" ? "Season Standing" : "Season Points",
      title: rankText !== "-" ? `Ranked ${rankText} in ${seasonCode}` : `${pointsText} points in ${seasonCode}`,
      value: rankText !== "-" ? rankText : pointsText,
      subtitle: rankText !== "-"
        ? `${pointsText} points through ${approvedSessions} verified ${sessionWord}`
        : `Through ${approvedSessions} verified ${sessionWord}`,
      source: "seasonStatus",
      sourceId: rankText !== "-" ? "rankText" : "pointsText",
    },
    bestMoment
      ? {
          type: "moment",
          label: "Featured Moment",
          title: safeText(bestMoment.displayTitle || bestMoment.title, "Notable Moment"),
          value: bestMoment.handNo ? `Hand #${bestMoment.handNo}` : "Archived hand",
          subtitle: [
            bestMoment.sessionCode || seasonCode,
            bestMoment.potText ? `${bestMoment.potText}-chip pot` : "",
          ].filter(Boolean).join(" \u00b7 "),
          source: "moments",
          sourceId: safeText(bestMoment.id),
        }
      : {
          type: "placeholder",
      label: "Featured Moment",
      title: "No signature moment has been pinned yet",
          value: "",
          subtitle: bestAchievement
            ? `${safeText(bestAchievement.label, "Profile marker")} is active, but no public hand has earned the signature slot yet.`
            : "A signature hand will appear here once a meaningful public moment is pinned or earned.",
          source: "placeholder",
          sourceId: "signature-moment-pending",
        },
  ];

  return cards.map((card, index) => normalizeFeaturedCard(card, index));
}

export function buildFeaturedCardOptions(profileData) {
  const options = [];
  const seasonCode = safeText(profileData.seasonStatus?.seasonCode, "S0");
  const approvedSessions = Number(profileData.seasonStatus?.approvedSessions) || 0;
  const sessionWord = approvedSessions === 1 ? "session" : "sessions";

  (profileData.publicHud?.stats || []).forEach((stat) => {
    options.push(option(`Stat: ${stat.label} - ${stat.value}`, {
      type: "stat",
      label: "Season Snapshot",
      title: stat.label,
      value: stat.value,
      subtitle: `Public record \u00b7 ${seasonCode}`,
      source: "publicHud",
      sourceId: stat.sourceKey,
    }));
  });

  options.push(option(`Standing: Ranked ${profileData.seasonStatus?.rankText || "-"} in ${seasonCode}`, {
    type: "result",
    label: "Season Standing",
    title: `Ranked ${profileData.seasonStatus?.rankText || "-"} in ${seasonCode}`,
    value: profileData.seasonStatus?.rankText || "-",
    subtitle: `${profileData.seasonStatus?.pointsText || "0"} points through ${approvedSessions} verified ${sessionWord}`,
    source: "seasonStatus",
    sourceId: "rankText",
  }));
  options.push(option(`Result: ${profileData.seasonStatus?.pointsText || "0"} Season Points`, {
    type: "result",
    label: "Season Points",
    title: `${profileData.seasonStatus?.pointsText || "0"} points in ${seasonCode}`,
    value: profileData.seasonStatus?.pointsText || "0",
    subtitle: `Through ${approvedSessions} verified ${sessionWord}`,
    source: "seasonStatus",
    sourceId: "pointsText",
  }));

  (profileData.recentSessions || [])
    .filter((session) => session.approved && session.finish)
    .forEach((session) => {
      options.push(option(`Session: ${session.sessionCode} - ${session.finishText} finish`, {
        type: "result",
        label: "Session Result",
        title: `Top ${session.finish} Finish`,
        value: session.finishText,
        subtitle: `${session.sessionCode} \u00b7 ${session.pointsText} points awarded`,
        source: "recentSessions",
        sourceId: session.sessionCode,
      }));
    });

  (profileData.moments || []).slice(0, 12).forEach((moment, index) => {
    const title = moment.displayTitle || moment.title || "Notable Moment";
    options.push(option(`Moment: ${title}`, {
      type: "moment",
      label: "Featured Moment",
      title,
      value: moment.handNo ? `Hand #${moment.handNo}` : "Archived hand",
      subtitle: [
        moment.sessionCode || seasonCode,
        moment.potText ? `${moment.potText}-chip pot` : "",
      ].filter(Boolean).join(" \u00b7 "),
      source: "moments",
      sourceId: moment.id || `moment-${index}`,
    }));
  });

  (profileData.achievements || []).forEach((achievement, index) => {
    options.push(option(`Achievement: ${achievement.label || "Profile Badge"}`, {
      type: "achievement",
      label: "Featured Achievement",
      title: achievement.label || "Profile Badge",
      value: "",
      subtitle: `Profile badge \u00b7 ${seasonCode}`,
      source: "achievements",
      sourceId: achievement.id || achievement.label || `achievement-${index}`,
    }));
  });

  options.push(option("Placeholder: Team Affiliation", {
    type: "team",
    label: "Featured Team",
    title: "Team Affiliation",
    value: "Coming soon",
    subtitle: "Team profiles are not connected yet.",
    source: "placeholder",
    sourceId: "team-affiliation",
  }));
  options.push(option("Placeholder: Custom Quote", {
    type: "quote",
    label: "Featured Quote",
    title: "Player Quote",
    value: "Coming soon",
    subtitle: "Custom profile quotes are not connected yet.",
    source: "placeholder",
    sourceId: "custom-quote",
  }));
  options.push(option("Placeholder: Custom Card", {
    type: "custom",
    label: "Custom Card",
    title: "Custom Showcase",
    value: "Coming soon",
    subtitle: "Custom card editing is planned for a later pass.",
    source: "placeholder",
    sourceId: "custom-card",
  }));

  return deduplicateOptions(options);
}

export function mergeCurrentCardsIntoOptions(options, cards) {
  const merged = [...options];
  normalizeFeaturedCards(cards).forEach((card) => {
    if (!merged.some((item) => sameCard(item.card, card))) {
      merged.push(option(`Current: ${card.title}${card.value ? ` - ${card.value}` : ""}`, card));
    }
  });
  return deduplicateOptions(merged);
}

export function optionKeyForCard(card) {
  return [card.type, card.source, card.sourceId, card.title, card.value]
    .map((value) => safeText(value).replace(/\|/g, ""))
    .join("|");
}

function option(label, card) {
  const normalizedCard = normalizeFeaturedCard(card, 0);
  delete normalizedCard.slot;
  return { key: optionKeyForCard(normalizedCard), label, card: normalizedCard };
}

function deduplicateOptions(options) {
  return [...new Map(options.map((item) => [item.key, item])).values()];
}

function sameCard(left, right) {
  return optionKeyForCard(left) === optionKeyForCard(right);
}

function findUsefulStat(stats, label) {
  return stats.find((stat) =>
    (stat.label === label || stat.sourceKey?.includes(label.toLowerCase())) &&
    !["", "-", "0", "0%"].includes(String(stat.value))
  );
}
