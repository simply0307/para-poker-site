import styles from "./ProfileLayout.module.css";

export default function MomentsModule({ moments = [], limit = 5 }) {
  const visibleMoments = (moments || []).slice(0, limit);

  return (
    <div className={styles.momentsGrid}>
      {visibleMoments.map((moment, index) => (
        <article
          key={moment.id || `${moment.displayTitle}-${index}`}
          className={`${styles.momentCard} ${index === 0 ? styles.momentLead : ""}`}
        >
          <div>
            {moment.contextLine ? <p className={styles.momentContext}>{moment.contextLine}</p> : null}
            <h3 className={styles.momentTitle}>{moment.displayTitle || "Notable Moment"}</h3>
            {moment.displayMeta ? <p className={styles.momentMeta}>{moment.displayMeta}</p> : null}
          </div>
          <div>
            <p className={styles.momentSummary}>{moment.displaySummary || "A tracked profile moment."}</p>
            <div className={styles.tagRow}>
              {(moment.displayTags || []).map((tag) => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </div>
          </div>
        </article>
      ))}
      {!visibleMoments.length ? <p className={styles.emptyState}>Season highlights will appear here as hands are tracked.</p> : null}
    </div>
  );
}
