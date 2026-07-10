import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerProfileData } from "@/lib/playerProfileData";
import PlayerProfileLayout from "@/components/profile-layout/PlayerProfileLayout";

export const dynamic = "force-dynamic";

export default async function DevProfileLayoutPage({ params }) {
  if (process.env.NODE_ENV !== "development") notFound();

  const { slug } = await params;
  const cleanSlug = typeof slug === "string" ? slug.trim().toLowerCase() : "";
  if (!cleanSlug) notFound();

  const profileData = await getPlayerProfileData(cleanSlug, "S0");

  if (profileData.playerName === "Player not found") {
    return (
      <main style={missingStyle}>
        <p style={eyebrowStyle}>Development layout preview</p>
        <h1>Player not found</h1>
        <p>No Supabase player matched &quot;{cleanSlug}&quot;.</p>
      </main>
    );
  }

  return (
    <>
      <aside style={previewBarStyle}>
        <strong>Code-owned modular layout preview</strong>
        <span style={previewCopyStyle}>This route does not replace the public Plasmic profile.</span>
        <nav style={linkRowStyle} aria-label="Compare profile layouts">
          <Link href={`/plasmic-profile/${cleanSlug}`} style={linkStyle}>Open Plasmic layout</Link>
          <Link href={`/dev/profile-data/${cleanSlug}`} style={linkStyle}>Open profile data</Link>
        </nav>
      </aside>
      <PlayerProfileLayout profileData={profileData} />
    </>
  );
}

const previewBarStyle = { boxSizing: "border-box", width: "100%", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 18px", padding: "12px clamp(16px, 4vw, 40px)", borderBottom: "1px solid #d4d4d8", background: "#fafafa", color: "#18181b", fontFamily: "ui-sans-serif, system-ui, sans-serif" };
const previewCopyStyle = { color: "#52525b", fontSize: 13 };
const linkRowStyle = { display: "flex", flexWrap: "wrap", gap: 14, marginLeft: "auto" };
const linkStyle = { color: "#1d4ed8", fontSize: 13, fontWeight: 700 };
const missingStyle = { minHeight: "100vh", padding: 32, background: "#f4f4f5", color: "#18181b", fontFamily: "ui-sans-serif, system-ui, sans-serif" };
const eyebrowStyle = { margin: 0, color: "#a16207", fontSize: 12, fontWeight: 800, textTransform: "uppercase" };
