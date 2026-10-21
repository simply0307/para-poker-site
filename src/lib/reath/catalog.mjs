import { workAssets } from "../rooms/registry.mjs";

export const REATH_PROJECT_ID = "a0000000-0000-4000-8000-000000000004";
export const publicationFormats = Object.freeze({
  article: "Article",
  issue: "Issue",
  comic: "Comic & art",
  funnies: "Reath Funnies",
  video: "Video",
  work: "Publication",
});
export const reathCollections = Object.freeze([
  { id: "all", title: "All", description: "The complete public Reath shelf." },
  {
    id: "publications",
    title: "Publications",
    description: "Issues, stories, essays, and things worth reading slowly.",
  },
  {
    id: "funnies",
    title: "Reath Funnies",
    description:
      "Comics and art. Fiction within fiction, with room to be strange.",
  },
  {
    id: "comics",
    title: "Comics & art",
    description:
      "Sequential stories, visual works, and different ways of seeing.",
  },
  {
    id: "videos",
    title: "Videos",
    description: "Moving pictures, adaptations, and stories with sound.",
  },
]);

// Canonical public destinations only. This is validation, never a network fetch.
export function approvedMediaUrl(value) {
  if (value === "" || value === undefined) return "";
  if (typeof value !== "string" || value.length > 200) return null;
  return /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/.test(
    value,
  ) || /^https:\/\/vimeo\.com\/[1-9][0-9]{0,11}$/.test(value)
    ? value
    : null;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const boundedText = (value, max) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;

/** Receives anonymous eggs_works snapshots, never drafts or evidence records. */
export function reathPublications(rows) {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  const slugs = new Set();
  const publications = [];
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const content = row.content;
    if (
      !content ||
      typeof content !== "object" ||
      Array.isArray(content) ||
      content.project_id !== REATH_PROJECT_ID ||
      (row.state !== undefined && row.state !== "published") ||
      typeof row.id !== "string" ||
      typeof row.slug !== "string" ||
      !uuid.test(row.id || "") ||
      !slug.test(row.slug || "") ||
      row.slug.length > 80 ||
      seen.has(row.id) ||
      slugs.has(row.slug) ||
      !boundedText(content.title, 120) ||
      !boundedText(content.summary, 300) ||
      typeof content.asset_id !== "string" ||
      !Object.hasOwn(workAssets, content.asset_id) ||
      row.provenance?.permitted_use !== "site-public" ||
      !Number.isFinite(Date.parse(row.provenance?.verified_at)) ||
      typeof row.published_at !== "string" ||
      !Number.isFinite(Date.parse(row.published_at))
    )
      continue;
    const format = content.format === undefined ? "work" : content.format;
    if (!Object.hasOwn(publicationFormats, format) || content.format === "work")
      continue;
    const mediaUrl = approvedMediaUrl(content.media_url);
    if (
      mediaUrl === null ||
      (mediaUrl && format !== "video") ||
      (format === "video" && !mediaUrl)
    )
      continue;
    seen.add(row.id);
    slugs.add(row.slug);
    // Explicit public DTO: private draft/audit/source fields cannot cross here.
    publications.push({
      id: row.id,
      slug: row.slug,
      title: content.title,
      summary: content.summary,
      asset_id: content.asset_id,
      format,
      published_at: row.published_at,
      attribution:
        typeof row.provenance?.attribution === "string"
          ? row.provenance.attribution.slice(0, 500)
          : "",
    });
  }
  return publications.sort(
    (a, b) =>
      Date.parse(b.published_at) - Date.parse(a.published_at) ||
      a.slug.localeCompare(b.slug),
  );
}

export function inCollection(publication, collection) {
  if (collection === "all") return true;
  if (collection === "publications")
    return ["article", "issue", "work"].includes(publication.format);
  if (collection === "funnies") return publication.format === "funnies";
  if (collection === "comics")
    return ["comic", "funnies"].includes(publication.format);
  if (collection === "videos") return publication.format === "video";
  return false;
}

export function filterPublications(
  publications,
  { collection = "all", query = "" } = {},
) {
  const search =
    typeof query === "string"
      ? query.trim().slice(0, 160).toLocaleLowerCase()
      : "";
  return publications.filter(
    (item) =>
      inCollection(item, collection) &&
      (!search ||
        [
          item.title,
          item.summary,
          item.attribution,
          publicationFormats[item.format],
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(search)),
  );
}

export function collectionCounts(publications) {
  return Object.fromEntries(
    reathCollections.map(({ id }) => [
      id,
      publications.filter((item) => inCollection(item, id)).length,
    ]),
  );
}
