export const dossierKinds = Object.freeze({
  factions: {
    title: "Factions",
    singular: "Faction",
    mark: "⚑",
    description: "The groups, allegiances, and ideas people gather around.",
  },
  people: {
    title: "People",
    singular: "Person",
    mark: "♙",
    description: "Characters, leaders, witnesses, and lives in the world.",
  },
  events: {
    title: "Events",
    singular: "Event",
    mark: "◷",
    description: "Turning points, histories, and the consequences that follow.",
  },
  terms: {
    title: "Terms",
    singular: "Term",
    mark: "Aa",
    description:
      "Objects, institutions, concepts, and the language of a world.",
  },
  places: {
    title: "Places",
    singular: "Place",
    mark: "⌂",
    description: "Landscapes, settlements, and somewhere to begin.",
  },
});
export const loreSlug = (value) =>
  typeof value === "string" &&
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value) &&
  value.length >= 3 &&
  value.length <= 64;
export function loreHref(entry) {
  return entry.kind === "world"
    ? "/lore/" + entry.world
    : `/lore/${entry.world}/${entry.kind}/${entry.slug}`;
}
// Only public snapshot DTOs belong in API JSON, SSR, or client components.
export function publicLore(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(
      (row) =>
        row &&
        loreSlug(row.world) &&
        loreSlug(row.slug) &&
        (row.kind === "world" || Object.hasOwn(dossierKinds, row.kind)) &&
        typeof row.content?.title === "string" &&
        typeof row.content?.body === "string",
    )
    .map((row) => ({
      id: row.id,
      world: row.world,
      kind: row.kind,
      slug: row.slug,
      version: row.version,
      published_at: row.published_at,
      content: {
        title: row.content.title,
        summary: row.content.summary,
        body: row.content.body,
        continuity_note: row.content.continuity_note,
        attribution: row.content.attribution,
        public_source: row.content.public_source || "",
        project_id: row.content.project_id ?? null,
      },
    }));
}
