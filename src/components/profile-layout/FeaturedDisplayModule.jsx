import styles from "./ProfileLayout.module.css";

const CARD_ACCENTS = {
  stat: "#86efac",
  result: "#fbbf24",
  moment: "#fb7185",
  achievement: "#60a5fa",
};

export default function FeaturedDisplayModule({ cards = [], className = "", style }) {
  return (
    <div className={[styles.featuredGrid, className].filter(Boolean).join(" ")} style={style}>
      {(cards || []).slice(0, 3).map((card, index) => (
        <article
          key={card.slot || `${card.title}-${index}`}
          className={styles.featuredCard}
          style={{ "--card-accent": CARD_ACCENTS[card.type] || "#fbbf24" }}
        >
          <span className={styles.featuredIndex}>0{index + 1}</span>
          <p className={styles.featuredLabel}>{card.label || "Featured Display"}</p>
          <h3 className={styles.featuredTitle}>{card.title || "Coming soon"}</h3>
          {card.value ? <strong className={styles.featuredValue}>{card.value}</strong> : null}
          {card.subtitle ? <p className={styles.featuredSubtitle}>{card.subtitle}</p> : null}
        </article>
      ))}
      {!cards?.length ? <p className={styles.emptyState}>Player-selected showcase cards will appear here.</p> : null}
    </div>
  );
}
