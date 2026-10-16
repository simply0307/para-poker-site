import test from "node:test";
import assert from "node:assert/strict";
import { hasPostgres } from "./helpers/localPostgres.mjs";
import {
  hubDatabase,
  hubActor,
  beginHubActor,
  hubIds,
  rejected,
} from "./helpers/hubDatabase.mjs";
import { roomMigration } from "./helpers/roomsDatabase.mjs";
import { localPostgrest, hasPostgrest } from "./helpers/localPostgrest.mjs";
import {
  defaultAppearance,
  defaultOrder,
  defaultVisibility,
} from "../src/lib/rooms/registry.mjs";
import { bootstrapProjects } from "../src/lib/hub/catalog.mjs";
const project = bootstrapProjects[1].id;
const value = () => ({
  profile: {
    display_name: "Alice",
    bio: "HIDDEN_BIO_SENTINEL",
    visibility: "public",
  },
  expression: {
    favorite_project_ids: [project],
    affiliation: "maker",
    pinned_project_id: project,
    featured_note: "HIDDEN_NOTE_SENTINEL",
    accent: "sage",
  },
  appearance: structuredClone(defaultAppearance),
  module_visibility: { ...defaultVisibility },
  module_order: [...defaultOrder],
  showcase: [{ type: "project", id: project }],
});
const save = (db, user, revision, v) =>
  hubActor(db, user, (c) =>
    c.query("select public.save_my_eggs_room($1,$2) room", [revision, v]),
  ).then((r) => r.rows[0].room);
const read = (db, user) =>
  hubActor(db, user, (c) =>
    c.query("select public.get_my_eggs_room() room"),
  ).then((r) => r.rows[0].room);
const pub = (db) =>
  hubActor(
    db,
    "bob",
    (c) => c.query("select public.get_public_eggs_room('room_alice') room"),
    "anon",
  ).then((r) => r.rows[0].room);
const workContent = {
  title: "Signal grid",
  summary: "Original geometric study",
  description: "A site-owned deterministic grid.",
  asset_id: "signal-grid",
  project_id: null,
};
const workSave = (
  db,
  user,
  id = null,
  version = 0,
  action = "save",
  content = workContent,
) =>
  hubActor(db, user, (c) =>
    c.query("select public.save_eggs_work($1,'signal-grid',$2,$3,$4) work", [
      id,
      content,
      version,
      action,
    ]),
  ).then((r) => r.rows[0].work);
test(
  "Personal rooms: PG17 privacy, concurrency, publication and real PostgREST",
  { skip: !hasPostgres, timeout: 180000 },
  async (t) => {
    const db = await hubDatabase(t);
    await db.apply();
    const snapshot = async () =>
      (
        await db.admin.query(
          "select c.relname,c.relacl::text,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname !~ '^eggs_' order by c.relname",
        )
      ).rows;
    const before = await snapshot();
    await t.test("candidate rolls back schema and grants cleanly", async () => {
      const grants = (
        await db.admin.query(
          "select attacl::text from pg_attribute where attrelid='public.eggs_profiles'::regclass and attname='bio'",
        )
      ).rows;
      const oldView = (
        await db.admin.query(
          "select pg_get_viewdef('public.eggs_public_profiles'::regclass,true) definition",
        )
      ).rows;
      const oldProjects = (
        await db.admin.query("select * from public.eggs_projects order by id")
      ).rows;
      await assert.rejects(
        () =>
          db.admin.query(
            roomMigration.replace(/commit;\s*$/u, "select 1/0; commit;"),
          ),
        (error) => error.code === "22012",
      );
      await db.admin.query("rollback");
      assert.deepEqual(
        (
          await db.admin.query(
            "select pg_get_viewdef('public.eggs_public_profiles'::regclass,true) definition",
          )
        ).rows,
        oldView,
      );
      assert.deepEqual(
        (await db.admin.query("select * from public.eggs_projects order by id"))
          .rows,
        oldProjects,
      );
      assert.deepEqual(await snapshot(), before);
      await db.admin.query(roomMigration.replace(/commit;\s*$/u, "rollback;"));
      assert.equal(
        (
          await db.admin.query(
            "select to_regclass('eggs_rooms_private.rooms') name",
          )
        ).rows[0].name,
        null,
      );
      assert.deepEqual(
        (
          await db.admin.query(
            "select attacl::text from pg_attribute where attrelid='public.eggs_profiles'::regclass and attname='bio'",
          )
        ).rows,
        grants,
      );
    });
    await db.admin.query(roomMigration);
    assert.deepEqual(await snapshot(), before);
    for (const user of ["alice", "bob"])
      await hubActor(db, user, (c) =>
        c.query(
          "insert into public.eggs_profiles(handle,display_name) values($1,$2)",
          ["room_" + user, user],
        ),
      );
    let room = await read(db, "alice"),
      work;
    await t.test(
      "new boards are empty; owner projection and live-session enforcement",
      async () => {
        assert.equal(room.revision, 0);
        assert.deepEqual(room.modules.showcase, []);
        await rejected(
          hubActor(db, "bob", (c) =>
            c.query("select eggs_rooms_private.room($1,true)", [
              room.profile.id,
            ]),
          ),
          "42501",
        );
        await rejected(
          hubActor(
            db,
            "alice",
            (c) => c.query("select public.get_my_eggs_room()"),
            "anon",
          ),
          "42501",
        );
        for (const user of ["bob", "editor", "publisher", "operator"])
          assert.equal(
            (
              await hubActor(db, user, (c) =>
                c.query("select id from public.eggs_profiles where id=$1", [
                  room.profile.id,
                ]),
              )
            ).rowCount,
            0,
          );
      },
    );
    await t.test(
      "atomic save preserves five-favorites field and independent board",
      async () => {
        room = await save(db, "alice", 0, value());
        assert.equal(room.revision, 1);
        assert.deepEqual(room.modules.favorite_project_ids, [project]);
        assert.equal(room.modules.showcase.length, 1);
        assert.equal((await pub(db)).modules.bio, "HIDDEN_BIO_SENTINEL");
      },
    );
    await t.test(
      "all hidden modules omitted from public JSON and old view; owner retains data",
      async () => {
        const v = value();
        v.module_visibility = Object.fromEntries(
          defaultOrder.map((k) => [k, false]),
        );
        room = await save(db, "alice", 1, v);
        assert.deepEqual((await pub(db)).modules, {});
        assert.equal(room.modules.bio, "HIDDEN_BIO_SENTINEL");
        for (const role of ["anon", "authenticated"]) {
          await rejected(
            hubActor(
              db,
              "bob",
              (c) => c.query("select bio from public.eggs_profiles"),
              role,
            ),
            "42501",
          );
          assert.equal(
            (
              await hubActor(
                db,
                "bob",
                (c) =>
                  c.query(
                    "select bio from public.eggs_public_profiles where handle='room_alice'",
                  ),
                role,
              )
            ).rows[0].bio,
            null,
          );
        }
        await rejected(
          hubActor(
            db,
            "bob",
            (c) => c.query("select * from public.eggs_profile_expression"),
            "anon",
          ),
          "42501",
        );
        for (const user of ["bob", "editor", "publisher"])
          assert.equal(
            (
              await hubActor(db, user, (c) =>
                c.query("select * from public.eggs_profile_expression"),
              )
            ).rowCount,
            0,
          );
        assert.equal(
          (
            await hubActor(db, "alice", (c) =>
              c.query("select bio from public.get_my_eggs_profile()"),
            )
          ).rows[0].bio,
          "HIDDEN_BIO_SENTINEL",
        );
      },
    );
    await t.test(
      "raw writes and legacy expression RPC cannot bypass revisions",
      async () => {
        await rejected(
          hubActor(db, "alice", (c) =>
            c.query("update public.eggs_profiles set bio='bypass'"),
          ),
          "42501",
        );
        await rejected(
          hubActor(db, "alice", (c) =>
            c.query(
              "select public.save_eggs_expression('{}','',null,'','sage')",
            ),
          ),
          "42501",
        );
        await rejected(
          hubActor(db, "alice", (c) =>
            c.query(
              "update public.eggs_profile_expression set featured_note='bypass'",
            ),
          ),
          "42501",
        );
      },
    );
    await t.test(
      "invalid IDs, duplicate slots, unknown appearance and invalid modules roll back everything",
      async () => {
        const prior = await read(db, "alice");
        const bad = [];
        for (const edit of [
          (v) => v.showcase.push(v.showcase[0]),
          (v) => (v.showcase = [{ type: "work", id: hubIds.bob }]),
          (v) => (v.showcase = Array(9).fill(v.showcase[0])),
          (v) => (v.appearance.cover = "https://example.com/x"),
          (v) => (v.appearance.stamps = ["approved", "approved"]),
          (v) => (v.module_order = ["bio"]),
          (v) => (v.profile.owner = hubIds.bob),
          (v) => (v.expression.favorite_project_ids = [hubIds.bob]),
        ]) {
          const v = value();
          edit(v);
          bad.push(v);
        }
        for (const v of bad) {
          await rejected(save(db, "alice", 2, v), ["23514", "23503"]);
          assert.deepEqual(await read(db, "alice"), prior);
        }
      },
    );
    await t.test(
      "two simultaneous saves: one real row-lock winner, stale writer loses",
      async () => {
        const a = await db.connect(),
          b = await db.connect();
        await beginHubActor(a, "alice");
        await beginHubActor(b, "alice");
        const v = value();
        v.profile.display_name = "Winning tab";
        try {
          await a.query("select public.save_my_eggs_room(2,$1)", [v]);
          const pid = (await b.query("select pg_backend_pid() pid")).rows[0]
            .pid;
          const pending = b
            .query("select public.save_my_eggs_room(2,$1)", [value()])
            .then(
              () => null,
              (e) => e.code,
            );
          let locked = false;
          for (let i = 0; i < 80; i++) {
            if (
              (
                await db.admin.query(
                  "select wait_event_type from pg_stat_activity where pid=$1",
                  [pid],
                )
              ).rows[0].wait_event_type === "Lock"
            ) {
              locked = true;
              break;
            }
            await new Promise((r) => setTimeout(r, 25));
          }
          assert.ok(locked);
          await a.query("commit");
          assert.equal(await pending, "PT409");
        } finally {
          await a.query("rollback");
          await b.query("rollback");
          await a.end();
          await b.end();
        }
        room = await read(db, "alice");
        assert.equal(room.revision, 3);
        assert.equal(room.profile.display_name, "Winning tab");
      },
    );
    await t.test(
      "work drafts, publication roles, exact saved snapshot and immutable audit",
      async () => {
        work = await workSave(db, "editor");
        await rejected(
          workSave(db, "editor", work.id, 1, "publish", null),
          "42501",
        );
        assert.equal(
          (
            await hubActor(db, "bob", (c) =>
              c.query("select * from public.eggs_work_drafts"),
            )
          ).rowCount,
          0,
        );
        await rejected(
          hubActor(
            db,
            "bob",
            (c) => c.query("select * from public.eggs_work_drafts"),
            "anon",
          ),
          "42501",
        );
        work = await workSave(db, "publisher", work.id, 1, "publish", null);
        assert.equal(work.version, 2);
        assert.equal(
          (
            await hubActor(
              db,
              "bob",
              (c) => c.query("select * from public.eggs_works"),
              "anon",
            )
          ).rows[0].provenance.permitted_use,
          "site-public",
        );
        await rejected(
          workSave(db, "publisher", work.id, 1, "archive", null),
          "40001",
        );
        await rejected(
          workSave(db, "publisher", work.id, 2, "publish", workContent),
          "22023",
        );
        assert.equal(
          (
            await hubActor(db, "editor", (c) =>
              c.query("select public.eggs_work_audit($1) a", [work.id]),
            )
          ).rows[0].a.length,
          2,
        );
        await rejected(
          hubActor(db, "publisher", (c) =>
            c.query("delete from public.eggs_works"),
          ),
          "42501",
        );
        await rejected(
          hubActor(db, "publisher", (c) =>
            c.query("delete from eggs_rooms_private.work_audit"),
          ),
          "42501",
        );
      },
    );
    await t.test(
      "unverified rights and fabricated asset/project IDs cannot publish",
      async () => {
        await db.admin.query(
          "insert into eggs_rooms_private.assets values('unverified','archive/ref','unknown','reference-only',null,'none')",
        );
        const draft = await workSave(db, "editor", work.id, 2, "save", {
          ...workContent,
          asset_id: "unverified",
        });
        await rejected(
          workSave(db, "publisher", draft.id, draft.version, "publish", null),
          "23514",
        );
        await rejected(
          workSave(db, "editor", draft.id, draft.version, "save", {
            ...workContent,
            asset_id: "../arbitrary",
          }),
          "23514",
        );
        await rejected(
          workSave(db, "editor", draft.id, draft.version, "save", {
            ...workContent,
            project_id: hubIds.alice,
          }),
          "23514",
        );
        work = await workSave(
          db,
          "editor",
          draft.id,
          draft.version,
          "save",
          workContent,
        );
      },
    );
    await t.test(
      "archived selections survive private edits but disappear publicly",
      async () => {
        const v = value();
        v.showcase.push({ type: "work", id: work.id });
        room = await save(db, "alice", 3, v);
        await workSave(db, "publisher", work.id, work.version, "archive", null);
        await hubActor(db, "publisher", (c) =>
          c.query(
            "select public.save_eggs_project($1,'gauntlet-online',null,1,'archive')",
            [project],
          ),
        );
        const mine = await read(db, "alice");
        assert.ok(mine.modules.showcase.every((x) => x.unavailable));
        assert.deepEqual((await pub(db)).modules.showcase, []);
        assert.deepEqual((await pub(db)).modules.favorites, []);
        room = await save(db, "alice", 4, v);
        assert.equal(room.revision, 5);
        assert.equal(room.modules.showcase.length, 2);
      },
    );
    await t.test(
      "actual PostgREST blocks raw reads and enforces owner/live-session writes",
      { skip: !hasPostgrest },
      async () => {
        const rest = await localPostgrest(t, db);
        assert.equal(
          (await rest.request("/eggs_profiles?select=bio")).status,
          401,
        );
        assert.equal(
          (await rest.request("/eggs_profile_expression?select=*")).status,
          401,
        );
        assert.deepEqual(
          await (
            await rest.request("/eggs_profile_expression?select=*", {
              user: "bob",
            })
          ).json(),
          [],
        );
        const v = value();
        v.showcase = [];
        v.expression.favorite_project_ids = [];
        v.expression.pinned_project_id = null;
        v.module_visibility = Object.fromEntries(
          defaultOrder.map((k) => [k, false]),
        );
        let r = await rest.request("/rpc/save_my_eggs_room", {
          user: "alice",
          method: "POST",
          body: { p_revision: 5, p_value: v },
        });
        assert.equal(r.status, 200, await r.clone().text());
        r = await rest.request("/rpc/save_my_eggs_room", {
          user: "alice",
          method: "POST",
          body: { p_revision: 5, p_value: v },
        });
        assert.equal(r.status, 409);
        r = await rest.request("/rpc/get_public_eggs_room", {
          method: "POST",
          body: { p_handle: "room_alice" },
        });
        assert.deepEqual((await r.json()).modules, {});
        assert.equal(
          (
            await rest.request("/rpc/get_my_eggs_room", {
              method: "POST",
              body: {},
            })
          ).status,
          401,
        );
        await db.admin.query("delete from auth.sessions where user_id=$1", [
          hubIds.alice,
        ]);
        assert.equal(
          (
            await rest.request("/rpc/save_my_eggs_room", {
              user: "alice",
              method: "POST",
              body: { p_revision: 6, p_value: v },
            })
          ).status,
          403,
        );
        await db.admin.query(
          "insert into auth.sessions(id,user_id) values($1,$1)",
          [hubIds.alice],
        );
      },
    );
    await t.test(
      "private profiles are not enumerated; deletion preserves handles, audits and Poker",
      async () => {
        const mine = await read(db, "alice");
        const v = value();
        v.profile.visibility = "private";
        v.showcase = [];
        v.expression.favorite_project_ids = [];
        v.expression.pinned_project_id = null;
        await save(db, "alice", mine.revision, v);
        assert.equal(await pub(db), null);
        assert.equal(
          (
            await hubActor(
              db,
              "bob",
              (c) =>
                c.query(
                  "select * from public.eggs_public_profiles where handle='room_alice'",
                ),
              "anon",
            )
          ).rowCount,
          0,
        );
        await db.admin.query("delete from auth.users where id=$1", [
          hubIds.alice,
        ]);
        assert.equal(
          (
            await db.admin.query(
              "select count(*)::int n from eggs_rooms_private.rooms",
            )
          ).rows[0].n,
          0,
        );
        assert.equal(
          (
            await db.admin.query(
              "select count(*)::int n from eggs_rooms_private.featured_slots",
            )
          ).rows[0].n,
          0,
        );
        assert.equal(
          (
            await db.admin.query(
              "select count(*)::int n from eggs_private.handle_registry where handle='room_alice'",
            )
          ).rows[0].n,
          1,
        );
        assert.ok(
          (
            await db.admin.query(
              "select count(*)::int n from eggs_rooms_private.work_audit",
            )
          ).rows[0].n > 0,
        );
        assert.deepEqual(await snapshot(), before);
      },
    );
  },
);
