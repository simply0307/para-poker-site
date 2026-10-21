import { StudioShell } from "@/components/rooms/StudioShell";
import { PublicationCard } from "@/components/reath/ReathDigest";
import { publicChannelVideos, eggsChannel } from "@/lib/reath/releases.mjs";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "The video room",
  description:
    "Public films, narrated comics, world introductions and updates from the EGGS channel.",
};
export default function WatchPage() {
  const videos = publicChannelVideos();
  return (
    <StudioShell>
      <main className="studio-main eggs-watch">
        <header className="reath-release-heading">
          <p className="studio-kicker">EGGS / ON AIR</p>
          <h1>Pull up a screen.</h1>
          <p className="studio-lede">
            Narrated Reath comics, world introductions, game design and
            dispatches from the studio.
          </p>
          <a href={eggsChannel.url} target="_blank" rel="noopener noreferrer">
            Visit the official EGGS channel ↗
          </a>
        </header>
        <div className="reath-publication-grid">
          {videos.map((video) => (
            <PublicationCard key={video.id} publication={video} />
          ))}
        </div>
      </main>
    </StudioShell>
  );
}
