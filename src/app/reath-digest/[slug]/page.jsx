import Link from "next/link";
import { notFound } from "next/navigation";
import { StudioShell } from "@/components/rooms/StudioShell";
import { PublicationReader } from "@/components/reath/PublicationReader";
import { loreEnabled } from "@/lib/lore/core.mjs";
import {
  existingReathReleases,
  publicChannelVideos,
  reathSource,
} from "@/lib/reath/releases.mjs";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const release = existingReathReleases().find((item) => item.slug === slug);
  return {
    title: release?.title || "Reath publication",
    description: release?.summary,
  };
}
export default async function ReadRelease({ params, searchParams }) {
  const { slug } = await params;
  const release = existingReathReleases().find((item) => item.slug === slug);
  if (!release) notFound();
  const query = await searchParams;
  const requested = Number(query.page || 1);
  const page =
    Number.isInteger(requested) &&
    requested >= 1 &&
    requested <= release.gallery.length
      ? requested
      : 1;
  const videos = publicChannelVideos().filter((video) =>
    release.video_ids.includes(video.id.slice(6)),
  );
  return (
    <StudioShell>
      <main className="studio-main reath-release">
        <nav className="lore-breadcrumbs" aria-label="Publication breadcrumb">
          <Link href="/reath-digest">Reath Digest</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{release.title}</span>
        </nav>
        <header className="reath-release-heading">
          <p className="studio-kicker">
            {release.format === "funnies"
              ? "REATH FUNNIES / COMIC"
              : "REATH IN REVIEW / ARCHIVE EDITION"}
          </p>
          <h1>{release.title}</h1>
          <p className="studio-lede">{release.summary}</p>
          <p className="reath-byline">
            {release.credit}
            {release.created_label ? " · " + release.created_label : ""}
            {release.published_at ? " · " + release.published_at : ""}
          </p>
        </header>
        <aside className="reath-fiction-label">
          {reathSource.notice} These are the existing public reading copies,
          preserved with their source and credit.
        </aside>
        {release.subjects.length ? (
          <div className="publication-subjects">
            <h2>In this story</h2>
            {release.subjects.map((subject) => (
              <span key={subject.name}>{subject.name}</span>
            ))}
          </div>
        ) : null}
        {release.articles.length ? (
          <section className="publication-contents">
            <h2>In this edition</h2>
            <ul>
              {release.articles.map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ul>
          </section>
        ) : null}
        <PublicationReader release={release} initialPage={page} />
        <footer className="publication-source">
          <h2>Read, watch, follow the thread.</h2>
          <a
            href={release.source_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Read this edition at the original Reath Digest ↗
          </a>
          {videos.map((video) => (
            <Link key={video.id} href={video.href}>
              {video.title} ↗
            </Link>
          ))}
          {loreEnabled() ? <Link href="/lore">Open the world dossiers ↗</Link> : null}
          <p>
            {release.credit}. Pages load from the original public source; EGGS
            does not replace the source editions.
          </p>
        </footer>
      </main>
    </StudioShell>
  );
}
