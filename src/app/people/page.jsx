import { notFound } from "next/navigation";
import { StudioShell } from "@/components/rooms/StudioShell";
import { PeopleDirectory } from "@/components/community/PeopleDirectory";
import { communityEnabled } from "@/lib/community/core.mjs";
import { publicPeople } from "@/lib/community/server";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "People / EGGS",
  description: "Explore the public pages people make on EGGS.",
};

export default async function PeoplePage({ searchParams }) {
  if (!communityEnabled()) notFound();
  const params = (await searchParams) || {};
  const query =
    typeof params.q === "string" ? params.q.trim().slice(0, 60) : "";
  const after =
    typeof params.after === "string" && /^[a-z0-9_]{3,30}$/u.test(params.after)
      ? params.after
      : "";
  const result = await publicPeople({ query, after });
  return (
    <StudioShell>
      <PeopleDirectory {...result} query={query} after={after} />
    </StudioShell>
  );
}
