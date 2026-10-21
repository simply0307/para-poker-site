import Link from "next/link";
import { dossierKinds, loreHref } from "@/lib/lore/presentation.mjs";

export function LoreBreadcrumbs({ world, kind, entry }) {
  return (
    <nav className="lore-breadcrumbs" aria-label="Lore breadcrumb">
      <Link href="/lore">Lore</Link>
      {world ? (
        <>
          <span aria-hidden="true">/</span>
          <Link href={loreHref(world)}>{world.content.title}</Link>
        </>
      ) : null}
      {kind ? (
        <>
          <span aria-hidden="true">/</span>
          <Link href={`/lore/${world.world}/${kind}`}>
            {dossierKinds[kind].title}
          </Link>
        </>
      ) : null}
      {entry ? (
        <>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{entry.content.title}</span>
        </>
      ) : null}
    </nav>
  );
}
export function LoreCategories({ world, entries }) {
  return (
    <nav
      className="lore-category-grid"
      aria-label={`${world.content.title} dossiers`}
    >
      {Object.entries(dossierKinds).map(([kind, info]) => (
        <Link
          className="lore-category"
          key={kind}
          href={`/lore/${world.world}/${kind}`}
        >
          <span className="lore-category-mark" aria-hidden="true">
            {info.mark}
          </span>
          <h2>{info.title}</h2>
          <p>{info.description}</p>
          <span className="lore-count">
            {entries.filter((row) => row.kind === kind).length} dossiers{" "}
            <span aria-hidden="true">↗</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}
export function DossierBody({ entry, preview = false }) {
  return (
    <article className="lore-dossier">
      <header>
        <p className="studio-kicker">
          {preview
            ? "SAVED DRAFT / PRIVATE PREVIEW"
            : entry.kind === "world"
              ? "WORLD DOSSIER"
              : dossierKinds[entry.kind]?.singular + " DOSSIER"}
        </p>
        <h1>{entry.content.title}</h1>
        <p className="studio-lede">{entry.content.summary}</p>
      </header>
      <aside className="lore-continuity">
        <strong>Reading this dossier</strong>
        <p>{entry.content.continuity_note}</p>
      </aside>
      <div className="lore-body">
        {entry.content.body
          .split(/\n\s*\n/u)
          .filter(Boolean)
          .map((text, index) => (
            <p key={index}>{text}</p>
          ))}
      </div>
      <footer className="lore-source">
        <h2>Source &amp; credit</h2>
        <p>{entry.content.attribution}</p>
        {entry.content.public_source ? (
          <a
            href={entry.content.public_source}
            target="_blank"
            rel="noopener noreferrer"
          >
            View public source ↗
          </a>
        ) : null}
        {entry.version ? <p>Reader revision {entry.version}</p> : null}
      </footer>
    </article>
  );
}
export function DossierCards({ entries }) {
  return (
    <div className="lore-dossier-grid">
      {entries.map((entry) => (
        <article className="lore-card" key={entry.id}>
          <Link href={loreHref(entry)}>
            <p className="studio-kicker">
              {entry.kind === "world"
                ? "WORLD"
                : dossierKinds[entry.kind]?.singular}
            </p>
            <h2>{entry.content.title}</h2>
            <p>{entry.content.summary}</p>
            <span>
              Open dossier <span aria-hidden="true">↗</span>
            </span>
          </Link>
        </article>
      ))}
    </div>
  );
}
