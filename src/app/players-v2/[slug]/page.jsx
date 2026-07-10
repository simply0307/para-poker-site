import { notFound } from "next/navigation";
import PlayerProfilePage from "@/components/player-profile-v2/PlayerProfilePage";
import { getPlayerProfileData } from "@/lib/playerProfileData";
import { supabase } from "@/lib/supabase";

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

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const cleanSlug = typeof slug === "string" ? slug.trim().toLowerCase() : "";

  if (!cleanSlug || !/^[a-z0-9-]+$/.test(cleanSlug)) {
    return {
      title: "Para Poker Player Profile",
    };
  }

  const profileData = await getPlayerProfileData(cleanSlug);

  return {
    title: `${profileData.playerName} | Para Poker Preseason`,
    description: profileData.bio,
  };
}

export default async function NativePlayerProfileV2Route({ params }) {
  const { slug } = await params;
  const cleanSlug = typeof slug === "string" ? slug.trim().toLowerCase() : "";

  if (!cleanSlug || !/^[a-z0-9-]+$/.test(cleanSlug)) {
    notFound();
  }

  const profileData = await getPlayerProfileData(cleanSlug);

  return <PlayerProfilePage profileData={profileData} />;
}
