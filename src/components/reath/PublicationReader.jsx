"use client";
import Image from "next/image";
import { useState } from "react";
import { publicPageImage } from "@/lib/reath/releases.mjs";
export function PublicationReader({ release, initialPage = 1 }) {
  const [page, setPage] = useState(initialPage),
    [zoom, setZoom] = useState(1);
  const item = release.gallery[page - 1];
  function turn(next) {
    setPage(next);
    setZoom(1);
    const url = new URL(window.location.href);
    url.searchParams.set("page", String(next));
    window.history.replaceState(null, "", url.pathname + url.search);
  }
  if (!item || !publicPageImage(item.url)) return null;
  return (
    <section
      className="publication-reader"
      aria-label={release.title + " reading copy"}
    >
      <div className="publication-controls">
        <div>
          <button
            type="button"
            disabled={page === 1}
            onClick={() => turn(page - 1)}
          >
            ← Previous
          </button>
          <span role="status" aria-live="polite">
            Page {page} of {release.gallery.length}
          </span>
          <button
            type="button"
            disabled={page === release.gallery.length}
            onClick={() => turn(page + 1)}
          >
            Next →
          </button>
        </div>
        <div>
          <label>
            Reading size
            <select
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            >
              <option value={1}>Fit width</option>
              <option value={1.5}>150%</option>
              <option value={2}>200%</option>
              <option value={3}>300%</option>
              <option value={5}>500%</option>
            </select>
          </label>
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            Open full-size page ↗
          </a>
        </div>
      </div>
      <div
        className="publication-reader-frame"
        tabIndex={0}
        aria-label={"Page " + page + ", scroll to read when enlarged"}
      >
        <div style={{ width: `${zoom * 100}%` }}>
          <Image
            src={item.url}
            alt={`${release.title}, original reading page ${page}`}
            width={item.width || 800}
            height={item.height || 1100}
            unoptimized
            priority={page === initialPage}
          />
        </div>
      </div>
      {release.gallery.length > 1 ? (
        <nav className="publication-page-picker" aria-label="Publication pages">
          {release.gallery.map((image, index) => (
            <button
              type="button"
              key={image.url}
              aria-current={page === index + 1 ? "page" : undefined}
              onClick={() => turn(index + 1)}
            >
              Page {index + 1}
            </button>
          ))}
        </nav>
      ) : null}
      <p className="publication-reading-help">
        Original public pages from Reath Digest. Enlarge the page to read
        smaller print; open the full-size copy for your browser’s own zoom.
      </p>
    </section>
  );
}
