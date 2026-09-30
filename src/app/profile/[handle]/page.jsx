import { notFound } from "next/navigation";
import { publicConsumerClient } from "@/lib/eggs/consumerClient";
import { AccountFrame, AccountUnavailable } from "@/components/eggs/AccountFrame";
import { PokerIdentitySummary } from "@/modules/para-poker/components/PokerIdentitySummary";

export const dynamic = "force-dynamic";
export const metadata = { title: "EGGS profile" };
export default async function ProfilePage({ params }) {
  const { handle } = await params;
  if (handle.length < 3 || handle.length > 30 || /[^a-z0-9_]/u.test(handle)) notFound();
  // Always anonymous: knowing a URL (even as its owner/operator) does not turn
  // a private profile into a public one. No name/slug-derived identity.
  const client = publicConsumerClient();
  if (!client) notFound();
  const result = await client.from("eggs_public_profiles").select("id,handle,display_name,bio").eq("handle", handle).maybeSingle();
  if (result.error) return <AccountUnavailable />;
  const profile = result.data;
  if (!profile) notFound();
  const linked = await client.from("para_poker_public_profile_links").select("profile_id,player_id").eq("profile_id", profile.id).maybeSingle();
  if (linked.error) return <AccountUnavailable />;
  let player;
  if (linked.data) {
    const summary = await client.rpc("get_public_poker_players", { p_player_id: linked.data.player_id });
    if (summary.error) return <AccountUnavailable />;
    player = summary.data?.[0];
  }
  return <AccountFrame title={profile.display_name}>
    <p className="eggs-profile-handle">@{profile.handle}</p>
    {profile.bio ? <p className="eggs-profile-bio">{profile.bio}</p> : null}
    <PokerIdentitySummary player={player} />
  </AccountFrame>;
}
