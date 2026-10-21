import Link from "next/link";
import { notFound } from "next/navigation";
import { StudioShell } from "@/components/rooms/StudioShell";
import { CommunityFeed } from "@/components/community/CommunityFeed";
import { communityEnabled } from "@/lib/community/core.mjs";
import { publicPost } from "@/lib/community/server";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Community conversation",
  description: "A conversation from the EGGS community.",
};
export default async function CommunityPost({ params }) {
  if (!communityEnabled()) notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/u.test(id)) notFound();
  const thread = await publicPost(id);
  if (!thread?.post) notFound();
  return (
    <StudioShell>
      <main className="studio-main community-page">
        <Link className="community-back" href="/community">
          ← Back to the community
        </Link>
        <CommunityFeed initialThread={thread} />
      </main>
    </StudioShell>
  );
}
