import { StudioShell } from "@/components/rooms/StudioShell";
import { ReathDigest } from "@/components/reath/ReathDigest";
import { publicReathCatalog } from "@/lib/reath/server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Reath Digest",
  description:
    "The Reath reading room: publications, Reath Funnies, comics, art, and videos from EGGS.",
};

export default async function ReathDigestPage() {
  const { publications, unavailable } = await publicReathCatalog();
  return (
    <StudioShell>
      <ReathDigest publications={publications} unavailable={unavailable} />
    </StudioShell>
  );
}
