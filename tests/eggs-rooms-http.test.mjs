import test from "node:test";
import assert from "node:assert/strict";
import { hasPostgres } from "./helpers/localPostgres.mjs";
import { hasPostgrest } from "./helpers/localPostgrest.mjs";
import { roomsHttpFixture } from "./helpers/roomsHttpFixture.mjs";
import { hubActor } from "./helpers/hubDatabase.mjs";
import {
  startConsumerApp,
  stopConsumerApp,
  CookieJar,
} from "./helpers/consumerHttpFixture.mjs";
import { editableRoom } from "../src/lib/rooms/core.mjs";
import { bootstrapProjects } from "../src/lib/hub/catalog.mjs";
test(
  "built personal internet: real SQL/PostgREST with simulated Auth",
  { skip: !hasPostgres || !hasPostgrest, timeout: 180000 },
  async (t) => {
    const fixture = await roomsHttpFixture(t);
    let app = await startConsumerApp(fixture.env);
    t.after(() => stopConsumerApp(app));
    const request = async (
      path,
      { jar, method = "GET", body, origin = app.base, headers = {} } = {},
    ) => {
      const res = await fetch(app.base + path, {
        method,
        redirect: "manual",
        headers: {
          Origin: origin,
          ...(jar ? { Cookie: jar.header() } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      jar?.absorb(res);
      return res;
    };
    async function login(name) {
      const jar = new CookieJar();
      const res = await request("/api/eggs/auth", {
        jar,
        method: "POST",
        body: {
          action: "login",
          email: name + "@fixture.invalid",
          password: "fixture-password",
        },
      });
      assert.equal(res.status, 200, await res.clone().text());
      return jar;
    }
    const alice = await login("alice"),
      bob = await login("bob"),
      editor = await login("editor"),
      publisher = await login("publisher");
    let room, work;
    await t.test(
      "onboarding uses minimal writes and owner RPC, private profiles stay private",
      async () => {
        const r = await request("/api/eggs/profile", {
          jar: alice,
          method: "POST",
          body: {
            handle: "room_alice",
            display_name: "Room Alice",
            bio: "SECRET_BIO_SENTINEL",
          },
        });
        assert.equal(r.status, 201, await r.clone().text());
        assert.equal((await r.json()).profile.bio, "SECRET_BIO_SENTINEL");
        assert.equal((await request("/profile/room_alice")).status, 404);
        assert.equal((await request("/api/eggs/rooms/room_alice")).status, 404);
        assert.equal((await request("/profile/edit")).status, 307);
        assert.match(
          await (await request("/profile/edit", { jar: alice })).text(),
          /Live preview/u,
        );
        room = (await (await request("/api/eggs/room", { jar: alice })).json())
          .room;
      },
    );
    await t.test(
      "profile edit refresh persists renewed session cookies",
      async () => {
        const encoded = decodeURIComponent(alice.values.get("eggs_consumer"));
        const session = JSON.parse(
          Buffer.from(encoded.slice("base64-".length), "base64url").toString(),
        );
        session.expires_at = Math.floor(Date.now() / 1000) - 10;
        alice.values.set(
          "eggs_consumer",
          "base64-" +
            Buffer.from(JSON.stringify(session)).toString("base64url"),
        );
        const before = fixture.requests.filter(
          (r) => r.query === "?grant_type=refresh_token",
        ).length;
        const refreshed = await request("/profile/edit", { jar: alice });
        assert.equal(refreshed.status, 200);
        assert.match(await refreshed.text(), /Live preview/u);
        assert.ok(
          refreshed.headers.getSetCookie().length,
          "Page proxy persists the refreshed cookie",
        );
        assert.ok(
          fixture.requests.filter(
            (r) => r.query === "?grant_type=refresh_token",
          ).length > before,
        );
        assert.equal(
          (await request("/api/eggs/room", { jar: alice })).status,
          200,
        );
      },
    );
    await t.test(
      "owner writes enforce auth, origin, fields and revision; legacy routes fail closed",
      async () => {
        const value = editableRoom(room);
        value.profile.visibility = "public";
        value.expression.affiliation = "maker";
        value.expression.featured_note = "SECRET_NOTE_SENTINEL";
        value.expression.favorite_project_ids = [bootstrapProjects[0].id];
        value.showcase = [{ type: "project", id: bootstrapProjects[0].id }];
        const command = { revision: 0, value };
        assert.equal(
          (await request("/api/eggs/room", { method: "PUT", body: command }))
            .status,
          401,
        );
        assert.equal(
          (
            await request("/api/eggs/room", {
              jar: alice,
              origin: "https://evil.invalid",
              method: "PUT",
              body: command,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request("/api/eggs/room", {
              jar: alice,
              method: "PUT",
              body: { ...command, profile_id: "fake" },
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request("/api/eggs/room", {
              jar: bob,
              method: "PUT",
              body: command,
            })
          ).status,
          403,
        );
        const [a, b] = await Promise.all([
          request("/api/eggs/room", {
            jar: alice,
            method: "PUT",
            body: command,
          }),
          request("/api/eggs/room", {
            jar: alice.clone(),
            method: "PUT",
            body: command,
          }),
        ]);
        assert.deepEqual([a.status, b.status].sort(), [200, 409]);
        room = (await (a.status === 200 ? a : b).json()).room;
        assert.equal(
          (
            await request("/api/eggs/profile", {
              jar: alice,
              method: "PATCH",
              body: { bio: "legacy" },
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request("/api/eggs/expression", {
              jar: alice,
              method: "PUT",
              body: value.expression,
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      "hidden data absent from public JSON, HTML, metadata and embedded Next payload",
      async () => {
        const value = editableRoom(room);
        for (const key of Object.keys(value.module_visibility))
          value.module_visibility[key] = false;
        const res = await request("/api/eggs/room", {
          jar: alice,
          method: "PUT",
          body: { revision: room.revision, value },
        });
        assert.equal(res.status, 200, await res.clone().text());
        room = (await res.json()).room;
        const json = await (await request("/api/eggs/rooms/room_alice")).json();
        assert.deepEqual(json.room.modules, {});
        for (const jar of [undefined, bob, alice]) {
          const html = await (
            await request("/profile/room_alice", { jar })
          ).text();
          for (const hidden of [
            "SECRET_BIO_SENTINEL",
            "SECRET_NOTE_SENTINEL",
            "favorite_project_ids",
            "maker",
          ])
            assert.ok(!html.includes(hidden), hidden);
          assert.ok(html.includes("Room Alice"));
          assert.ok(!html.includes("Edit My Page")); // owner control is fetched privately after hydration
        }
        assert.equal(
          (await request("/api/eggs/profile", { jar: alice })).status,
          200,
        );
        assert.equal(
          (await request("/api/eggs/room", { jar: alice })).status,
          200,
        );
      },
    );
    await t.test(
      "works draft/preview/publish/archive, roles, redirects and real catalog",
      async () => {
        const content = {
          title: "HTTP original work",
          summary: "A site-owned graphic",
          description: "Real local publication test.",
          asset_id: "signal-grid",
          project_id: bootstrapProjects[0].id,
        };
        const command = {
          slug: "http-work",
          content,
          version: 0,
          action: "save",
        };
        assert.equal(
          (
            await request("/api/eggs/hub/works", {
              method: "POST",
              body: command,
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await request("/api/eggs/hub/works", {
              jar: alice,
              method: "POST",
              body: command,
            })
          ).status,
          403,
        );
        const create = await request("/api/eggs/hub/works", {
          jar: editor,
          method: "POST",
          body: command,
        });
        assert.equal(create.status, 200, await create.clone().text());
        work = (await create.json()).work;
        assert.equal((await request("/library/http-work")).status, 404);
        assert.equal(
          (await request("/eggs-admin/works/" + work.id + "/preview")).status,
          307,
        );
        assert.match(
          await (
            await request("/eggs-admin/works/" + work.id + "/preview", {
              jar: publisher,
            })
          ).text(),
          /Publish this saved work/u,
        );
        const publish = {
          id: work.id,
          slug: work.slug,
          version: 1,
          action: "publish",
        };
        assert.equal(
          (
            await request("/api/eggs/hub/works", {
              jar: editor,
              method: "POST",
              body: publish,
            })
          ).status,
          403,
        );
        const res = await request("/api/eggs/hub/works", {
          jar: publisher,
          method: "POST",
          body: publish,
        });
        assert.equal(res.status, 200);
        work = (await res.json()).work;
        for (const path of ["/", "/library", "/library/http-work"])
          assert.match(
            await (await request(path)).text(),
            /HTTP original work/u,
          );
        for (const p of bootstrapProjects.filter((p) =>
          ["game", "league"].includes(p.content.category),
        )) {
          const res = await request("/games/" + p.slug);
          assert.equal(res.status, 308);
          assert.equal(res.headers.get("location"), "/projects/" + p.slug);
        }
        assert.equal((await request("/games/reath-digest")).status, 404);
        assert.equal((await request("/games/nonexistent")).status, 404);
      },
    );
    await t.test(
      "saved rooms and editorial audit survive application restart",
      async () => {
        await stopConsumerApp(app);
        app = await startConsumerApp(fixture.env);
        assert.equal((await request("/library/http-work")).status, 200);
        const again = await login("alice");
        assert.equal(
          (await (await request("/api/eggs/room", { jar: again })).json()).room
            .revision,
          room.revision,
        );
        assert.ok(
          (
            await fixture.db.admin.query(
              "select count(*)::int n from eggs_rooms_private.work_audit",
            )
          ).rows[0].n >= 2,
        );
      },
    );
    await t.test(
      "archive removes public work; invalidated sessions cannot save",
      async () => {
        const res = await request("/api/eggs/hub/works", {
          jar: publisher,
          method: "POST",
          body: {
            id: work.id,
            slug: work.slug,
            version: work.version,
            action: "archive",
          },
        });
        assert.equal(res.status, 200);
        assert.equal((await request("/library/http-work")).status, 404);
        const replay = alice.clone();
        assert.equal(
          (
            await request("/api/eggs/auth/logout", {
              jar: alice,
              method: "POST",
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await request("/api/eggs/room", {
              jar: replay,
              method: "PUT",
              body: { revision: room.revision, value: editableRoom(room) },
            })
          ).status,
          401,
        );
      },
    );
    await t.test(
      "operational feature-off rollback keeps restrictive grants and stored privacy",
      async () => {
        const target = bootstrapProjects[0];
        const draft = (
          await fixture.db.admin.query(
            "select version from public.eggs_project_drafts where id=$1",
            [target.id],
          )
        ).rows[0];
        await hubActor(fixture.db, "publisher", (c) =>
          c.query("select public.save_eggs_project($1,$2,null,$3,'archive')", [
            target.id,
            target.slug,
            draft.version,
          ]),
        );
        await stopConsumerApp(app);
        app = await startConsumerApp({
          ...fixture.env,
          EGGS_HUB_ENABLED: "false",
        });
        assert.equal((await request("/projects/" + target.slug)).status, 404);
        assert.equal((await request("/games/" + target.slug)).status, 404);
        const home = await (await request("/")).text();
        // The shell's fixed description mentions Para independently of the catalog.
        // Assert the archived record/link is absent from the actual bulletin payload.
        assert.ok(!home.includes(target.id));
        assert.ok(!home.includes('href="/projects/' + target.slug + '"'));
        await stopConsumerApp(app);
        app = await startConsumerApp({
          ...fixture.env,
          EGGS_ROOMS_ENABLED: "false",
          EGGS_HUB_ENABLED: "false",
        });
        assert.equal((await request("/api/eggs/rooms/room_alice")).status, 503);
        const response = await request("/profile/room_alice");
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.ok(html.includes("Room Alice"));
        assert.ok(!html.includes("SECRET_BIO_SENTINEL"));
        assert.ok(!html.includes("SECRET_NOTE_SENTINEL"));
        const raw = await fixture.rest.request("/eggs_profiles?select=bio");
        assert.equal(raw.status, 401);
        assert.equal((await raw.json()).code, "42501");
        assert.equal(
          (await fixture.rest.request("/eggs_profile_expression?select=*"))
            .status,
          401,
        );
        const stored = await fixture.db.admin.query(
          "select revision,module_visibility from eggs_rooms_private.rooms",
        );
        assert.equal(Number(stored.rows[0].revision), room.revision);
        assert.ok(
          Object.values(stored.rows[0].module_visibility).every(
            (visible) => !visible,
          ),
        );
      },
    );
  },
);
