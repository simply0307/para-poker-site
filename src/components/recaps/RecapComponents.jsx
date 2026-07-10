import Link from "next/link";
import styles from "./RecapComponents.module.css";

function cleanText(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value).replace(/\s+@\s+[^\s.,;:!?]+/gu, "").trim();
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(cleanText(value));
}

function safeKey(...values) {
  const cleanValue = values.map((value) => cleanText(value)).find((value) => value && !isUuid(value));
  return cleanValue || "item";
}

function momentAnchor(recap) {
  if (recap?.anchorId) return recap.anchorId;
  const handFact = (recap?.sourceFacts || []).find((fact) => fact.id === "hand_no");
  const handNo = cleanText(handFact?.value || "").replace(/^#/u, "");
  const cleanHand = handNo.replace(/[^a-z0-9-]+/giu, "-").replace(/^-|-$/g, "");
  return cleanHand ? `moment-hand-${cleanHand}` : undefined;
}

export function RecapStatusBadge({ status = "draft", stored = false }) {
  const label = stored ? "Published recap" : "Recap note";
  return <span className={`${styles.status} ${styles[`status_${status}`] || ""}`}>{label}</span>;
}

export function RecapTagRow({ tags = [] }) {
  if (!tags.length) return null;

  return (
    <div className={styles.tags}>
      {tags.map((tag) => (
        <span key={tag}>{tag}</span>
      ))}
    </div>
  );
}

export function RecapSourceList({ facts = [], title = "Hand details" }) {
  const publicFacts = facts.filter(
    (fact) => !["session", "hand_id"].includes(fact.id)
  );

  return (
    <div className={styles.sources}>
      <div className={styles.sourcesHeader}>{title}</div>
      {publicFacts.length ? (
        <dl>
          {publicFacts.map((fact) => (
            <div key={fact.id}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>Public hand details will appear here when the recap has enough supporting context.</p>
      )}
    </div>
  );
}

export function ExpandableRecapBody({ body }) {
  const paragraphs = cleanText(body, "Official recap pending. Once this session is reviewed, the story of the table will appear here.")
    .split(/\n\n+/)
    .filter(Boolean);

  return (
    <div className={styles.longform}>
      {paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </div>
  );
}

export function SourceFactsDisclosure({ facts = [], label = "Details" }) {
  if (!facts.length) return null;

  return (
    <details className={styles.sourceDisclosure}>
      <summary>{label}</summary>
      <div className={styles.sourceDisclosureInner}>
        <RecapSourceList facts={facts} title={label} />
      </div>
    </details>
  );
}

function streetLabel(value) {
  const cleanValue = cleanText(value, "Action");
  return cleanValue.charAt(0).toUpperCase() + cleanValue.slice(1);
}

function actionLine(action) {
  const amount = action.amount ? ` ${action.amount}` : "";
  return `${cleanText(action.action, "acts")}${amount}${action.allIn ? " / all-in" : ""}`;
}

export function HandHistoryPanel({ handHistory }) {
  if (!handHistory?.actions?.length) return null;

  const streets = handHistory.actions.reduce((groups, action) => {
    const street = action.street || "action";
    if (!groups.has(street)) groups.set(street, []);
    groups.get(street).push(action);
    return groups;
  }, new Map());

  return (
    <details className={styles.handHistory} aria-label={`Hand ${handHistory.handNo || ""} action history`}>
      <summary className={styles.handHistorySummary}>
        <div>
          <span className={styles.eyebrow}>Hand History</span>
          <h4>{handHistory.handNo ? `Hand #${handHistory.handNo}` : "Full hand action"}</h4>
        </div>
        <div className={styles.handMeta}>
          {handHistory.potText ? <span>{handHistory.potText}</span> : null}
          {handHistory.winnerName ? <span>{handHistory.winnerName}</span> : null}
        </div>
      </summary>

      <div className={styles.handHistoryBody}>
        {handHistory.board || handHistory.winningHand ? (
          <p className={styles.handSummary}>
            {[handHistory.board, handHistory.winningHand ? `Winning hand: ${handHistory.winningHand}` : ""]
              .filter(Boolean)
              .join(" / ")}
          </p>
        ) : null}

        <div className={styles.streetStack}>
          {[...streets.entries()].map(([street, actions]) => (
            <div key={street} className={styles.streetBlock}>
              <span>{streetLabel(street)}</span>
              <ol>
                {actions.map((action, index) => (
                  <li key={`${action.order}-${index}`}>
                    <strong>{cleanText(action.playerName, "Player")}</strong>
                    {action.position ? <em>{action.position}</em> : null}
                    <span>{actionLine(action)}</span>
                    {(action.isOpenRaise || action.is3bet || action.isCallVsRaise) ? (
                      <small>
                        {[
                          action.isOpenRaise ? "open raise" : "",
                          action.is3bet ? "3-bet" : "",
                          action.isCallVsRaise ? "called raise" : "",
                        ].filter(Boolean).join(" / ")}
                      </small>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

      </div>
    </details>
  );
}

export function RecapPanel({
  recap,
  eyebrow = "Narrative Archive",
  compact = false,
  showSources = false,
  showTags = true,
  showTakeaways = true,
}) {
  if (!recap) {
    return (
      <section className={styles.panel}>
        <div className={styles.empty}>
          <strong>Recap not published yet</strong>
          <p>Once this table story is reviewed, the official recap will appear here.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={`${styles.panel} ${compact ? styles.compact : ""}`}>
      <div className={styles.panelTop}>
        <div>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h2>{recap.headline || recap.title}</h2>
          {recap.dek ? <p className={styles.dek}>{recap.dek}</p> : null}
        </div>
      </div>
      <p className={styles.summary}>{recap.short_summary || recap.summary}</p>
      {showTakeaways && recap.key_takeaways?.length ? (
        <ul className={styles.takeaways}>
          {recap.key_takeaways.slice(0, 4).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {showTags ? <RecapTagRow tags={recap.tags || []} /> : null}
      {!compact ? <ExpandableRecapBody body={recap.long_body || recap.body} /> : null}
      {!compact && showSources ? (
        <SourceFactsDisclosure facts={recap.sourceFacts || []} />
      ) : null}
    </section>
  );
}

export function RecapHero({ recap, meta = [] }) {
  return (
    <header className={styles.hero}>
      <div>
        <span className={styles.eyebrow}>Session Recap</span>
        <h1>{cleanText(recap?.headline || recap?.title, "Session Recap")}</h1>
        {recap?.dek ? <p className={styles.heroDek}>{recap.dek}</p> : null}
        <p>{cleanText(recap?.short_summary || recap?.summary, "Session details will appear here.")}</p>
      </div>
      <div className={styles.heroMeta}>
        {meta.map((item) => (
          <span key={item.label}>
            <strong>{item.value}</strong>
            {item.label}
          </span>
        ))}
      </div>
    </header>
  );
}

export function MomentRecapCard({ recap, compact = false }) {
  const title = cleanText(recap?.headline || recap?.title, "Defining Hand");
  const potText = cleanText(recap?.potText || recap?.key_takeaways?.find((item) => item.includes("chips")), "");
  const players = (recap?.involvedPlayers || []).map((player) => cleanText(player)).filter(Boolean);
  const winner = cleanText(recap?.winnerName || recap?.relatedPlayerName, "");
  const impact = cleanText(recap?.sessionImpact || recap?.short_summary || recap?.summary, "This hand belongs in the public session story.");
  const opponent = players.find((player) => player !== winner);
  const resultLine = [
    winner && opponent ? `${winner} over ${opponent}` : winner || players.join(" / "),
    potText,
  ].filter(Boolean).join(" · ");

  return (
    <article id={momentAnchor(recap)} className={styles.momentCard}>
      <div className={styles.cardTop}>
        <span>{cleanText(recap?.momentRole || recap?.tags?.[0], "Defining Hand")}</span>
      </div>
      <h3>{title}</h3>
      {resultLine ? <p className={styles.resultLine}>{resultLine}</p> : null}
      <div className={styles.impactBlock}>
        <span>{cleanText(recap?.impactLabel, "Why It Mattered")}</span>
        <p>{impact}</p>
      </div>
      {!compact ? (
        <>
          <HandHistoryPanel handHistory={recap?.handHistory} />
        </>
      ) : null}
      {compact && recap?.href ? <Link href={recap.href}>Read in session recap</Link> : null}
    </article>
  );
}

export function SessionRecapCard({ session, participant }) {
  const result = participant.result;
  return (
    <article className={styles.sessionCard}>
      <h3>{participant.name}</h3>
      <div className={styles.sessionStats}>
        <span>{participant.hands} hands</span>
        <span>Action {participant.vpip}</span>
        <span>First raise {participant.pfr}</span>
        <span>Biggest pot {participant.biggestPot}</span>
      </div>
      <p>
        {result
          ? `Finished #${result.finish || "-"} with ${result.league_points || 0} league points. Their session belongs in the player pathway for this recap.`
          : `${participant.name} has a verified session line attached to ${session.session_code || "this recap"}.`}
      </p>
      {participant.slug ? (
        <Link href={`/players-v2/${encodeURIComponent(participant.slug)}`}>Open player dossier</Link>
      ) : null}
    </article>
  );
}

export function ArchiveFeed({ recaps = [] }) {
  return <MomentPreview title="Moment Archive" recaps={recaps} />;
}

export function MomentPreview({
  recaps = [],
  title = "Top Moments",
  eyebrow = "Moments",
  limit = 5,
  ctaHref = "",
  ctaLabel = "Open full recap",
}) {
  const visible = recaps.slice(0, limit);

  return (
    <section className={styles.archive}>
      <div className={styles.archiveHeader}>
        <div>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        {ctaHref ? <Link className={styles.archiveCta} href={ctaHref}>{ctaLabel}</Link> : null}
      </div>
      {visible.length ? (
        <div className={styles.archiveGrid}>
          {visible.map((recap, index) => (
            <MomentRecapCard key={safeKey(recap.anchorId, recap.headline, `moment-${index}`)} recap={recap} compact />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <strong>Moments awaiting review</strong>
          <p>Key hands will appear here once the session record has enough verified detail.</p>
        </div>
      )}
    </section>
  );
}
