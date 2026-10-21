import { notFound } from "next/navigation";
import { workspace } from "@/lib/hub/workspace";
import { communityEnabled } from "@/lib/community/core.mjs";
import { CommunityFeed } from "@/components/community/CommunityFeed";
export const dynamic = "force-dynamic";
export default async function CommunityReview() {
  if (!communityEnabled()) notFound();
  const { client, role, error: accessError } = await workspace();
  if (accessError)
    return (
      <section>
        <h1>Community review</h1>
        <p role="status">{accessError}</p>
      </section>
    );
  if (role !== "publisher") notFound();
  const { data, error } = await client.rpc("get_eggs_community_moderation");
  return (
    <section className="community-review">
      <p className="eggs-eyebrow">EGGS / PUBLISHER REVIEW</p>
      <h1>Community review</h1>
      <p>
        Hidden posts stay off public pages. Restoring a post records your
        reason. Posts from private profiles stay private.
      </p>
      {error ? (
        <p role="alert">The review queue is temporarily unavailable.</p>
      ) : (
        <CommunityFeed initial={data} moderation />
      )}
    </section>
  );
}
