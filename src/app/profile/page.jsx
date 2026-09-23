import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountFrame, AccountUnavailable } from "@/components/eggs/AccountFrame";
import { ProfileEditor } from "@/components/eggs/ProfileEditor";
import { ConsumerLogout } from "@/components/eggs/ConsumerLogout";
import { PokerVisibility } from "@/components/eggs/PokerVisibility";
import { PokerIdentitySummary } from "@/modules/para-poker/components/PokerIdentitySummary";
import { pageConsumerContext } from "@/lib/eggs/consumerClient";
import { requireEggsUser } from "@/lib/eggs/requireEggsUser";
import { consumerConfiguration } from "@/lib/eggs/consumerCore.mjs";

export const metadata = { title: "Profiles" };
export const dynamic = "force-dynamic";
export default async function ProfilesPage() {
  if (!consumerConfiguration()) return <AccountUnavailable />;
  const context = await pageConsumerContext();
  let authorizationError;
  try { await requireEggsUser(context); } catch (error) { authorizationError = error; }
  if (authorizationError?.status === 401 || authorizationError?.status === 403) redirect("/login");
  if (authorizationError) return <AccountUnavailable />;
  const result = await context.client.rpc("get_my_eggs_profile");
  if (result.error) return <AccountUnavailable />;
  const profile = result.data?.[0];
  let link; let player;
  if (profile) {
    const linked = await context.client.from("para_poker_profile_links").select("profile_id,player_id,show_on_profile").eq("profile_id", profile.id).maybeSingle();
    if (linked.error) return <AccountUnavailable />;
    link = linked.data;
    if (link?.show_on_profile) {
      const summary = await context.client.rpc("get_public_poker_players", { p_player_id: link.player_id });
      if (summary.error) return <AccountUnavailable />;
      player = summary.data?.[0];
    }
  }
  return <AccountFrame title={profile ? `@${profile.handle}` : "Choose your handle."} intro={profile ? "A small home for your identity and the connections you choose to share." : "That’s all you need to get started. Your profile starts private."}>
    <div className="eggs-account-toolbar">{profile?.visibility === "public" ? <Link className="eggs-text-link" href={`/profile/${profile.handle}`} prefetch={false}>View public profile ↗</Link> : <span className="eggs-help">Only you can see this profile</span>}<ConsumerLogout /></div>
    <ProfileEditor profile={profile || null} />
    {profile ? <section className="eggs-account-section"><h2>Your Para Poker connection</h2>
      {link ? <><PokerVisibility enabled={link.show_on_profile} /><PokerIdentitySummary player={player} /></> : <p className="eggs-help">Already play in the league? Request a reviewed connection to your existing player record.</p>}
      <Link href="/profile/claim" prefetch={false} className="eggs-text-link">{link ? "Review your claim history" : "Find your Para Poker player"} ↗</Link>
    </section> : null}
  </AccountFrame>;
}
