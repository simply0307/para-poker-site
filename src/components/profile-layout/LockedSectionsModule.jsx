import styles from "./ProfileLayout.module.css";

export default function LockedSectionsModule({ sections = [] }) {
  return (
    <div className={styles.lockedGrid}>
      {(sections || []).map((section) => (
        <article key={section.key || section.title} className={styles.lockedCard}>
          <p className={styles.lockedStatus}>Scouting preview</p>
          <h3 className={styles.lockedTitle}>{section.title}</h3>
          <p className={styles.lockedCopy}>{section.description}</p>
        </article>
      ))}
    </div>
  );
}
