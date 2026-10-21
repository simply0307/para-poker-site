import { notFound } from "next/navigation";
import { StudioShell } from "@/components/rooms/StudioShell";
import { CommunityFeed } from "@/components/community/CommunityFeed";
import { communityEnabled, feedOptions } from "@/lib/community/core.mjs";
import { publicFeed } from "@/lib/community/server";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Community",
  description:
    "A shared corner for the people of EGGS. Games, ideas, things we make, and conversations in between.",
};
export default async function CommunityPage({ searchParams }) {
  if (!communityEnabled()) notFound();
  const params = await searchParams;
  const author =
    typeof params?.author === "string" &&
    /^[a-z0-9_]{3,30}$/u.test(params.author)
      ? params.author
      : null;
  const options = feedOptions(new URLSearchParams(author ? { author } : {}));
  return (
    <StudioShell>
      <main className="studio-main community-page">
        <header className="community-heading">
          <div>
            <p className="studio-kicker">OUR LITTLE CORNER OF THE INTERNET</p>
            <h1>{author ? "From this corner." : "Good to see you."}</h1>
            <p>
              {author
                ? "Public posts from @" + author
                : "Pull up a chair. Share a little of your world."}
            </p>
          </div>
          <span aria-hidden="true" className="community-header-seal">
            PEOPLE
            <br />
            MAKE
            <br />
            EGGS ✳
          </span>
        </header>
        <CommunityFeed initial={await publicFeed(options)} author={author} />
      </main>
    </StudioShell>
  );
}
