import Link from "next/link";
import { NativeArchiveNav } from "@/components/native-navigation/NativeArchiveNav";
import { supabase } from "@/lib/supabase";
import styles from "./SessionsV2Page.module.css";

export const revalidate = 60;

export const metadata = {
  title: "Session Recaps | Para Poker Preseason",
  description: "Para Poker session recaps, player pathways, and verified preseason stories.",
};

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function cleanName(value, fallback = "Unknown Player") {
  return text(value, fallback).replace(/\s+@\s+\S+\s*$/u, "").trim();
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

function formatNumber(value, fallback = "-") {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString("en-US") : text(value, fallback);
}

function safeSessionKey(session, index) {
  return text(session.session_code || session.session_number, `session-${index}`);
}

export default async function SessionsV2Page() {
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("id, session_code, season_code, session_number, played_at, table_name, format, status, hands_count")
    .order("session_number", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const sessionIds = (sessions || []).map((session) => session.id).filter(Boolean);
  const { data: results } = sessionIds.length
    ? await supabase
        .from("session_results")
        .select("session_id, player_name, finish, league_points, approved")
        .in("session_id", sessionIds)
        .order("finish", { ascending: true })
    : { data: [] };

  const resultsBySession = new Map();
  (results || []).forEach((result) => {
    const key = String(result.session_id);
    if (!resultsBySession.has(key)) resultsBySession.set(key, []);
    resultsBySession.get(key).push(result);
  });

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <NativeArchiveNav active="sessions" seasonCode="S0" label="Session Recaps" />

        <header className={styles.hero}>
          <span>Para Poker Preseason</span>
          <h1>Session recaps</h1>
          <p>
            The longform home for completed Para Poker nights. Each recap turns
            verified results into a readable table story: who took control, which
            hands moved the room, and where each player&apos;s path continues.
          </p>
        </header>

        <section className={styles.sessionList} aria-label="Para Poker session recaps">
          {(sessions || []).length ? (
            sessions.map((session, index) => {
              const publicResults = (resultsBySession.get(String(session.id)) || [])
                .filter((result) => result.approved)
                .sort((left, right) => Number(left.finish || 99) - Number(right.finish || 99));
              const leader = publicResults[0];
              const href = session.session_code
                ? `/sessions-v2/${encodeURIComponent(session.session_code)}`
                : "";
              const card = (
                <>
                  <div className={styles.cardTop}>
                    <span>{text(session.season_code, "S0")} recap</span>
                    <strong>{text(session.session_code, "Session logged")}</strong>
                  </div>
                  <h2>{leader ? `${cleanName(leader.player_name)} carries the night` : "Recap file building"}</h2>
                  <p>
                    {[formatDate(session.played_at), session.format, session.hands_count ? `${formatNumber(session.hands_count)} hands` : ""]
                      .filter(Boolean)
                      .join(" / ")}
                  </p>
                  <div className={styles.metaGrid}>
                    <Stat label="Table" value={text(session.table_name, "Preseason table")} />
                    <Stat label="Result" value={leader ? `${formatNumber(leader.league_points, "0")} points` : "Pending review"} />
                    <Stat label="Players listed" value={publicResults.length ? String(publicResults.length) : "-"} />
                  </div>
                </>
              );

              return href ? (
                <Link key={safeSessionKey(session, index)} href={href} className={styles.sessionCard}>
                  {card}
                  <span className={styles.cardCta}>Read session recap</span>
                </Link>
              ) : (
                <article key={safeSessionKey(session, index)} className={`${styles.sessionCard} ${styles.disabled}`}>
                  {card}
                </article>
              );
            })
          ) : (
            <div className={styles.empty}>
              <strong>No sessions published yet</strong>
              <p>The table is still forming. Verified sessions will appear here once the preseason record starts to take shape.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
