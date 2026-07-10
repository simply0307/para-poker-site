import Link from "next/link";
import { NativeArchiveNav } from "@/components/native-navigation/NativeArchiveNav";
import { supabase } from "@/lib/supabase";
import styles from "./PlayersV2Page.module.css";

export const revalidate = 60;

export const metadata = {
  title: "Player Dossiers | Para Poker Preseason",
  description: "Native Para Poker player dossier directory for the preseason archive.",
};

function cleanName(value, fallback = "Unknown Player") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value).replace(/\s+@\s+\S+\s*$/u, "").trim();
}

function safePlayerKey(row, player, index) {
  return player.slug || cleanName(player.display_name || row.player_name, `player-${index}`);
}

function publicStyleLabel(value, fallback = "still-forming table identity") {
  const label = cleanName(value, fallback);
  const lower = label.toLowerCase();
  if (lower === "loose passive" || lower === "calling station") return "showdown-heavy profile";
  if (lower === "loose aggressive" || lower === "pressure player") return "active table presence";
  if (lower === "tight aggressive") return "patient confrontation style";
  if (lower === "tight passive") return "selective table presence";
  if (lower === "showdown closer") return "late-hand presence";
  if (lower === "unscouted") return "table identity still developing";
  if (lower === "developing profile" || lower === "fish") return "still-forming table identity";
  if (lower === "maniac") return "high-activity table presence";
  return label;
}

export default async function PlayersV2Page() {
  const { data: players, error } = await supabase
    .from("player_season_stats")
    .select(`
      *,
      players:player_id (
        display_name,
        pokernow_name,
        slug,
        avatar_url,
        bio
      )
    `)
    .eq("season_code", "S0")
    .order("hands", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <NativeArchiveNav active="players" seasonCode="S0" label="Player Directory" />

        <header className={styles.hero}>
          <span>Para Poker Preseason</span>
          <h1>Player dossiers</h1>
          <p>
            Public player files built from tracked hands, verified standings,
            moments, and session recaps.
          </p>
        </header>

        <section className={styles.grid} aria-label="Player dossier directory">
          {(players || []).map((row, index) => {
            const player = row.players || {};
            const displayName = cleanName(player.display_name || row.player_name);
            const slug = player.slug?.trim();
            const labels = [
              publicStyleLabel(row.primary_label),
              publicStyleLabel(row.secondary_label, "table identity still developing"),
            ].join(" / ");
            const content = (
              <>
                <div className={styles.cardTop}>
                  <div className={styles.avatar}>
                    {player.avatar_url ? (
                      <img src={player.avatar_url} alt="" />
                    ) : (
                      <span>{displayName[0]?.toUpperCase() || "P"}</span>
                    )}
                  </div>
                  <div>
                    <h2>{displayName}</h2>
                    <p>{labels}</p>
                  </div>
                </div>

                <div className={styles.stats}>
                  <Stat label="Hands" value={row.hands} />
                  <Stat label="Action Rate" value={`${row.vpip_pct ?? "-"}%`} />
                  <Stat label="First Raise Rate" value={`${row.pfr_pct ?? "-"}%`} />
                  <Stat label="Biggest Pot" value={row.biggest_pot_won ?? "-"} />
                </div>
              </>
            );

            return slug ? (
              <Link
                key={safePlayerKey(row, player, index)}
                href={`/players-v2/${encodeURIComponent(slug)}`}
                className={styles.card}
              >
                {content}
              </Link>
            ) : (
              <article key={safePlayerKey(row, player, index)} className={`${styles.card} ${styles.disabled}`}>
                {content}
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value ?? "-"}</strong>
    </div>
  );
}
