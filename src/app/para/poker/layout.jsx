import "@/modules/para-poker/styles.css";

export const metadata = {
  title: "Para Poker League",
  description: "Para Poker League newsroom, standings, sessions, and player dossiers. A Para project within EGGS.",
  icons: { icon: "/images/para-league-favicon.ico" },
};

export default function PokerLayout({ children }) {
  return <div className="para-poker-module">{children}</div>;
}
