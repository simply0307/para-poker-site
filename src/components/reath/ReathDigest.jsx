"use client";

import Link from "next/link";
import Image from "next/image";
import { useId, useState } from "react";
import { WorkArt } from "@/components/rooms/WorkPresentation";
import {
  collectionCounts,
  filterPublications,
  publicationFormats,
  reathCollections,
} from "@/lib/reath/catalog.mjs";

export function ReathDigest({ publications, unavailable }) {
  const [collection, setCollection] = useState("all");
  const [query, setQuery] = useState("");
  const searchId = useId();
  const counts = collectionCounts(publications);
  const shown = filterPublications(publications, { collection, query });
  const current = reathCollections.find((item) => item.id === collection);

  function choose(id) {
    setCollection(id);
    setQuery("");
  }

  return (
    <main className="studio-main reath-reader">
      <section className="reath-front-page" aria-labelledby="reath-title">
        <div className="reath-edition-line">
          <span>AN EGGS PUBLICATION</span>
          <span>READ · LOOK · WATCH · REPEAT</span>
        </div>
        <div className="reath-title-row">
          <div>
            <p className="studio-kicker">A READING ROOM FOR THE CURIOUS</p>
            <h1 id="reath-title" className="reath-logo-plate">
              <Image
                src="/brand/reath-digest.png"
                alt="Reath Digest"
                width={1024}
                height={1024}
                unoptimized
                priority
              />
            </h1>
          </div>
          <span className="reath-paper-mark" aria-hidden="true">
            R<br />D
          </span>
        </div>
        <div className="reath-front-bottom">
          <p>
            Publications, comics, moving pictures, and other ways into Reath.
            Take your time. There is more than one way to read a world.
          </p>
          <span className="reath-issue-stamp">
            THE READING ROOM
            <br />
            <b>OPEN TO EVERYONE</b>
          </span>
        </div>
      </section>

      <section
        className="reath-collection-shelf"
        aria-labelledby="reath-collections"
      >
        <div className="reath-section-heading">
          <h2 id="reath-collections">Pick a shelf.</h2>
          <span>FOLLOW YOUR CURIOSITY</span>
        </div>
        <div className="reath-collection-grid">
          {reathCollections
            .filter((item) => item.id !== "all")
            .map((item, index) => (
              <button
                className="reath-collection-card"
                data-collection={item.id}
                key={item.id}
                type="button"
                aria-pressed={collection === item.id}
                onClick={() => choose(item.id)}
              >
                <span className="reath-shelf-index" aria-hidden="true">
                  0{index + 1} /
                </span>
                <strong>{item.title}</strong>
                <span>{item.description}</span>
                <span className="reath-shelf-count">
                  {counts[item.id]} available <span aria-hidden="true">↘</span>
                </span>
              </button>
            ))}
        </div>
      </section>

      <section className="reath-archive" aria-labelledby="reath-archive-title">
        <div className="reath-section-heading">
          <h2 id="reath-archive-title">The reading shelf.</h2>
          <Link href="/library">Across the EGGS library ↗</Link>
        </div>
        <div className="reath-tools">
          <div
            className="reath-filter-list"
            role="group"
            aria-label="Publication collection"
          >
            {reathCollections.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setCollection(item.id)}
                aria-pressed={collection === item.id}
              >
                {item.title}
                <span aria-label={`${counts[item.id]} available`}>
                  {counts[item.id]}
                </span>
              </button>
            ))}
          </div>
          <div className="reath-search">
            <label htmlFor={searchId}>Find something to read or watch</label>
            <input
              id={searchId}
              type="search"
              value={query}
              maxLength={160}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the public shelf…"
            />
          </div>
        </div>
        <p className="reath-results-count" role="status" aria-live="polite">
          {shown.length} {shown.length === 1 ? "publication" : "publications"}
          {collection === "all" ? "" : ` in ${current.title}`}
          {query.trim() ? " matching your search" : ""}
        </p>
        {unavailable ? (
          <div className="reath-empty" role="status">
            <span aria-hidden="true">↻</span>
            <h3>The shelf is taking a moment.</h3>
            <p>
              Publications are temporarily unavailable. Please check back
              shortly.
            </p>
          </div>
        ) : shown.length ? (
          <div className="reath-publication-grid">
            {shown.map((item) => (
              <PublicationCard key={item.id} publication={item} />
            ))}
          </div>
        ) : (
          <div className="reath-empty">
            <span aria-hidden="true">✳</span>
            <h3>
              {publications.length && query.trim()
                ? "No matches on this shelf."
                : collection === "all"
                  ? "The shelves are ready for their first releases."
                  : `The ${current.title} shelf is getting ready.`}
            </h3>
            <p>
              {publications.length && query.trim()
                ? "Try another word or explore a different collection."
                : "New issues, comics, and videos appear here when they are published by the Reath editorial team."}
            </p>
            {query || collection !== "all" ? (
              <button type="button" onClick={() => choose("all")}>
                Browse everything
              </button>
            ) : (
              <Link href="/projects">Explore more EGGS projects ↗</Link>
            )}
          </div>
        )}
      </section>

      <aside className="reath-reader-note">
        <div>
          <p className="studio-kicker">A NOTE FROM THE READING ROOM</p>
          <h2>
            Different forms.
            <br />
            <em>Clear voices.</em>
          </h2>
        </div>
        <div>
          <p>
            Reath Digest brings publications, comics, art, and video together.
            Each work keeps its own creator credit, source, permission, and
            editorial label.
          </p>
          <p>
            <strong>Reath Funnies</strong> is the comic and art section of the
            Digest. Depicted stories are fiction within Reath; publication does
            not make them governing Reath canon.
          </p>
          <p>
            EGGS account pages and community posts have their own space.
            Official Digest publication passes through editorial review.
          </p>
          <Link href="/profile">Find your own corner of EGGS ↗</Link>
        </div>
      </aside>
    </main>
  );
}

function PublicationCard({ publication }) {
  return (
    <article className="reath-publication-card">
      <Link href={`/library/${publication.slug}`}>
        <div className="reath-publication-art">
          <WorkArt id={publication.asset_id} />
          <span>{publicationFormats[publication.format]}</span>
        </div>
        <div className="reath-publication-copy">
          <p className="studio-kicker">
            REATH DIGEST / {publicationFormats[publication.format]}
          </p>
          <h3>{publication.title}</h3>
          <p>{publication.summary}</p>
          {publication.attribution ? (
            <p className="reath-byline">{publication.attribution}</p>
          ) : null}
          {publication.format === "funnies" ? (
            <p className="reath-fiction-label">
              Fiction within Reath · depicted events are not governing canon.
            </p>
          ) : null}
          <span className="reath-read-link">
            {publication.format === "video"
              ? "Watch & view credits"
              : "Open publication & credits"}{" "}
            <span aria-hidden="true">↗</span>
          </span>
        </div>
      </Link>
    </article>
  );
}
