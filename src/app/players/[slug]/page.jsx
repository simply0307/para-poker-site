import { notFound, redirect } from "next/navigation";

export default async function PlayerProfileRedirect({ params }) {
  const { slug } = await params;
  const cleanSlug = typeof slug === "string" ? slug.trim().toLowerCase() : "";

  if (!cleanSlug || !/^[a-z0-9-]+$/.test(cleanSlug)) {
    notFound();
  }

  redirect(`/players-v2/${encodeURIComponent(cleanSlug)}`);
}
