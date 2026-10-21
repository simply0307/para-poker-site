import { notFound, permanentRedirect } from "next/navigation";
import { roomsEnabled } from "@/lib/rooms/core.mjs";
import { publicCatalog } from "@/lib/hub/server";
export const dynamic = "force-dynamic";
export default async function GameAlias({ params }) {
  if (!roomsEnabled()) notFound();
  const { slug } = await params;
  const { projects, unavailable } = await publicCatalog();
  if (unavailable)
    return (
      <main className="eggs-page">
        <p role="status">The directory is temporarily unavailable.</p>
      </main>
    );
  if (
    !projects.some(
      (p) => p.slug === slug && ["game", "league"].includes(p.content.category),
    )
  )
    notFound();
  permanentRedirect("/projects/" + slug);
}
