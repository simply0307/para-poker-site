import Link from "next/link";
import styles from "./NativeArchiveNav.module.css";

export function NativeArchiveNav({
  active = "",
  seasonCode = "S0",
  playerHref = "",
  sessionHref = "",
  sessionsHref = "/sessions-v2",
  label = "",
}) {
  const primaryLinks = [
    { key: "players", label: "Players", href: "/players-v2" },
    { key: "sessions", label: "Sessions", href: sessionsHref },
  ];
  const contextLinks = [
    playerHref ? { key: "profile", label: "Dossier", href: playerHref } : null,
    sessionHref ? { key: "session", label: "Session Recap", href: sessionHref } : null,
  ].filter(Boolean);

  return (
    <nav className={styles.nav} aria-label="Para Poker archive navigation">
      <Link className={styles.brand} href="/players-v2" aria-label={`Para Poker ${seasonCode} Preseason`}>
        <span>Para Poker</span>
        <strong>{seasonCode} Preseason</strong>
      </Link>

      <div className={styles.links}>
        {primaryLinks.map((link) => (
          <Link
            key={link.key}
            className={active === link.key ? styles.activeLink : styles.link}
            href={link.href}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className={styles.contextGroup}>
        {contextLinks.map((link) => (
          <Link
            key={link.key}
            className={active === link.key ? styles.contextActive : styles.contextLink}
            href={link.href}
          >
            {link.label}
          </Link>
        ))}
        {label ? <div className={styles.context}>{label}</div> : null}
      </div>
    </nav>
  );
}

export function SectionJumpNav({ items = [] }) {
  const visibleItems = items.filter((item) => item?.href && item?.label);
  if (!visibleItems.length) return null;

  return (
    <nav className={styles.sectionNav} aria-label="Page sections">
      {visibleItems.map((item) => (
        <a key={item.href} href={item.href}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}
