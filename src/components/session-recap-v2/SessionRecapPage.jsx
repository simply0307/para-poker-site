import { MomentRecapCard, SessionRecapCard } from "@/components/recaps/RecapComponents";
import { NativeArchiveNav, SectionJumpNav } from "@/components/native-navigation/NativeArchiveNav";
import styles from "./SessionRecapPage.module.css";

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function formatDate(value) {
  if (!value) return "Date pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date pending";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function cleanName(value) {
  return text(value, "Unknown Player").replace(/\s+@\s+\S+\s*$/u, "").trim();
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(text(value));
}

function safeKey(...values) {
  const cleanValue = values.map((value) => text(value).trim()).find((value) => value && !isUuid(value));
  return cleanValue || "item";
}

function formatChips(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed.toLocaleString("en-US")} chips` : "";
}

function resultSort(left, right) {
  return Number(left?.result?.finish || 99) - Number(right?.result?.finish || 99);
}

export default function SessionRecapPage({ sessionData }) {
  const { session, participants, biggestPots, handHistories = [], recaps, editorial } = sessionData;
  const historiesByHandNo = new Map(handHistories.map((history) => [String(history.handNo), history]));
  const meta = [
    { label: "Date", value: formatDate(session.played_at) },
    { label: "Format", value: text(session.format, "-") },
    { label: "Hands", value: text(session.hands_count, "-") },
    { label: "Players", value: text(participants.length, "0") },
  ];
  const sessionHref = session.session_code && !isUuid(session.session_code)
    ? `/sessions-v2/${encodeURIComponent(session.session_code)}`
    : "";
  const leadParticipant =
    participants.find((participant) => cleanName(participant.name) === cleanName(editorial?.playerOfSession?.name)) ||
    participants.find((participant) => participant.slug);
  const firstPlayerHref = leadParticipant?.slug
    ? `/players-v2/${encodeURIComponent(leadParticipant.slug)}`
    : "";
  const sectionItems = [
    { label: "Story", href: "#story" },
    { label: "Moments", href: "#moments" },
    { label: "Players", href: "#players" },
    { label: "Pulse", href: "#pulse" },
  ];
  const orderedParticipants = participants.slice().sort(resultSort);
  const winnerParticipant =
    orderedParticipants.find((participant) => participant.result?.approved) ||
    orderedParticipants[0] ||
    null;
  const strongestNonWinner =
    orderedParticipants.find((participant) =>
      participant.name !== winnerParticipant?.name &&
      (participant.result?.approved || Number(participant.hands) > 0)
    ) || null;
  const definingMoment = recaps.moments?.[0] || null;
  const biggestPotText = editorial?.biggestPot?.pot_collected
    ? formatChips(editorial.biggestPot.pot_collected)
    : "";

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <NativeArchiveNav
          active="session"
          seasonCode={session.season_code || "S0"}
          playerHref={firstPlayerHref}
          sessionHref={sessionHref}
          label={session.session_code || "Session Recap"}
        />
        <SectionJumpNav items={sectionItems} />

        <div className={styles.grid}>
          <section className={styles.mainColumn}>
            <SessionStoryLead
              session={session}
              recap={recaps.session}
              meta={meta}
              winner={winnerParticipant}
              strongestNonWinner={strongestNonWinner}
              definingMoment={definingMoment}
              biggestPot={editorial?.biggestPot}
              biggestPotText={biggestPotText}
            />

            <section id="moments" className={`${styles.section} ${styles.anchorBlock}`}>
              <div className={styles.sectionHeader}>
                <span>Notable Moments</span>
                <h2>Defining hands</h2>
              </div>
              {recaps.moments?.length ? (
                <div className={styles.momentStack}>
                  {recaps.moments.slice(0, 10).map((recap, index) => (
                    <MomentRecapCard key={safeKey(recap.anchorId, recap.headline, `moment-${index}`)} recap={recap} />
                  ))}
                </div>
              ) : (
                <Empty title="Moments awaiting review" copy="Notable hands will appear once the session has verified hand-level detail." />
              )}
            </section>

            <section id="players" className={`${styles.section} ${styles.anchorBlock}`}>
              <div className={styles.sectionHeader}>
                <span>Participants</span>
                <h2>Player pathways</h2>
              </div>
              {participants.length ? (
                <div className={styles.participantGrid}>
                  {participants.map((participant, index) => (
                    <SessionRecapCard
                      key={safeKey(participant.slug, participant.name, `participant-${index}`)}
                      session={session}
                      participant={participant}
                    />
                  ))}
                </div>
              ) : (
                <Empty title="Participants pending" copy="Verified player lines will appear here once the session record is complete." />
              )}
            </section>
          </section>

          <aside className={styles.sideColumn}>
            <SessionPulse
              session={session}
              winner={winnerParticipant}
              strongestNonWinner={strongestNonWinner}
              turningPoint={editorial?.turningPoint}
              biggestPot={editorial?.biggestPot}
              biggestPotText={biggestPotText}
              participants={participants}
            />

            <section className={`${styles.section} ${styles.anchorBlock}`}>
              <div className={styles.sectionHeader}>
                <span>Big Pot Index</span>
                <h2>Largest pots</h2>
              </div>
              {biggestPots.length ? (
                <div className={styles.potList}>
                  {biggestPots.map((hand, index) => (
                    <article key={safeKey(hand.hand_no ? `hand-${hand.hand_no}` : "", hand.hand_code, `pot-${index}`)}>
                      <strong>Hand #{hand.hand_no || "-"}</strong>
                      <span>{formatChips(hand.pot_collected)}</span>
                      <p>{cleanName(hand.winner_name)} won this listed pot.</p>
                      {hand.board ? <small>{hand.board}</small> : null}
                      {historiesByHandNo.get(String(hand.hand_no))?.actions?.length ? (
                        <a href={`#moment-hand-${hand.hand_no}`}>
                          View Full Hand
                        </a>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <Empty title="Pot leaders pending" copy="Biggest pots will appear once verified hand data is attached." />
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function SessionStoryLead({ session, recap, meta, winner, strongestNonWinner, definingMoment, biggestPot, biggestPotText }) {
  const paragraphs = text(recap?.long_body || recap?.body)
    .split(/\n\n+/)
    .filter(Boolean)
    .slice(0, 4);
  const winnerName = cleanName(winner?.name || winner?.result?.player_name, "");
  const nonWinnerName = cleanName(strongestNonWinner?.name, "");
  const playerCount = Number(meta.find((item) => item.label === "Players")?.value || 0);
  const isSmallField = playerCount > 0 && playerCount <= 2;

  return (
    <article id="story" className={`${styles.articleLead} ${styles.anchorBlock}`}>
      <div className={styles.articleTop}>
        <span>Session Recap</span>
        <h1>{text(recap?.headline || recap?.title, `${session.session_code || "Session"} Recap`)}</h1>
        {recap?.dek ? <p className={styles.dek}>{recap.dek}</p> : null}
      </div>

      <p className={styles.lede}>{text(recap?.short_summary || recap?.summary, "The verified session story will appear here once the result is complete.")}</p>

      <div className={styles.storyBeats}>
        <StoryBeat
          label="Session Texture"
          copy={isSmallField
            ? `${text(session.format, "Tracked")} two-player record${session.hands_count ? ` across ${session.hands_count} hands` : ""}. A first read, not a final verdict.`
            : `${text(session.format, "Tracked")} session${session.hands_count ? ` across ${session.hands_count} hands` : ""}, with ${playerCount || "0"} players in the public record.`}
        />
        <StoryBeat
          label="Winner Story"
          copy={winnerName ? `${winnerName} finished #${winner?.result?.finish || "1"} with ${winner?.result?.league_points || 0} league points.` : "The winning result is still pending review."}
        />
        <StoryBeat
          label="Pressure Run"
          copy={nonWinnerName
            ? isSmallField
              ? `${nonWinnerName} kept the second side of the record visible.`
              : `${nonWinnerName} gives the recap a second player path to follow beyond the winner.`
            : "A runner-up note will appear when the verified result has enough detail."}
        />
        <StoryBeat
          label="Defining Moment"
          copy={definingMoment ? `${definingMoment.momentRole || "Defining Hand"}${definingMoment.handNo ? `, Hand #${definingMoment.handNo}` : ""}${biggestPotText ? `, with ${biggestPotText} in the record` : ""}.` : "A defining hand will appear once notable moments are reviewed."}
        />
        <StoryBeat
          label="Archive Meaning"
          copy={biggestPot
            ? isSmallField
              ? "The opener has a winner, a runner-up, and one clear largest pot to start the season file."
              : "The session now has a verified winner, a largest pot, and a hand trail readers can reopen."
            : "The session result is logged; deeper meaning will sharpen as more verified hand detail enters the recap."}
        />
      </div>

      {paragraphs.length ? (
        <div className={styles.articleBody}>
          {paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function StoryBeat({ label, copy }) {
  return (
    <section>
      <span>{label}</span>
      <p>{copy}</p>
    </section>
  );
}

function SessionPulse({ session, winner, strongestNonWinner, turningPoint, biggestPot, biggestPotText, participants }) {
  const items = [
    ["Biggest Pot", biggestPot ? `${biggestPotText || formatChips(biggestPot.pot_collected)} / Hand #${biggestPot.hand_no || "-"}` : "Pending"],
    ["Turning Point", turningPoint ? `Hand #${turningPoint.hand_no || "-"}` : "Pending"],
    ["Winner", winner ? cleanName(winner.name || winner.result?.player_name) : "Pending"],
    ["Pressure Run", strongestNonWinner ? cleanName(strongestNonWinner.name) : "Pending"],
    ["Hands Tracked", text(session.hands_count, "-")],
    ["Players", text(participants.length, "0")],
  ];

  return (
    <section id="pulse" className={`${styles.section} ${styles.anchorBlock}`}>
      <div className={styles.sectionHeader}>
        <span>Session Pulse</span>
        <h2>At a glance</h2>
      </div>
      <dl className={styles.pulseList}>
        {items.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Empty({ title, copy }) {
  return (
    <div className={styles.empty}>
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}
