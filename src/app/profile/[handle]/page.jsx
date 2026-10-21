import { notFound } from "next/navigation";
import Link from "next/link";
import { communityEnabled } from "@/lib/community/core.mjs";
import { publicConsumerClient } from "@/lib/eggs/consumerClient";
import {
  AccountFrame,
  AccountUnavailable,
} from "@/components/eggs/AccountFrame";
import { PokerIdentitySummary } from "@/modules/para-poker/components/PokerIdentitySummary";
import { roomsEnabled } from "@/lib/rooms/core.mjs";
import { roomRepository } from "@/lib/rooms/repository.mjs";
import { RoomPresentation } from "@/components/rooms/RoomPresentation";
import { OwnerRoomLink } from "@/components/rooms/OwnerRoomLink";

export const dynamic = "force-dynamic";
export const metadata = { title: "EGGS profile" };
export default async function ProfilePage({ params }) {
  const { handle } = await params;
  if (handle.length < 3 || handle.length > 30 || /[^a-z0-9_]/u.test(handle))
    notFound();
  // Always anonymous: knowing a URL (even as its owner/operator) does not turn
  // a private profile into a public one. No name/slug-derived identity.
  const client = publicConsumerClient();
  if (!client) notFound();
  let room, profile;
  if (roomsEnabled()) {
    try {
      room = await roomRepository(client).publicRoom(handle);
      profile = room?.profile;
    } catch {
      return <AccountUnavailable />;
    }
  } else {
    const result = await client
      .from("eggs_public_profiles")
      .select("id,handle,display_name,bio")
      .eq("handle", handle)
      .maybeSingle();
    if (result.error) return <AccountUnavailable />;
    profile = result.data;
  }
  if (!profile) notFound();
  const linked = await client
    .from("para_poker_public_profile_links")
    .select("profile_id,player_id")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (linked.error) return <AccountUnavailable />;
  let player;
  if (linked.data) {
    const summary = await client.rpc("get_public_poker_players", {
      p_player_id: linked.data.player_id,
    });
    if (summary.error) return <AccountUnavailable />;
    player = summary.data?.[0];
  }
  if (room)
    return (
      <main className="room-public-page">
        <RoomPresentation
          room={room}
          toolbar={
            <>
              <OwnerRoomLink handle={handle} />
              {communityEnabled() ? (
                <Link
                  className="room-home-link"
                  href={"/community?author=" + handle}
                >
                  Posts from this corner ↗
                </Link>
              ) : null}
            </>
          }
        >
          <PokerIdentitySummary player={player} />
        </RoomPresentation>
      </main>
    );
  return (
    <AccountFrame title={profile.display_name}>
      <p className="eggs-profile-handle">@{profile.handle}</p>
      {profile.bio ? <p className="eggs-profile-bio">{profile.bio}</p> : null}
      <PokerIdentitySummary player={player} />
    </AccountFrame>
  );
}
