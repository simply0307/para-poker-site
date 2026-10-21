import Image from "next/image";
import { WorkArt } from "@/components/rooms/WorkPresentation";
import { publicPageImage } from "@/lib/reath/releases.mjs";
export function ReleaseArt({ publication }) {
  if (publication.cover_url && publicPageImage(publication.cover_url))
    return (
      <Image
        className="reath-release-cover"
        src={publication.cover_url}
        alt={publication.title + " — original cover"}
        width={publication.gallery?.[0]?.width || 800}
        height={publication.gallery?.[0]?.height || 1100}
        unoptimized
      />
    );
  if (publication.asset_id) return <WorkArt id={publication.asset_id} />;
  return (
    <div className="reath-video-sleeve">
      <span>EGGS / ON AIR</span>
      <strong aria-hidden="true">▶</strong>
      <b>{publication.title}</b>
      <span>FROM THE OFFICIAL CHANNEL</span>
    </div>
  );
}
