import { sanitizeBackgroundUrl } from "@/lib/playerProfileDisplay";
import styles from "./ProfileLayout.module.css";

function cleanDisplayName(value) {
  return String(value || "Unknown Player").replace(/\s+@\s+\S+\s*$/u, "").trim();
}

function displayStatValue(stat) {
  const value = stat?.value ?? "-";
  if (/pot/i.test(stat?.label || "") && Number.isFinite(Number(value))) {
    return Number(value).toLocaleString("en-US");
  }
  return value;
}

export default function PlayerHeroModule({ identity = {}, seasonStatus = {}, coreStats = [] }) {
  const playerName = cleanDisplayName(identity.playerName);
  const initial = playerName[0]?.toUpperCase() || "P";
  const avatarUrl = sanitizeBackgroundUrl(identity.avatarUrl);

  return (
    <div className={styles.hero}>
      <div className={styles.avatarFrame}>
        <div
          role="img"
          aria-label={`${playerName} avatar`}
          className={styles.avatar}
          style={avatarUrl
            ? {
                backgroundImage: `url("${avatarUrl.replace(/"/g, "%22")}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                color: "transparent",
              }
            : undefined}
        >
          {initial}
        </div>
      </div>

      <div className={styles.identity}>
        <div className={styles.heroTopline}>
          <span className={styles.seasonPill}>{seasonStatus.seasonCode || "S0"} season</span>
          <span className={styles.statusPill}>Public player file</span>
        </div>
        <h1 className={styles.heroName}>{playerName}</h1>
        <p className={styles.heroLabels}>{identity.labelsText || "Developing Profile"}</p>
        <p className={styles.heroBio}>{identity.bio || "Profile details are still being prepared."}</p>
      </div>

      <div className={styles.summaryGrid}>
        {(coreStats || []).slice(0, 4).map((stat) => (
          <div key={stat.sourceKey || stat.label} className={styles.summaryItem}>
            <span className={styles.summaryLabel}>{stat.label}</span>
            <strong className={styles.summaryValue}>{displayStatValue(stat)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
