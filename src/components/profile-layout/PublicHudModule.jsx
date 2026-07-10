import styles from "./ProfileLayout.module.css";

function displayValue(stat) {
  if (/pot/i.test(stat.label || "") && Number.isFinite(Number(stat.value))) {
    return Number(stat.value).toLocaleString("en-US");
  }
  return stat.value;
}

export default function PublicHudModule({ stats = [] }) {
  return (
    <div className={styles.hudGrid}>
      {(stats || []).map((stat) => {
        const primary = ["VPIP", "PFR"].includes(stat.label);
        return (
          <div
            key={stat.sourceKey || stat.label}
            className={`${styles.hudCard} ${primary ? styles.hudCardPrimary : ""}`}
          >
            <span className={styles.hudLabel}>{stat.label}</span>
            <strong className={styles.hudValue}>{displayValue(stat)}</strong>
            <span className={styles.hudHint}>{primary ? "Public tendency" : "Season snapshot"}</span>
          </div>
        );
      })}
    </div>
  );
}
