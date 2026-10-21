import { hubActor } from "./hubDatabase.mjs";
import { seedRoomsPreview } from "./roomsPreviewSeed.mjs";
import { REATH_PROJECT_ID } from "../../src/lib/reath/catalog.mjs";

// Browser verification content is opt-in. The normal local preview has no
// community posts and does not pretend these fixtures are real Reath releases.
export async function seedCommunityPreview(db, { publications = false } = {}) {
  await seedRoomsPreview(db);
  if (!publications) return;
  for (const [format, asset] of [
    ["article", "signal-grid"],
    ["issue", "room-map"],
    ["comic", "night-ticket"],
    ["video", "signal-grid"],
  ]) {
    const content = {
      title: "Local verification fixture — " + format,
      summary:
        "Synthetic browser acceptance content; not an actual Reath release.",
      description:
        "A disposable test of the published reading shelf with site-owned deterministic artwork.",
      asset_id: asset,
      project_id: REATH_PROJECT_ID,
      format,
      ...(format === "video"
        ? { media_url: "https://www.youtube.com/watch?v=abcdefghijk" }
        : {}),
    };
    const draft = (
      await hubActor(db, "editor", (client) =>
        client.query("select public.save_eggs_work(null,$1,$2,0,'save') work", [
          "verification-" + format,
          content,
        ]),
      )
    ).rows[0].work;
    await hubActor(db, "publisher", (client) =>
      client.query("select public.save_eggs_work($1,$2,null,1,'publish')", [
        draft.id,
        draft.slug,
      ]),
    );
  }
}
