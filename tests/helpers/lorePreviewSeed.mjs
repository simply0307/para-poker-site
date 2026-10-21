import fs from "node:fs";
import assert from "node:assert/strict";
import { hubActor } from "./hubDatabase.mjs";
import {
  publicChannelVideos,
  reathSource,
} from "../../src/lib/reath/releases.mjs";
// This is a loopback development seed, never a runtime/hosted content importer.
export async function seedLorePreview(db, { privateReviewFile } = {}) {
  assert.equal(db.admin.connectionParameters.host, "127.0.0.1");
  assert.equal(db.admin.connectionParameters.database, "hub_test");
  const content = (title, summary, source, extra = {}) => ({
    title,
    summary,
    body: summary,
    continuity_note:
      "A reader introduction from the cited public release. This does not approve or change governing story canon.",
    attribution: "Eternal Galaxy Gaming Studio / public source",
    permission: "site-public",
    source_reviewed: true,
    public_source: source,
    internal_source:
      "Local development source check against the existing public release; no hosted publication action.",
    project_id: null,
    ...extra,
  });
  async function save(world, kind, slug, value, publish) {
    const draft = (
      await hubActor(db, "editor", (client) =>
        client.query(
          "select public.save_eggs_lore(null,$1,$2,$3,$4,0,'save') entry",
          [world, kind, slug, value],
        ),
      )
    ).rows[0].entry;
    if (publish)
      await hubActor(db, "publisher", (client) =>
        client.query(
          "select public.save_eggs_lore($1,$2,$3,$4,null,$5,'publish')",
          [draft.id, world, kind, slug, draft.version],
        ),
      );
  }
  const divided = "https://www.youtube.com/watch?v=l08RyKzGOdQ";
  await save(
    "paralleon",
    "world",
    "paralleon",
    content(
      "Paralleon",
      "The EGGS world introduced through its factions and character films.",
      divided,
      {
        body: "Begin with the public introductions to Sheen, Bizi, Frumo and Rumin, then follow the character sketches. These introductions retain their original video sources.\n\nLonger source dossiers have separate editorial drafts. Their private working text is not included in these public reader introductions.",
      },
    ),
    true,
  );
  await save(
    "reath",
    "world",
    "reath",
    content(
      "Reath / stories within the world",
      "The people, places and ideas encountered in the released Reath Digest comics.",
      reathSource.url,
      {
        project_id: "a0000000-0000-4000-8000-000000000004",
        body: "Reath Digest's released comics include A Natural Choice and Moon Bars. Explore their characters, places and story threads alongside the original reading copies.\n\nReath Funnies is fiction within fiction. These dossiers describe the public stories and do not promote their depicted events into governing world canon.",
      },
    ),
    true,
  );
  for (const title of ["Rumin", "Sheen", "Frumo", "Bizi"])
    await save(
      "paralleon",
      "factions",
      title.toLowerCase() + "-introduction",
      content(
        title,
        title +
          " is one of the four factions introduced in the official EGGS film Why are we divided?",
        divided,
      ),
      true,
    );
  for (const [id, title, slug] of [
    ["o9MW6jRTJ6I", "Tang, the Weathered", "tang-introduction"],
    ["mZJgOF8FLCI", "Polea, of the sea", "polea-introduction"],
    ["7qaa1lRM4X8", "Kaisar, The Jewel", "kaisar-introduction"],
    ["YDPbD-CD_JU", "Meerus", "meerus-introduction"],
  ]) {
    const video = publicChannelVideos().find(
      (item) => item.id === "video:" + id,
    );
    await save(
      "paralleon",
      "people",
      slug,
      content(title, video.summary, video.source_url),
      true,
    );
  }
  const choice = "https://reath-digest.carrd.co/#funniesedition1",
    moon = "https://reath-digest.carrd.co/#funniesedition2";
  for (const [kind, slug, title, summary, source] of [
    [
      "people",
      "infinitimer",
      "Commissioner Infinitimer",
      "The Plateball commissioner endorsed by President Goldenprong in A Natural Choice, later appointed High Secretary of International Dining.",
      choice,
    ],
    [
      "people",
      "goldenprong",
      "President Goldenprong",
      "The president who endorses Infinitimer's international dining appointment in A Natural Choice.",
      choice,
    ],
    [
      "people",
      "miro-bloom",
      "Miro Bloom",
      "The singer in Moon Bars whose restorative performance circuit becomes too successful to end.",
      moon,
    ],
    [
      "places",
      "tablelands",
      "The Tablelands",
      "The setting identified for the Reath Funnies comic A Natural Choice.",
      choice,
    ],
    [
      "places",
      "little-grand-dive",
      "The Little Grand Dive",
      "The venue named in the public Moon Bars comic.",
      moon,
    ],
    [
      "events",
      "infinitimer-appointment",
      "Infinitimer's appointment",
      "A Natural Choice follows the endorsement and appointment of Infinitimer to an international dining role.",
      choice,
    ],
    [
      "terms",
      "restorative-performance-circuit",
      "Restorative performance circuit",
      "The voluntary performance arrangement at the center of Miro Bloom's story in Moon Bars.",
      moon,
    ],
  ])
    await save("reath", kind, slug, content(title, summary, source), true);
  let privateDrafts = 0;
  if (privateReviewFile) {
    const manifest = JSON.parse(fs.readFileSync(privateReviewFile, "utf8"));
    assert.equal(manifest.actual_rows, 42);
    assert.equal(
      manifest.sha256,
      "89a7c4590437c79a4fd10a01a33c89e335563745d203d69f5b1273596eb14908",
    );
    for (const entry of manifest.entries) {
      assert.equal(entry.world, "paralleon");
      assert.equal(entry.content.permission, "unreviewed");
      assert.equal(entry.content.source_reviewed, false);
      await save(entry.world, entry.kind, entry.slug, entry.content, false);
      privateDrafts++;
    }
  }
  return { publicEntries: 17, privateDrafts };
}
