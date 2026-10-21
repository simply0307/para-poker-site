import test from "node:test";
import assert from "node:assert/strict";
import { hasPostgres } from "./helpers/localPostgres.mjs";
import { hasPostgrest } from "./helpers/localPostgrest.mjs";
import { loreHttpFixture } from "./helpers/loreHttpFixture.mjs";
import {
  startConsumerApp,
  stopConsumerApp,
  CookieJar,
} from "./helpers/consumerHttpFixture.mjs";

test(
  "Lore HTTP: built Next + actual PG17/PostgREST, synthetic Auth only",
  { skip: !hasPostgres || !hasPostgrest, timeout: 180000 },
  async (t) => {
    const fixture = await loreHttpFixture(t);
    let app = await startConsumerApp(fixture.env);
    t.after(() => stopConsumerApp(app));
    async function request(
      path,
      { jar, method = "GET", body, origin = app.base } = {},
    ) {
      const response = await fetch(app.base + path, {
        method,
        redirect: "manual",
        headers: {
          Origin: origin,
          ...(jar ? { Cookie: jar.header() } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      jar?.absorb(response);
      return response;
    }
    async function json(response, status = 200) {
      const text = await response.text();
      assert.equal(response.status, status, text);
      return text ? JSON.parse(text) : null;
    }
    async function login(name) {
      const jar = new CookieJar();
      await json(
        await request("/api/eggs/auth", {
          jar,
          method: "POST",
          body: {
            action: "login",
            email: name + "@fixture.invalid",
            password: "fixture-password",
          },
        }),
      );
      return jar;
    }
    const editor = await login("editor"),
      publisher = await login("publisher"),
      alice = await login("alice");
    const value = (overrides) => ({
      title: "Synthetic world",
      summary: "A local test of lore routes.",
      body: "Source-backed local fixture, not a real EGGS release.",
      continuity_note: "Synthetic test continuity; no canon decision.",
      attribution: "Local verification fixture",
      permission: "site-public",
      source_reviewed: true,
      public_source: "https://example.com/public",
      internal_source: "PRIVATE_LORE_HTTP_SOURCE",
      project_id: null,
      ...overrides,
    });
    const command = (entry, action, content) => ({
      id: entry?.id || null,
      world: "http-world",
      kind: entry?.kind || "world",
      slug: entry?.slug || "http-world",
      version: entry?.version || 0,
      action,
      ...(content ? { content } : {}),
    });
    const write = (jar, body, origin) =>
      request("/api/eggs/hub/lore", {
        jar,
        method: "POST",
        body,
        ...(origin ? { origin } : {}),
      });
    let world, person;
    await t.test(
      "public DTO is empty; anonymous/unrelated/CSRF mutations fail before writing",
      async () => {
        assert.deepEqual(
          (await json(await request("/api/eggs/lore"))).entries,
          [],
        );
        await json(await write(null, command(null, "save", value())), 401);
        await json(await write(alice, command(null, "save", value())), 403);
        await json(
          await write(
            editor,
            command(null, "save", value()),
            "https://wrong.invalid",
          ),
          403,
        );
        await json(await request("/api/eggs/lore?kind=secret"), 400);
      },
    );
    await t.test(
      "editor can save a long private draft and preview; cannot publish",
      async () => {
        world = (
          await json(
            await write(
              editor,
              command(
                null,
                "save",
                value({ body: "Long dossier paragraph. ".repeat(700) }),
              ),
            ),
          )
        ).entry;
        assert.equal(world.version, 1);
        const publicHtml = await (await request("/lore")).text();
        assert.ok(!publicHtml.includes("Long dossier paragraph"));
        assert.ok(!publicHtml.includes("PRIVATE_LORE_HTTP_SOURCE"));
        const denied = await request(
          "/eggs-admin/lore/" + world.id + "/preview",
        );
        assert.equal(denied.status, 307);
        const preview = await (
          await request("/eggs-admin/lore/" + world.id + "/preview", {
            jar: editor,
          })
        ).text();
        assert.ok(preview.includes("Long dossier paragraph"));
        assert.ok(!preview.includes("PRIVATE_LORE_HTTP_SOURCE"));
        await json(await write(editor, command(world, "publish")), 403);
        assert.deepEqual(
          (await json(await request("/api/eggs/lore"))).entries,
          [],
        );
      },
    );
    await t.test(
      "publisher releases saved world and all five scoped categories; private source omitted everywhere",
      async () => {
        world = (await json(await write(publisher, command(world, "publish"))))
          .entry;
        for (const kind of [
          "factions",
          "people",
          "events",
          "terms",
          "places",
        ]) {
          let entry = (
            await json(
              await write(editor, {
                ...command(
                  null,
                  "save",
                  value({
                    title: "Fixture " + kind,
                    body: "Visible dossier text for " + kind + ".",
                  }),
                ),
                kind,
                slug: "fixture-" + kind,
              }),
            )
          ).entry;
          entry = (
            await json(await write(publisher, command(entry, "publish")))
          ).entry;
          if (kind === "people") person = entry;
          assert.equal((await request(`/lore/http-world/${kind}`)).status, 200);
          const page = await request(
            `/lore/http-world/${kind}/fixture-${kind}`,
          );
          assert.equal(page.status, 200);
          const html = await page.text();
          assert.ok(html.includes("Visible dossier text"));
          assert.doesNotMatch(
            html,
            /PRIVATE_LORE_HTTP_SOURCE|internal_source|source_reviewed/,
          );
        }
        const output = await json(
          await request("/api/eggs/lore?world=http-world"),
        );
        assert.equal(output.entries.length, 6);
        assert.doesNotMatch(
          JSON.stringify(output),
          /PRIVATE_LORE_HTTP_SOURCE|internal_source|source_reviewed|site-public/,
        );
        assert.equal((await request("/lore/http-world")).status, 200);
      },
    );
    await t.test(
      "concurrent same-revision API saves conflict without partial content overwrite",
      async () => {
        const responses = await Promise.all(
          ["First candidate", "Second candidate"].map((title) =>
            write(editor, command(person, "save", value({ title }))),
          ),
        );
        assert.deepEqual(
          responses.map((response) => response.status).sort(),
          [200, 409],
        );
        const winner = (
          await json(responses.find((response) => response.status === 200))
        ).entry;
        assert.equal(winner.version, person.version + 1);
        const stored = (
          await fixture.db.admin.query(
            "select content,version from public.eggs_lore_drafts where id=$1",
            [person.id],
          )
        ).rows[0];
        assert.equal(stored.content.title, winner.content.title);
        assert.equal(stored.version, winner.version);
        // Editing a draft does not silently replace the existing public snapshot.
        assert.equal(
          (await json(await request("/api/eggs/lore?kind=people"))).entries[0]
            .content.title,
          "Fixture people",
        );
      },
    );
    await t.test(
      "archive world removes nested pages/API/direct REST while retaining drafts and audit",
      async () => {
        world = (await json(await write(publisher, command(world, "archive"))))
          .entry;
        assert.deepEqual(
          (await json(await request("/api/eggs/lore"))).entries,
          [],
        );
        assert.equal((await request("/lore/http-world")).status, 404);
        assert.equal(
          (await request("/lore/http-world/people/fixture-people")).status,
          404,
        );
        const raw = await fixture.rest.request("/eggs_lore?select=*");
        assert.deepEqual(await json(raw), []);
        assert.equal(
          (
            await fixture.db.admin.query(
              "select count(*)::int n from public.eggs_lore_drafts",
            )
          ).rows[0].n,
          6,
        );
        assert.ok(
          (
            await fixture.db.admin.query(
              "select count(*)::int n from eggs_lore_private.audit",
            )
          ).rows[0].n > 6,
        );
      },
    );
    await t.test(
      "public lore works independently of consumer rollout; disabled lore remains unavailable",
      async () => {
        world = (await json(await write(publisher, command(world, "publish"))))
          .entry;
        await stopConsumerApp(app);
        app = await startConsumerApp({
          ...fixture.env,
          EGGS_CONSUMER_ENABLED: "false",
        });
        assert.equal(
          (await json(await request("/api/eggs/lore"))).entries.length,
          6,
        );
        assert.equal(
          (await request("/lore/http-world/places/fixture-places")).status,
          200,
        );
        await stopConsumerApp(app);
        app = await startConsumerApp({
          ...fixture.env,
          EGGS_LORE_ENABLED: "false",
        });
        assert.equal((await request("/lore")).status, 404);
        await json(await request("/api/eggs/lore"), 503);
        await json(await write(publisher, command(world, "archive")), 503);
      },
    );
  },
);
