// Disposable local preview. Real PG17 + PostgREST; synthetic Auth only.
import { roomsHttpFixture } from "../tests/helpers/roomsHttpFixture.mjs";
import { hubActor } from "../tests/helpers/hubDatabase.mjs";
import {
  startConsumerApp,
  stopConsumerApp,
} from "../tests/helpers/consumerHttpFixture.mjs";
import {
  defaultAppearance,
  defaultOrder,
  defaultVisibility,
} from "../src/lib/rooms/registry.mjs";
import { bootstrapProjects } from "../src/lib/hub/catalog.mjs";
const cleanup = [];
const t = { after: (fn) => cleanup.push(fn) };
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  for (const fn of cleanup.reverse()) await fn();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
const fixture = await roomsHttpFixture(t);
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
    await hubActor(fixture.db, "editor", (c) =>
      c.query("select public.save_eggs_work(null,$1,$2,0,'save') work", [
        asset,
        content,
      ]),
    )
  ).rows[0].work;
  await hubActor(fixture.db, "publisher", (c) =>
    c.query("select public.save_eggs_work($1,$2,null,1,'publish')", [
      draft.id,
      draft.slug,
    ]),
  );
}
await hubActor(fixture.db, "alice", (c) =>
  c.query(
    "insert into public.eggs_profiles(handle,display_name) values('local_alice','Alice / off the clock')",
  ),
);
const works = (
  await fixture.db.admin.query("select id from public.eggs_works order by slug")
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
await hubActor(fixture.db, "alice", (c) =>
  c.query("select public.save_my_eggs_room(0,$1)", [value]),
);
const app = await startConsumerApp(fixture.env, 3114);
cleanup.push(() => stopConsumerApp(app));
console.log("Local rooms preview: " + app.base);
console.log(
  "Synthetic users: alice@fixture.invalid, publisher@fixture.invalid, editor@fixture.invalid, bob@fixture.invalid. Password: fixture-password",
);
console.log(
  "Real disposable PostgreSQL/PostgREST. No hosted services. Type stop to shut down.",
);
process.stdin.setEncoding("utf8");
process.stdin.on("data", (text) => {
  if (text.trim() === "stop") void stop();
});
process.stdin.resume();
