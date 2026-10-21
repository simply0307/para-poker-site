import test from "node:test";
import assert from "node:assert/strict";
import {
  REATH_PROJECT_ID,
  approvedMediaUrl,
  collectionCounts,
  filterPublications,
  reathCollections,
  reathPublications,
} from "../src/lib/reath/catalog.mjs";

function work(index = 1, content = {}, row = {}) {
  return {
    id: `b0000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    slug: `reath-work-${index}`,
    published_at: "2026-10-16T00:00:00.000Z",
    content: {
      title: `Reading room ${index}`,
      summary: "An original Reath work.",
      description: "The full work remains on the canonical library page.",
      asset_id: "signal-grid",
      project_id: REATH_PROJECT_ID,
      ...content,
    },
    provenance: {
      attribution: "EGGS creators",
      permitted_use: "site-public",
      verified_at: "2026-10-15T00:00:00.000Z",
    },
    ...row,
  };
}

test("Reath legacy five-key works remain generic publications", () => {
  const source = work();
  assert.equal(Object.keys(source.content).length, 5);
  const [publication] = reathPublications([source]);
  assert.equal(publication.format, "work");
  assert.equal(publication.title, source.content.title);
  assert.equal(collectionCounts([publication]).publications, 1);
});

test("Reath includes only exact associated published snapshots with verified public assets", () => {
  const rejected = [
    work(2, { project_id: null }),
    work(3, { project_id: "a0000000-0000-4000-8000-000000000001" }),
    work(4, { project_id: REATH_PROJECT_ID + "-forged" }),
    work(5, {}, { state: "draft" }),
    work(6, {}, { state: "archived" }),
    work(7, {}, { published_at: null }),
    work(8, {}, { published_at: "not a date" }),
    work(
      9,
      {},
      {
        provenance: {
          permitted_use: "reference-only",
          verified_at: "2026-10-15",
        },
      },
    ),
    work(
      10,
      {},
      { provenance: { permitted_use: "site-public", verified_at: null } },
    ),
    work(11, { asset_id: "https://private.example/asset.png" }),
    work(12, { asset_id: "__proto__" }),
  ];
  assert.deepEqual(
    reathPublications([work(), ...rejected]).map((item) => item.slug),
    ["reath-work-1"],
  );
});

test("Reath catalog is a narrow public DTO without source records or draft data", () => {
  const source = work(
    1,
    { private_note: "PRIVATE-NOTE", media_url: "" },
    {
      editorial_notes: "PRIVATE-EDITORIAL",
      audit: [{ actor_id: "PRIVATE-ACTOR" }],
    },
  );
  source.provenance.source = "https://drive.google.com/private-source";
  const [publication] = reathPublications([source]);
  assert.deepEqual(Object.keys(publication).sort(), [
    "asset_id",
    "attribution",
    "format",
    "id",
    "published_at",
    "slug",
    "summary",
    "title",
  ]);
  assert.doesNotMatch(
    JSON.stringify(publication),
    /PRIVATE-|drive\.google|editorial_notes|audit|description|media_url/,
  );
});

test("Reath formats are exact; videos require a canonical approved public watch URL", () => {
  const rows = [
    work(1, { format: "article" }),
    work(2, { format: "issue" }),
    work(3, { format: "comic" }),
    work(4, { format: "funnies" }),
    work(5, {
      format: "video",
      media_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    }),
    work(6, { format: "video", media_url: "https://vimeo.com/123456789" }),
    work(7, { format: "video", media_url: "" }),
    work(8, { format: "podcast" }),
    work(9, { format: "work" }),
    work(10, { format: null }),
    work(11, { format: "__proto__" }),
    work(12, { format: "article", media_url: "https://vimeo.com/12345" }),
  ];
  assert.deepEqual(
    reathPublications(rows).map((item) => item.slug),
    [1, 2, 3, 4, 5, 6].map((i) => `reath-work-${i}`),
  );
});

test("media links reject private storage, lookalike hosts, embedded credentials and parameters", () => {
  for (const value of [
    "javascript:alert(1)",
    "https://drive.google.com/file/d/private/view",
    "https://www.youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com@evil.test/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&private=secret",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ#private",
    "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://vimeo.com/123?token=private",
    "https://vimeo.com/0",
    null,
    42,
  ])
    assert.equal(approvedMediaUrl(value), null, String(value));
  assert.equal(approvedMediaUrl(""), "");
  assert.equal(approvedMediaUrl(undefined), "");
});

test("Reath collection membership and counts preserve the Funnies/comic relationship", () => {
  const items = reathPublications([
    work(1),
    work(2, { format: "article" }),
    work(3, { format: "issue" }),
    work(4, { format: "comic" }),
    work(5, { format: "funnies" }),
    work(6, { format: "video", media_url: "https://vimeo.com/12345" }),
  ]);
  assert.deepEqual(
    reathCollections.map(({ id }) => id),
    ["all", "publications", "funnies", "comics", "videos"],
  );
  assert.deepEqual(collectionCounts(items), {
    all: 6,
    publications: 3,
    funnies: 1,
    comics: 2,
    videos: 1,
  });
  assert.deepEqual(
    filterPublications(items, { collection: "comics" }).map(
      (item) => item.format,
    ),
    ["comic", "funnies"],
  );
  assert.equal(filterPublications(items, { collection: "unknown" }).length, 0);
});

test("search combines collection filtering, case-insensitive title/summary/credit and blank queries", () => {
  const items = reathPublications([
    work(1, { title: "The Moon", format: "funnies" }),
    work(2, {
      title: "City notes",
      summary: "A lunar reading.",
      format: "article",
    }),
    work(3, { title: "Studio notes", format: "issue" }),
  ]);
  assert.deepEqual(
    filterPublications(items, { query: "  MOON " }).map((item) => item.slug),
    ["reath-work-1"],
  );
  assert.equal(
    filterPublications(items, { collection: "publications", query: "moon" })
      .length,
    0,
  );
  assert.equal(filterPublications(items, { query: "lunar" }).length, 1);
  assert.equal(filterPublications(items, { query: "eggs creators" }).length, 3);
  assert.equal(filterPublications(items, { query: "" }).length, 3);
  assert.equal(filterPublications(items, { query: null }).length, 3);
  assert.equal(filterPublications(items, { query: "<script>" }).length, 0);
});

test("catalog ordering is newest first and duplicate identities/routes cannot repeat", () => {
  const items = reathPublications([
    work(1),
    work(2, {}, { published_at: "2026-10-18T00:00:00Z" }),
    work(1),
    work(3, {}, { slug: "reath-work-2" }),
  ]);
  assert.deepEqual(
    items.map((item) => item.id),
    [work(2).id, work(1).id],
  );
});

test("malformed input fails closed without invented catalog entries", () => {
  for (const value of [undefined, null, {}, "private-catalog"])
    assert.deepEqual(reathPublications(value), []);
  assert.deepEqual(
    reathPublications([
      null,
      [],
      {},
      work(1, { title: "" }),
      work(2, { summary: " " }),
      work(3, {}, { id: "forged-id" }),
      work(4, {}, { slug: "../private" }),
      work(5, {}, { slug: 123 }),
      work(6, {}, { content: null }),
    ]),
    [],
  );
  assert.deepEqual(collectionCounts([]), {
    all: 0,
    publications: 0,
    funnies: 0,
    comics: 0,
    videos: 0,
  });
});
