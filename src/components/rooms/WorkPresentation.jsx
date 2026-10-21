import Link from "next/link";
import Image from "next/image";
import { workAssets } from "@/lib/rooms/registry.mjs";
import { approvedMediaUrl, publicationFormats } from "@/lib/reath/catalog.mjs";
export function WorkArt({ id }) {
  const asset = workAssets[id];
  return asset ? (
    <Image
      className="work-art"
      src={asset.src}
      alt={asset.title}
      width={720}
      height={480}
      unoptimized
    />
  ) : null;
}
export function WorkCard({ work }) {
  return (
    <article className="studio-window work-card">
      <div className="window-bar">
        <span>
          LIBRARY /{" "}
          {(
            publicationFormats[work.content.format] || "ORIGINAL DESIGN"
          ).toUpperCase()}
        </span>
        <span aria-hidden="true">＋</span>
      </div>
      <Link href={"/library/" + work.slug}>
        <WorkArt id={work.content.asset_id} />
        <div className="window-copy">
          <h2>{work.content.title}</h2>
          <p>{work.content.summary}</p>
          <span className="studio-arrow">Take a closer look ↗</span>
        </div>
      </Link>
    </article>
  );
}
export function WorkShowcase({ work, project, preview = false }) {
  return (
    <article className="work-showcase">
      <p className="studio-kicker">
        {preview ? "SAVED DRAFT / PRIVATE PREVIEW" : "THE EGGS LIBRARY"}
      </p>
      <h1>{work.content.title}</h1>
      <p className="studio-lede">{work.content.summary}</p>
      <WorkArt id={work.content.asset_id} />
      <p className="work-description">{work.content.description}</p>
      {work.content.format === "funnies" ? (
        <p className="work-fiction-notice">
          <strong>Reath Funnies / fiction within fiction.</strong> A creative
          comic work, presented with its recorded creator credit.
        </p>
      ) : null}
      {work.content.format === "video" &&
      approvedMediaUrl(work.content.media_url) ? (
        <a
          className="work-video-link"
          href={approvedMediaUrl(work.content.media_url)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Watch the public video ↗
        </a>
      ) : null}
      {project ? (
        <p>
          Associated project:{" "}
          <Link href={"/projects/" + project.slug}>
            {project.content.title}
          </Link>
        </p>
      ) : null}
      {work.provenance ? (
        <section className="work-credit">
          <h2>Source &amp; permission</h2>
          <p>{work.provenance.attribution}</p>
          <p>{work.provenance.derivative}</p>
          <p>Source: {work.provenance.source}</p>
          <p>Permitted use: {work.provenance.permitted_use}</p>
        </section>
      ) : (
        <p className="eggs-help">
          Publication checks the registered asset’s source and site-use
          permission.
        </p>
      )}
    </article>
  );
}
