import styles from "./PlayerProfilePage.module.css";
import { MomentPreview, RecapPanel } from "@/components/recaps/RecapComponents";
import { NativeArchiveNav, SectionJumpNav } from "@/components/native-navigation/NativeArchiveNav";
import Link from "next/link";

function cleanText(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value).replace(/\s+@\s+[^\s.,;:!?]+/gu, "").trim();
}

function statValue(stats, sourceKey, fallback = "-") {
  return (
    stats?.find((stat) => stat.sourceKey === sourceKey)?.value ||
    stats?.find((stat) => stat.sourceKey?.endsWith(sourceKey))?.value ||
    fallback
  );
}

function initials(name) {
  return cleanText(name, "P")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function publicStyleLabel(value, fallback = "Developing Profile") {
  const label = cleanText(value, fallback);
  const lower = label.toLowerCase();

  if (lower === "loose aggressive") return "active table presence";
  if (lower === "loose passive") return "showdown-heavy profile";
  if (lower === "tight aggressive") return "patient confrontation style";
  if (lower === "tight passive") return "selective table presence";
  if (lower === "calling station") return "showdown-heavy profile";
  if (lower === "maniac") return "high-activity table presence";
  if (lower === "fish") return "still-forming table identity";
  if (lower === "unscouted") return "table identity still developing";
  if (lower === "developing profile") return "still-forming table identity";
  if (lower === "pressure player") return "active table presence";
  if (lower === "showdown closer") return "late-hand presence";

  return label;
}

function splitLabels(labelsText) {
  const [primary, secondary] = cleanText(labelsText, "still-forming table identity / table identity still developing")
    .split("/")
    .map((part) => part.trim());

  return {
    primary: publicStyleLabel(primary, "still-forming table identity"),
    secondary: publicStyleLabel(secondary, "table identity still developing"),
  };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(cleanText(value));
}

function publicSessionHref(session) {
  const sessionCode = cleanText(session?.sessionCode);
  if (!sessionCode || isUuid(sessionCode)) return "";
  return `/sessions-v2/${encodeURIComponent(sessionCode)}`;
}

function safeKey(...values) {
  const cleanValue = values.map((value) => cleanText(value)).find((value) => value && !isUuid(value));
  return cleanValue || "item";
}

function publicStatKey(stat = {}, index = 0) {
  const label = cleanText(stat.label, `stat-${index}`).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return label || `stat-${index}`;
}

function publicStat(stat = {}, index = 0) {
  return {
    label: cleanText(stat.label, "Record"),
    value: cleanText(stat.value, "-"),
    publicKey: publicStatKey(stat, index),
  };
}

function readableStatLabel(sourceKey = "") {
  const cleanKey = cleanText(sourceKey).toLowerCase();
  if (cleanKey.includes("voluntary")) return "Voluntary pot entry";
  if (cleanKey.includes("action")) return "How often this player entered hands voluntarily";
  if (cleanKey.includes("opening")) return "Preflop initiative";
  if (cleanKey.includes("first raise")) return "How often this player made the first raise";
  if (cleanKey.includes("biggest")) return "Largest collected pot";
  if (cleanKey.includes("rank")) return "Season table position";
  if (cleanKey.includes("points")) return "Verified standings points";
  return "Public tracked metric";
}

export default function PlayerProfilePage({ profileData }) {
  const identity = profileData.identity || profileData;
  const seasonStatus = profileData.seasonStatus || {};
  const playerName = cleanText(identity.playerName || profileData.playerName, "Unknown Player");
  const labels = splitLabels(identity.labelsText || profileData.labelsText);
  const publicStats = profileData.publicHud?.stats?.length
    ? profileData.publicHud.stats.map(publicStat)
    : [...(profileData.coreStats || []), ...(profileData.pokerStats || [])].map(publicStat);
  const moments = profileData.moments?.length
    ? profileData.moments
    : profileData.notableHands || [];
  const badges = profileData.achievements?.length
    ? profileData.achievements
    : profileData.badges || [];
  const firstSessionHref = publicSessionHref(profileData.recentSessions?.[0]);
  const playerHref = profileData.slug
    ? `/players-v2/${encodeURIComponent(profileData.slug)}`
    : "";
  const sectionItems = [
    { label: "Story", href: "#story" },
    { label: "Form", href: "#form" },
    { label: "Moment", href: "#featured-moment" },
    { label: "Top Moments", href: "#top-moments" },
    { label: "Sessions", href: "#sessions" },
  ];

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <NativeArchiveNav
          active="profile"
          seasonCode={seasonStatus.seasonCode || "S0"}
          playerHref={playerHref}
          sessionHref={firstSessionHref}
          label={playerName}
        />
        <SectionJumpNav items={sectionItems} />

        <div className={styles.profileGrid}>
          <section className={styles.mainColumn}>
            <PlayerHero
              playerName={playerName}
              avatarUrl={identity.avatarUrl || profileData.avatarUrl}
              labels={labels}
              bio={identity.bio || profileData.bio}
              seasonCode={seasonStatus.seasonCode || "S0"}
              hands={statValue(profileData.coreStats, "hands", "0")}
            />

            <div id="story" className={styles.anchorBlock}>
              <RecapPanel
                recap={profileData.recaps?.playerSeason}
                eyebrow="Player Dossier"
                showSources={false}
                showTags={false}
                showTakeaways={false}
              />
            </div>

            <div id="form" className={styles.anchorBlock}>
              <RecapPanel
                recap={profileData.recaps?.recentForm}
                eyebrow="Recent Form"
                showSources={false}
                showTags={false}
                showTakeaways={false}
              />
            </div>

            <div id="featured-moment" className={styles.anchorBlock}>
              {profileData.recaps?.featuredMoment ? (
                <RecapPanel
                  recap={profileData.recaps.featuredMoment}
                  eyebrow="Signature Moment"
                  showSources={false}
                  showTags={false}
                />
              ) : (
                <SignatureMomentEmpty />
              )}
            </div>

            <div id="top-moments" className={styles.anchorBlock}>
              <MomentPreview
                recaps={profileData.recaps?.moments || []}
                title="Top moments"
                eyebrow="Profile Moments"
                limit={4}
                ctaHref={firstSessionHref}
                ctaLabel="Read session recap"
              />
            </div>

          </section>

          <aside className={styles.sideColumn} aria-label="Player history feed">
            <PlayerSeasonSummary
              rank={seasonStatus.rankText || profileData.rankText}
              points={seasonStatus.pointsText || profileData.pointsText}
              hands={statValue(profileData.coreStats, "hands", "0")}
              biggestPot={statValue(profileData.coreStats, "biggest_pot_won", "0")}
            />
            <div id="sessions" className={styles.anchorBlock}>
              <MomentFeed moments={moments} sessions={profileData.recentSessions || []} />
            </div>
            <div id="stats" className={styles.anchorBlock}>
              <StatGrid stats={publicStats} />
            </div>
            <div id="badges" className={styles.anchorBlock}>
              <PlayerBadgeStrip badges={badges} />
            </div>
            <LockedFeatureGrid sections={profileData.lockedSections || []} />
          </aside>
        </div>
      </div>
    </main>
  );
}

export function SeasonTabs({ seasonCode }) {
  return (
    <nav className={styles.seasonTabs} aria-label="Profile season">
      <span className={styles.brandMark}>Para Poker</span>
      <span className={styles.activeSeason}>{seasonCode} Preseason</span>
      <span className={styles.futureSeason}>Archives</span>
      <span className={styles.futureSeason}>Private Files</span>
    </nav>
  );
}

export function PlayerHero({ playerName, avatarUrl, labels, bio, seasonCode, hands }) {
  return (
    <header className={styles.hero}>
      <div className={styles.avatarFrame}>
        {avatarUrl ? (
          <img className={styles.avatarImage} src={avatarUrl} alt="" />
        ) : (
          <div className={styles.avatarFallback}>{initials(playerName)}</div>
        )}
      </div>
      <div className={styles.heroCopy}>
        <div className={styles.heroMeta}>
          <span>{seasonCode} player file</span>
          <span>{hands} tracked hands</span>
        </div>
        <h1>{playerName}</h1>
        <p className={styles.archetype}>
          <span>{labels.primary}</span>
          <span>{labels.secondary}</span>
        </p>
        <p className={styles.bio}>{cleanText(bio, "This dossier is being shaped from verified Para Poker results, session recaps, and table moments.")}</p>
      </div>
    </header>
  );
}

export function PlayerSeasonSummary({ rank, points, hands, biggestPot }) {
  const items = [
    ["Rank", rank || "-"],
    ["Points", points || "0"],
    ["Hands", hands || "0"],
    ["Biggest Pot", biggestPot || "0"],
  ];

  return (
    <section className={styles.summaryBar} aria-label="Season summary">
      {items.map(([label, value]) => (
        <article key={label} className={styles.summaryItem}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}

export function FeaturedStatCard({ card, fallbackStat }) {
  const stat = card || fallbackStat || {};
  const title = cleanText(stat.title || stat.label, "Featured Stat");
  const value = cleanText(stat.value, "-");

  return (
    <article className={`${styles.featuredCard} ${styles.featuredStat}`}>
      <span className={styles.cardKicker}>Season Snapshot</span>
      <h2>{title}</h2>
      <strong>{value}</strong>
      <p>{cleanText(stat.subtitle, readableStatLabel(stat.label))}</p>
    </article>
  );
}

export function SeasonStandingCard({ card, seasonCode, rank, points, approvedSessions }) {
  const sessionCount = Number(approvedSessions) || 0;
  const sessionWord = sessionCount === 1 ? "session" : "sessions";

  return (
    <article className={`${styles.featuredCard} ${styles.standingCard}`}>
      <span className={styles.cardKicker}>Season Standing</span>
      <h2>{cleanText(card?.title, `Ranked ${rank || "-"} in ${seasonCode}`)}</h2>
      <strong>{cleanText(card?.value, rank || "-")}</strong>
      <p>{cleanText(card?.subtitle, `${points || "0"} points through ${sessionCount} verified ${sessionWord}`)}</p>
    </article>
  );
}

export function FeaturedMomentCard({ card, moment }) {
  const title = cleanText(card?.title || moment?.displayTitle || moment?.title, "No signature moment has been pinned yet");
  const value = cleanText(card?.value || (moment?.handNo ? `Hand #${moment.handNo}` : ""), "");
  const summary = cleanText(
    card?.subtitle || moment?.displaySummary || moment?.description,
    "A signature hand will appear here once a meaningful public moment is pinned or earned."
  );

  return (
    <article className={`${styles.featuredCard} ${styles.momentFeature}`}>
      <span className={styles.cardKicker}>Featured Moment</span>
      <h2>{title}</h2>
      <strong>{value}</strong>
      <p>{summary}</p>
    </article>
  );
}

export function StatGrid({ stats = [] }) {
  const visibleStats = stats.slice(0, 6);

  return (
    <section className={styles.sectionBlock}>
      <div className={styles.sectionHeader}>
        <span>Public Record</span>
        <h2>Season Snapshot</h2>
      </div>
      {visibleStats.length ? (
        <div className={styles.statGrid}>
          {visibleStats.map((stat) => (
            <article key={stat.publicKey || stat.label} className={styles.statTile}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{readableStatLabel(stat.label)}</small>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Season snapshot forming" copy="Verified season stats will populate this grid as the player logs more sessions." />
      )}
    </section>
  );
}

export function PlayerBadgeStrip({ badges = [] }) {
  return (
    <section className={styles.sectionBlock}>
      <div className={styles.sectionHeader}>
        <span>Badges</span>
        <h2>Profile Markers</h2>
      </div>
      {badges.length ? (
        <div className={styles.badgeStrip}>
          {badges.map((badge) => (
            <span key={badge.label} className={`${styles.badge} ${styles[`badge_${badge.tone || "neutral"}`] || ""}`}>
              {badge.label}
            </span>
          ))}
        </div>
      ) : (
        <EmptyState title="Badges still forming" copy="Achievements will appear here when verified milestones give the profile something to wear." />
      )}
    </section>
  );
}

export function LockedFeatureGrid({ sections = [] }) {
  const fallbackSections = sections.length
    ? sections
    : [
        {
          key: "advanced-record",
          title: "Advanced Record",
          description: "Deeper season record views are planned for a future tier.",
        },
        {
          key: "player-trends",
          title: "Player Trends",
          description: "Form lines and season movement are planned for a future tier.",
        },
        {
          key: "future-archives",
          title: "Archived Seasons",
          description: "Past season files will live here when the league archive opens beyond the current run.",
        },
      ];

  return (
    <section className={styles.sectionBlock}>
      <div className={styles.sectionHeader}>
        <span>Locked Modules</span>
        <h2>Profile Depth</h2>
      </div>
      <div className={styles.lockedGrid}>
        {fallbackSections.map((section) => (
          <article key={section.key} className={styles.lockedCard}>
            <span>Locked</span>
            <h3>{section.title}</h3>
            <p>{section.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function MomentFeed({ moments = [], sessions = [] }) {
  return (
    <div className={styles.feed}>
      <div className={styles.feedHeader}>
        <span>Dossier Trail</span>
        <h2>Session Pathways</h2>
      </div>

      <div className={styles.sessionList}>
        <h3>Recent Sessions</h3>
        {sessions.length ? (
          sessions.slice(0, 6).map((session, index) => (
            <article key={safeKey(session.sessionCode, session.label, `session-${index}`)} className={styles.sessionRow}>
              <strong>{session.label || session.sessionCode || "Session"}</strong>
              <span>{session.dateText || "Date pending"}</span>
              <small>{session.handsText || "-"} hands / {session.resultText || "-"}</small>
              {publicSessionHref(session) ? (
                <Link className={styles.sessionLink} href={publicSessionHref(session)}>
                  Read session recap
                </Link>
              ) : null}
            </article>
          ))
        ) : (
          <p className={styles.feedNote}>This player has not entered enough verified sessions for a clear trail yet.</p>
        )}
      </div>
      {moments[0] ? <MomentCard moment={moments[0]} /> : null}
    </div>
  );
}

export function MomentCard({ moment }) {
  const title = cleanText(moment.displayTitle || moment.title, "Notable Moment");
  const summary = cleanText(moment.displaySummary || moment.description, "A verified profile moment from the current season.");
  const meta = cleanText(moment.displayMeta || moment.subtitle || moment.contextLine, "");
  const tags = moment.displayTags || [];
  const momentHref = moment.sessionCode && !isUuid(moment.sessionCode)
    ? `/sessions-v2/${encodeURIComponent(moment.sessionCode)}${moment.handNo ? `#moment-hand-${encodeURIComponent(moment.handNo)}` : ""}`
    : "";

  return (
    <article className={styles.momentCard}>
      <span>{cleanText(moment.contextLine || moment.sessionCode, "Season hand")}</span>
      <h3>{title}</h3>
      <p>{summary}</p>
      {meta ? <small>{meta}</small> : null}
      {tags.length ? (
        <div className={styles.tagRow}>
          {tags.slice(0, 3).map((tag) => (
            <em key={tag}>{tag}</em>
          ))}
        </div>
      ) : null}
      {momentHref ? <Link className={styles.sessionLink} href={momentHref}>Read in session recap</Link> : null}
    </article>
  );
}

function SignatureMomentEmpty() {
  return (
    <section className={styles.sectionBlock}>
      <div className={styles.sectionHeader}>
        <span>Signature Moment</span>
        <h2>No signature moment has been pinned yet</h2>
      </div>
      <EmptyState
        title="Signature slot open"
        copy="A signature hand will appear here once a meaningful public moment is pinned or earned."
      />
    </section>
  );
}

function EmptyState({ title, copy }) {
  return (
    <div className={styles.emptyState}>
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}
