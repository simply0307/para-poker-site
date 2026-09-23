import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountFrame, AccountUnavailable } from "@/components/eggs/AccountFrame";
import { PlayerClaimPanel } from "@/components/eggs/PlayerClaimPanel";
import { pageConsumerContext } from "@/lib/eggs/consumerClient";
import { requireEggsUser } from "@/lib/eggs/requireEggsUser";
import { consumerConfiguration } from "@/lib/eggs/consumerCore.mjs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Claim a Para Poker player" };
export default async function ClaimPage() {
  if (!consumerConfiguration()) return <AccountUnavailable />;
  const context = await pageConsumerContext(); let authError;
  try { await requireEggsUser(context); } catch (error) { authError = error; }
  if (authError?.status === 401 || authError?.status === 403) redirect("/login");
  if (authError) return <AccountUnavailable />;
  const profile = await context.client.rpc("get_my_eggs_profile");
  if (profile.error) return <AccountUnavailable />;
  if (!profile.data?.[0]) redirect("/profile");
  const [players, claims, links] = await Promise.all([
    context.client.rpc("get_public_poker_players"), context.client.rpc("get_my_poker_claims"),
    context.client.from("para_poker_profile_links").select("profile_id,player_id,show_on_profile").eq("profile_id", profile.data[0].id).maybeSingle(),
  ]);
  if (players.error || claims.error || links.error) return <AccountUnavailable />;
  return <AccountFrame title="Connect your league record." intro="Choose your existing Para Poker player. An operator reviews every claim; matching names never prove ownership.">
    <Link href="/profile" className="eggs-text-link" prefetch={false}>← Back to your profile</Link>
    <PlayerClaimPanel initialPlayers={players.data || []} initialClaims={claims.data || []} linked={Boolean(links.data)} />
  </AccountFrame>;
}
