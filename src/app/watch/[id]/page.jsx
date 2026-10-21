import Link from "next/link";
import { notFound } from "next/navigation";
import { StudioShell } from "@/components/rooms/StudioShell";
import { VideoPlayer } from "@/components/reath/VideoPlayer";
import { publicChannelVideos, eggsChannel } from "@/lib/reath/releases.mjs";
import { loreEnabled } from "@/lib/lore/core.mjs";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "EGGS video",
  description: "A public video from the official EGGS channel.",
};
export default async function WatchVideo({ params }) {
  const { id } = await params;
  const video = publicChannelVideos().find((item) => item.id === "video:" + id);
  if (!video) notFound();
  return (
    <StudioShell>
      <main className="studio-main eggs-watch">
        <Link className="lore-back" href="/watch">
          ← The video room
        </Link>
        <header className="reath-release-heading">
          <p className="studio-kicker">
            {video.scope.toUpperCase().replaceAll("-", " ")} / FROM THE EGGS
            CHANNEL
          </p>
          <h1>{video.title}</h1>
          <p className="studio-lede">{video.summary}</p>
          <p>
            {video.credit}
            {video.published_at ? " · " + video.published_at.slice(0, 10) : ""}
          </p>
        </header>
        <VideoPlayer video={video} />
        {video.ai_disclosure ? (
          <p className="video-disclosure">
            Source disclosure: {video.ai_disclosure}
          </p>
        ) : null}
        <div className="publication-source">
          <a href={eggsChannel.url} target="_blank" rel="noopener noreferrer">
            More from the official channel ↗
          </a>
          <Link href="/reath-digest">Read Reath Digest ↗</Link>
          {loreEnabled() ? <Link href="/lore">Explore the lore ↗</Link> : null}
        </div>
      </main>
    </StudioShell>
  );
}
