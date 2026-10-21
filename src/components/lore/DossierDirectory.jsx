"use client";
import { useId, useState } from "react";
import { DossierCards } from "./LorePresentation";
export function DossierDirectory({ entries }) {
  const [query, setQuery] = useState("");
  const id = useId();
  const search = query
    .trim()
    .toLocaleLowerCase()
    .replace(/\binfatimer\b/gu, "infinitimer");
  const shown = entries.filter((entry) =>
    [entry.content.title, entry.content.summary, entry.content.body]
      .join(" ")
      .toLocaleLowerCase()
      .includes(search),
  );
  return (
    <section>
      <div className="lore-search">
        <label htmlFor={id}>Find a dossier</label>
        <input
          id={id}
          type="search"
          maxLength={100}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="A name, a place, a word…"
        />
      </div>
      <p role="status" aria-live="polite">
        {shown.length} {shown.length === 1 ? "dossier" : "dossiers"}
      </p>
      {shown.length ? (
        <DossierCards entries={shown} />
      ) : (
        <p className="lore-empty">
          {query
            ? "No matching dossiers. Try another word."
            : "No reader dossiers have been released in this section yet."}
        </p>
      )}
    </section>
  );
}
