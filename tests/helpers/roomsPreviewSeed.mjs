import { hubActor } from "./hubDatabase.mjs";
import {
  defaultAppearance,
  defaultOrder,
  defaultVisibility,
} from "../../src/lib/rooms/registry.mjs";
import { bootstrapProjects } from "../../src/lib/hub/catalog.mjs";
export async function seedRoomsPreview(db) {
  for (const [asset, title, summary] of [
    [
      "signal-grid",
      "Signal studies",
      "An orbital diagram for the things that pull us in.",
    ],
    ["night-ticket", "Admit yourself", "A ticket for ideas that stay up late."],
    [
      "room-map",
      "A room of your own",
      "A small floor plan for a much bigger world.",
    ],
  ]) {
    const content = {
      title,
      summary,
      description: summary + " An original deterministic design made for EGGS.",
      asset_id: asset,
      project_id: null,
    };
    const draft = (
      await hubActor(db, "editor", (c) =>
        c.query("select public.save_eggs_work(null,$1,$2,0,'save') work", [
          asset,
          content,
        ]),
      )
    ).rows[0].work;
    await hubActor(db, "publisher", (c) =>
      c.query("select public.save_eggs_work($1,$2,null,1,'publish')", [
        draft.id,
        draft.slug,
      ]),
    );
  }
  await hubActor(db, "alice", (c) =>
    c.query(
      "insert into public.eggs_profiles(handle,display_name) values('local_alice','Alice / off the clock')",
    ),
  );
  const works = (
    await db.admin.query("select id from public.eggs_works order by slug")
  ).rows;
  const value = {
    profile: {
      display_name: "Alice / off the clock",
      bio: "Here for games, paper things, and the next interesting idea.\nMaking a little room for all of it.",
      visibility: "public",
    },
    expression: {
      favorite_project_ids: bootstrapProjects.slice(0, 3).map((p) => p.id),
      affiliation: "maker",
      pinned_project_id: bootstrapProjects[0].id,
      featured_note:
        "Currently collecting good stories and questionable strategies.",
      accent: "sage",
    },
    appearance: {
      ...defaultAppearance,
      stamps: ["good-egg", "night-owl", "maker"],
    },
    module_visibility: defaultVisibility,
    module_order: defaultOrder,
    showcase: [
      ...bootstrapProjects.map((p) => ({ type: "project", id: p.id })),
      ...works.map((w) => ({ type: "work", id: w.id })),
    ],
  };
  await hubActor(db, "alice", (c) =>
    c.query("select public.save_my_eggs_room(0,$1)", [value]),
  );
}
