import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getPlayerProfileData } from "@/lib/playerProfileData";
import { PLASMIC } from "@/plasmic-loader";
import PlasmicProfileClient from "./PlasmicProfileClient";

export const revalidate = 60;

export async function generateStaticParams() {
  const { data: players, error } = await supabase.from("players").select("slug");

  if (error || !players) {
    return [];
  }

  return players
    .filter((player) => player.slug)
    .map((player) => ({
      slug: player.slug.toLowerCase(),
    }));
}

export default async function PlasmicProfilePage({ params }) {
  const { slug } = await params;
  const cleanSlug = typeof slug === "string" ? slug.trim().toLowerCase() : "";

  if (!cleanSlug) {
    notFound();
  }

  const [profileData, plasmicData] = await Promise.all([
    getPlayerProfileData(cleanSlug),
    PLASMIC.maybeFetchComponentData("PlayerProfileTemplate"),
  ]);

  if (!plasmicData) {
    return (
      <main style={{ padding: 40, fontFamily: "system-ui" }}>
        <h1>Plasmic template not found</h1>
        <p>
          Make sure the Plasmic component is named exactly:
          PlayerProfileTemplate
        </p>
        <p>Also make sure you published the Plasmic project.</p>
      </main>
    );
  }

  return (
    <PlasmicProfileClient
      plasmicData={plasmicData}
      profileData={profileData}
    />
  );
}
