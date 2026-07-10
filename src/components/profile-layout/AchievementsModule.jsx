import styles from "./ProfileLayout.module.css";

function badgeCode(label, index) {
  const words = String(label || "Achievement").split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
  return initials || String(index + 1).padStart(2, "0");
}

export default function AchievementsModule({ achievements = [] }) {
  return (
    <div className={styles.achievementGrid}>
      {(achievements || []).map((achievement, index) => (
        <article key={achievement.id || achievement.label || index} className={styles.achievement}>
          <div className={styles.medallion} aria-hidden="true">{badgeCode(achievement.label, index)}</div>
          <div>
            <strong className={styles.achievementTitle}>{achievement.label || "Profile Achievement"}</strong>
            <p className={styles.achievementCopy}>Recognized from tracked season performance.</p>
          </div>
        </article>
      ))}
      {!achievements?.length ? <p className={styles.emptyState}>The trophy shelf will grow with future achievements.</p> : null}
    </div>
  );
}
