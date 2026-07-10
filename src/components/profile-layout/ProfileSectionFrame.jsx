import { sanitizeBackgroundUrl } from "@/lib/playerProfileDisplay";
import styles from "./ProfileLayout.module.css";

export default function ProfileSectionFrame({
  eyebrow = "",
  title = "",
  description = "",
  backgroundUrl = "",
  tone = "default",
  hero = false,
  children,
  className = "",
  style,
}) {
  const imageUrl = sanitizeBackgroundUrl(backgroundUrl);
  const toneClass = tone === "alt"
    ? styles.sectionAlt
    : tone === "muted"
      ? styles.sectionMuted
      : "";

  return (
    <section
      className={[styles.section, toneClass, className].filter(Boolean).join(" ")}
      style={{
        ...(imageUrl
          ? {
              backgroundImage: `linear-gradient(90deg, rgba(8, 8, 10, 0.96) 0%, rgba(8, 8, 10, 0.83) 55%, rgba(8, 8, 10, 0.58) 100%), url("${imageUrl.replace(/"/g, "%22")}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }
          : {}),
        ...style,
      }}
    >
      <div className={`${styles.sectionInner} ${hero ? styles.heroInner : ""}`}>
        {title || eyebrow || description ? (
          <header className={styles.sectionHeader}>
            <div>
              {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
              {title ? <h2 className={styles.sectionTitle}>{title}</h2> : null}
            </div>
            {description ? <p className={styles.sectionDescription}>{description}</p> : null}
          </header>
        ) : null}
        <div className={styles.sectionContent}>{children}</div>
      </div>
    </section>
  );
}
