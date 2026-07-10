"use client";

import {
  PlasmicRootProvider,
  PlasmicComponent,
} from "@plasmicapp/loader-nextjs";
import { PLASMIC } from "@/plasmic-loader";
import { sanitizeBackgroundUrl } from "@/lib/playerProfileDisplay";

function findStat(stats, sourceKey, fallback = "-") {
  return (
    stats?.find((stat) => stat.sourceKey === sourceKey)?.value ||
    stats?.find((stat) => stat.sourceKey?.endsWith(sourceKey))?.value ||
    fallback
  );
}

function cleanDisplayName(value) {
  return typeof value === "string"
    ? value.replace(/\s+@\s+\S+\s*$/u, "").trim()
    : value;
}

function cleanPlayerFacingText(value) {
  return typeof value === "string"
    ? value.replace(/\s+@\s+[^\s.,;:!?]+/gu, "")
    : value;
}

const momentPriority = [
  "Season Biggest Pot",
  "Large Pot",
  "All-In Hand",
  "Strong Winning Hand",
  "Showdown",
];

function getMomentPriority(moment) {
  const tags = [...(moment.tags || []), ...(moment.displayTags || [])];
  const matchingIndex = momentPriority.findIndex(
    (preferredTag) =>
      tags.includes(preferredTag) ||
      moment.displayTitle === preferredTag ||
      moment.title === preferredTag
  );

  return matchingIndex === -1 ? momentPriority.length : matchingIndex;
}

function selectVisibleMoments(moments = []) {
  return moments
    .map((moment, index) => ({ moment, index }))
    .sort(
      (left, right) =>
        getMomentPriority(left.moment) - getMomentPriority(right.moment) ||
        left.index - right.index
    )
    .slice(0, 5)
    .map(({ moment }) => moment);
}

function MiniStatTile({ stat }) {
  return (
    <div style={{ ...miniCardStyle, flex: "1 1 120px" }}>
      <div style={miniLabelStyle}>{stat.label}</div>
      <div style={miniValueStyle}>{stat.value}</div>
    </div>
  );
}

function NotableHandCard({ hand }) {
  const title = hand.displayTitle || hand.title || "Notable Moment";
  const contextLine = cleanPlayerFacingText(hand.contextLine || "");
  const summary = cleanPlayerFacingText(
    hand.displaySummary || hand.description || ""
  );
  const meta = cleanPlayerFacingText(
    hand.displayMeta || hand.subtitle || ""
  );
  const tags = hand.displayTags || [];

  return (
    <article style={momentCardStyle}>
      {contextLine ? <div style={momentContextStyle}>{contextLine}</div> : null}
      <div style={miniValueStyle}>{title}</div>
      {summary ? <p style={momentSummaryStyle}>{summary}</p> : null}
      {meta ? <div style={miniLabelStyle}>{meta}</div> : null}
      {tags.length ? (
        <div style={tagRowStyle}>
          {tags.map((tag) => (
            <span key={tag} style={tagPillStyle}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function RecentSessionRow({ session }) {
  return (
    <div style={{ ...miniCardStyle, display: "grid", gap: 6 }}>
      <strong>{session.label}</strong>
      <span style={miniLabelStyle}>{session.dateText || "Recent session"}</span>
      <span style={miniBodyStyle}>
        {session.handsText} hands / {session.resultText}
      </span>
    </div>
  );
}

function SimpleCard({ title, subtitle, children }) {
  return (
    <article style={{ ...miniCardStyle, flex: "1 1 180px" }}>
      <div style={miniValueStyle}>{title}</div>
      {subtitle ? <div style={miniLabelStyle}>{subtitle}</div> : null}
      {children ? <div style={{ marginTop: 8 }}>{children}</div> : null}
    </article>
  );
}

function FeaturedDisplayCard({ card }) {
  const label = cleanPlayerFacingText(card.label || "Featured Display");
  const title = cleanPlayerFacingText(card.title || "Coming soon");
  const value = cleanPlayerFacingText(card.value || "");
  const subtitle = cleanPlayerFacingText(card.subtitle || "");

  return (
    <article style={featuredCardStyle}>
      <div style={miniLabelStyle}>{label}</div>
      <div style={miniValueStyle}>{title}</div>
      {value ? <div style={featuredValueStyle}>{value}</div> : null}
      {subtitle ? <p style={featuredSubtitleStyle}>{subtitle}</p> : null}
    </article>
  );
}

function LockedSectionCard({ section }) {
  return (
    <SimpleCard title={section.title} subtitle="Locked placeholder">
      <p style={miniBodyStyle}>{section.description}</p>
    </SimpleCard>
  );
}

function BadgePill({ badge }) {
  return (
    <span
      style={{
        display: "inline-flex",
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: 999,
        padding: "6px 10px",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {badge.label}
    </span>
  );
}

function Stack({ children }) {
  return <div style={{ display: "grid", gap: 10 }}>{children}</div>;
}

function FlowGrid({ children }) {
  return <div style={flowGridStyle}>{children}</div>;
}

function SectionBackground({ imageUrl, children }) {
  const style = buildSectionBackgroundStyle(imageUrl);
  if (!style) return children;

  return <div style={style}>{children}</div>;
}

function MomentGrid({ children }) {
  return <div style={momentGridStyle}>{children}</div>;
}

function MomentPreview({ moments, emptyTitle }) {
  const visibleMoments = selectVisibleMoments(moments);

  return (
    <div style={momentPreviewStyle}>
      <MomentGrid>
        {visibleMoments.length ? (
          visibleMoments.map((moment) => (
            <NotableHandCard key={moment.id} hand={moment} />
          ))
        ) : (
          <SimpleCard title={emptyTitle} subtitle="Public profile moments" />
        )}
      </MomentGrid>
      {moments.length > visibleMoments.length ? (
        <p style={archiveNoteStyle}>More moments coming in the full archive.</p>
      ) : null}
    </div>
  );
}

function getDeclaredPlasmicProps(plasmicData) {
  const componentMeta = plasmicData?.entryCompMetas?.find(
    (meta) =>
      meta.name === "PlayerProfileTemplate" ||
      meta.displayName === "PlayerProfileTemplate"
  );
  const declaredProps = new Set(Object.keys(componentMeta?.params || {}));

  if (declaredProps.size > 0) {
    return declaredProps;
  }

  const serializedBundle = JSON.stringify(plasmicData?.bundle || {});
  return {
    has(propName) {
      return serializedBundle.includes(propName);
    },
  };
}

function includeDeclaredProps(baseProps, declaredProps, optionalProps) {
  return Object.entries(optionalProps).reduce(
    (props, [propName, propValue]) =>
      declaredProps.has(propName)
        ? {
            ...props,
            [propName]: propValue,
          }
        : props,
    baseProps
  );
}

function buildSectionBackgroundStyle(imageUrl) {
  const safeUrl = sanitizeBackgroundUrl(imageUrl);
  if (!safeUrl) return null;

  return {
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    backgroundImage: `linear-gradient(rgba(5, 5, 5, 0.18), rgba(5, 5, 5, 0.18)), url("${safeUrl.replace(/"/g, "%22")}")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    overflow: "hidden",
  };
}

const miniCardStyle = {
  boxSizing: "border-box",
  minWidth: 0,
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: 8,
  padding: 12,
  background: "rgba(255,255,255,0.06)",
};

const miniLabelStyle = {
  color: "rgba(255,255,255,0.62)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const miniValueStyle = {
  color: "white",
  fontSize: 18,
  fontWeight: 800,
};

const miniBodyStyle = {
  color: "rgba(255,255,255,0.78)",
  fontSize: 13,
  margin: 0,
  overflowWrap: "anywhere",
};

const flowGridStyle = {
  boxSizing: "border-box",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  display: "flex",
  flexWrap: "wrap",
  alignItems: "stretch",
  gap: 10,
  overflow: "hidden",
};

const featuredCardStyle = {
  ...miniCardStyle,
  flex: "1 1 180px",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  overflow: "hidden",
};

const featuredValueStyle = {
  color: "white",
  fontSize: 24,
  fontWeight: 800,
  marginTop: 8,
  overflowWrap: "anywhere",
};

const featuredSubtitleStyle = {
  ...miniBodyStyle,
  lineHeight: 1.4,
  marginTop: 8,
};

const containedWrapStyle = {
  boxSizing: "border-box",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  overflow: "hidden",
};

const momentGridStyle = {
  boxSizing: "border-box",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
  gap: 10,
  overflow: "hidden",
};

const momentCardStyle = {
  ...miniCardStyle,
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  overflow: "hidden",
};

const momentPreviewStyle = {
  boxSizing: "border-box",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  overflow: "hidden",
};

const archiveNoteStyle = {
  ...miniBodyStyle,
  width: "100%",
  maxWidth: "100%",
  marginTop: 10,
};

const momentSummaryStyle = {
  ...miniBodyStyle,
  lineHeight: 1.4,
  margin: "6px 0 0",
};

const momentContextStyle = {
  ...miniLabelStyle,
  marginBottom: 6,
  overflowWrap: "anywhere",
};

const tagRowStyle = {
  boxSizing: "border-box",
  width: "100%",
  maxWidth: "100%",
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 10,
};

const tagPillStyle = {
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 999,
  padding: "3px 7px",
  color: "rgba(255,255,255,0.72)",
  fontSize: 11,
};

export default function PlasmicProfileClient({ plasmicData, profileData }) {
  const displayPlayerName = cleanDisplayName(profileData.playerName);
  const playerInitial = displayPlayerName?.[0]?.toUpperCase() || "P";
  const handsText = findStat(profileData.coreStats, "hands", "0");
  const biggestPotText = findStat(
    profileData.coreStats,
    "biggest_pot_won",
    "0"
  );
  const sectionBackgrounds =
    profileData.customization?.sectionBackgrounds || {};

  const avatarContent = profileData.avatarUrl ? (
    <img
      src={profileData.avatarUrl}
      alt={displayPlayerName}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
      }}
    />
  ) : (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        background: "#fbbf24",
        color: "#050505",
        fontSize: "48px",
        fontWeight: 900,
      }}
    >
      {playerInitial}
    </div>
  );

  const statTiles = (
    <Stack>
      {profileData.coreStats.map((stat) => (
        <MiniStatTile key={stat.sourceKey} stat={stat} />
      ))}
    </Stack>
  );

  const pokerStats = (
    <Stack>
      {profileData.pokerStats.map((stat) => (
        <MiniStatTile key={stat.sourceKey} stat={stat} />
      ))}
    </Stack>
  );

  const positionStats = (
    <Stack>
      {profileData.positionStats.map((stat) => (
        <MiniStatTile key={stat.sourceKey} stat={stat} />
      ))}
    </Stack>
  );

  const notableHands = (
    <MomentPreview
      moments={profileData.notableHands || []}
      emptyTitle="No notable hands yet"
    />
  );

  const sessionHistory = (
    <Stack>
      {profileData.recentSessions.length ? (
        profileData.recentSessions.map((session) => (
          <RecentSessionRow key={session.id} session={session} />
        ))
      ) : (
        <RecentSessionRow
          session={{
            label: "No sessions yet",
            dateText: "",
            handsText: "0",
            resultText: "-",
          }}
        />
      )}
    </Stack>
  );

  const badgeShelf = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {profileData.badges.map((badge) => (
        <BadgePill key={badge.label} badge={badge} />
      ))}
    </div>
  );
  const featuredCards = profileData.featuredDisplay?.cards || [];
  const featuredDisplay = (
    <SectionBackground imageUrl={sectionBackgrounds.featuredDisplay}>
      <FlowGrid>
        {featuredCards.length ? (
          featuredCards.map((card, index) => (
            <FeaturedDisplayCard
              key={`${card.slot || "featured"}-${index}`}
              card={card}
            />
          ))
        ) : (
          <FeaturedDisplayCard
            card={{
              label: "Featured Display",
              title: "Profile showcase coming soon",
              subtitle: "Public profile display",
            }}
          />
        )}
      </FlowGrid>
    </SectionBackground>
  );
  const publicHud = (
    <SectionBackground imageUrl={sectionBackgrounds.publicHud}>
      <FlowGrid>
        {(profileData.publicHud?.stats || []).map((stat) => (
          <MiniStatTile key={stat.sourceKey} stat={stat} />
        ))}
      </FlowGrid>
    </SectionBackground>
  );
  const styleProfile = (
    <SimpleCard
      title={profileData.styleProfile?.labelsText || profileData.labelsText}
      subtitle={`Theme: ${profileData.styleProfile?.theme || "default"}`}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {(profileData.styleProfile?.equippedBadges || []).map((badge) => (
          <BadgePill key={badge.label} badge={badge} />
        ))}
      </div>
    </SimpleCard>
  );
  const achievements = (
    <SectionBackground imageUrl={sectionBackgrounds.achievements}>
      <div style={containedWrapStyle}>
        {(profileData.achievements || []).map((achievement) => (
          <BadgePill key={achievement.label} badge={achievement} />
        ))}
      </div>
    </SectionBackground>
  );
  const moments = (
    <SectionBackground imageUrl={sectionBackgrounds.moments}>
      <MomentPreview
        moments={profileData.moments || []}
        emptyTitle="No moments yet"
      />
    </SectionBackground>
  );
  const lockedSections = (
    <SectionBackground imageUrl={sectionBackgrounds.lockedSections}>
      <FlowGrid>
        {(profileData.lockedSections || []).map((section) => (
          <LockedSectionCard key={section.key} section={section} />
        ))}
      </FlowGrid>
    </SectionBackground>
  );
  const advancedHud = (
    <SimpleCard title="Advanced HUD" subtitle="Locked placeholder">
      <p style={miniBodyStyle}>
        Advanced player trends and historical HUD data are not implemented yet.
      </p>
    </SimpleCard>
  );
  const poolComparisons = (
    <SimpleCard title="Pool Comparisons" subtitle="Locked placeholder">
      <p style={miniBodyStyle}>
        Pool-wide comparisons are reserved for a future paid tier.
      </p>
    </SimpleCard>
  );
  const coachingSignals = (
    <SimpleCard title="Coaching Signals" subtitle="Locked placeholder">
      <p style={miniBodyStyle}>
        Generated coaching notes are intentionally not implemented yet.
      </p>
    </SimpleCard>
  );
  const archivedSeasons = (
    <SimpleCard title="Archived Seasons" subtitle="Locked placeholder">
      <p style={miniBodyStyle}>
        Previous season access is reserved for a future paid tier.
      </p>
    </SimpleCard>
  );
  const declaredProps = getDeclaredPlasmicProps(plasmicData);
  const namedSectionOverrides = {};
  [
    ["Public HUD Section", sectionBackgrounds.publicHud],
    ["Featured Display Section", sectionBackgrounds.featuredDisplay],
    ["Locked Sections", sectionBackgrounds.lockedSections],
    ["Moments Section", sectionBackgrounds.moments],
    ["Achievements", sectionBackgrounds.achievements],
  ].forEach(([layerName, imageUrl]) => {
    const style = buildSectionBackgroundStyle(imageUrl);
    if (style) namedSectionOverrides[layerName] = { style };
  });
  const componentProps = includeDeclaredProps(
    {
      playerNameText: {
        children: displayPlayerName,
      },
      playerLabelsText: {
        children: profileData.labelsText,
      },
      bioText: {
        children: profileData.bio,
      },
      rankText: {
        children: profileData.rankText,
      },
      pointsText: {
        children: profileData.pointsText,
      },
      handsText: {
        children: handsText,
      },
      biggestPotText: {
        children: biggestPotText,
      },
      avatarSlot: {
        children: avatarContent,
      },
    },
    declaredProps,
    {
      statTilesSlot: {
        children: statTiles,
      },
      pokerStatsSlot: {
        children: pokerStats,
      },
      positionStatsSlot: {
        children: positionStats,
      },
      notableHandsSlot: {
        children: notableHands,
      },
      sessionHistorySlot: {
        children: sessionHistory,
      },
      badgeShelfSlot: {
        children: badgeShelf,
      },
      featuredDisplaySlot: {
        children: featuredDisplay,
      },
      publicHudSlot: {
        children: publicHud,
      },
      styleProfileSlot: {
        children: styleProfile,
      },
      achievementsSlot: {
        children: achievements,
      },
      momentsSlot: {
        children: moments,
      },
      lockedSectionsSlot: {
        children: lockedSections,
      },
      advancedHudSlot: {
        children: advancedHud,
      },
      poolComparisonsSlot: {
        children: poolComparisons,
      },
      coachingSignalsSlot: {
        children: coachingSignals,
      },
      archivedSeasonsSlot: {
        children: archivedSeasons,
      },
      ...namedSectionOverrides,
    }
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050505",
        color: "white",
        padding: "48px",
      }}
    >
      <PlasmicRootProvider loader={PLASMIC} prefetchedData={plasmicData}>
        <PlasmicComponent
          component="PlayerProfileTemplate"
          componentProps={componentProps}
        />
      </PlasmicRootProvider>
    </main>
  );
}
