import test from "node:test";
import assert from "node:assert/strict";
import { hasPostgres } from "./helpers/localPostgres.mjs";
import { hasPostgrest } from "./helpers/localPostgrest.mjs";
import { communityHttpFixture } from "./helpers/communityHttpFixture.mjs";
import { hubIds } from "./helpers/hubDatabase.mjs";
import {
  startConsumerApp,
  stopConsumerApp,
  CookieJar,
} from "./helpers/consumerHttpFixture.mjs";
import { editableRoom } from "../src/lib/rooms/core.mjs";
import { REATH_PROJECT_ID } from "../src/lib/reath/catalog.mjs";

test(
  "community + Reath built HTTP: real PG17/PostgREST, synthetic Auth only",
  {
    skip: !hasPostgres || !hasPostgrest,
    timeout: 180000,
  },
  async (t) => {
    const fixture = await communityHttpFixture(t);
    let app = await startConsumerApp(fixture.env);
    t.after(() => stopConsumerApp(app));
    const request = async (
      path,
      { jar, method = "GET", body, origin = app.base, headers = {} } = {},
    ) => {
      const response = await fetch(app.base + path, {
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
      jar?.absorb(response);
      return response;
    };
    async function expectJson(response, status = 200) {
      const text = await response.text();
      assert.equal(response.status, status, text);
      return text ? JSON.parse(text) : null;
    }
    async function login(name) {
      const jar = new CookieJar();
      await expectJson(
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
    const jars = {};
    const profiles = {};
    const rooms = {};
    const write = (name, body, options = {}) =>
      request("/api/eggs/community/post", {
        jar: jars[name],
        method: "POST",
        body,
        ...options,
      });
    async function visibility(name, value) {
      const current = await expectJson(
        await request("/api/eggs/room", { jar: jars[name] }),
      );
      const edit = editableRoom(current.room);
      edit.profile.visibility = value;
      for (const key of Object.keys(edit.module_visibility))
        edit.module_visibility[key] = false;
      const saved = await expectJson(
        await request("/api/eggs/room", {
          jar: jars[name],
          method: "PUT",
          body: { revision: current.room.revision, value: edit },
        }),
      );
      rooms[name] = saved.room;
      return saved.room;
    }
    function assertPublicOnly(value) {
      const serialized =
        typeof value === "string" ? value : JSON.stringify(value);
      assert.doesNotMatch(
        serialized,
        /SECRET_COMMUNITY_BIO|SECRET_COMMUNITY_NOTE|auth_user_id|email_confirmed_at|liked_post_ids|user_metadata/,
      );
      for (const id of Object.values(hubIds))
        assert.ok(
          !serialized.includes(id),
          "Auth ID absent from public output",
        );
      for (const email of ["alice", "bob", "editor", "publisher"].map(
        (name) => name + "@fixture.invalid",
      ))
        assert.ok(
          !serialized.includes(email),
          "Email absent from public output",
        );
    }
    let post, reply, bobPost;

    await t.test(
      "anonymous public reads and live-owner onboarding do not grant publishing by metadata",
      async () => {
        assert.deepEqual(
          await expectJson(await request("/api/eggs/community")),
          { posts: [], next_cursor: null },
        );
        assert.deepEqual(await expectJson(await request("/api/eggs/people")), {
          people: [],
          next_cursor: null,
        });
        assert.equal(
          (await request("/api/eggs/community/session")).status,
          401,
        );
        assert.equal(
          (
            await write(undefined, {
              action: "create",
              body: "No anonymous posting",
            })
          ).status,
          401,
        );
        for (const name of ["alice", "bob", "editor", "publisher"]) {
          jars[name] = await login(name);
          const created = await expectJson(
            await request("/api/eggs/profile", {
              jar: jars[name],
              method: "POST",
              body: {
                handle: `community_${name}`,
                display_name: `Community ${name}`,
                bio: "SECRET_COMMUNITY_BIO_" + name,
              },
            }),
            201,
          );
          profiles[name] = created.profile;
          assert.equal(
            (
              await write(name, {
                action: "create",
                body: "Private profiles cannot post",
              })
            ).status,
            403,
          );
          const session = await expectJson(
            await request("/api/eggs/community/session", { jar: jars[name] }),
          );
          assert.equal(session.session.profile.id, profiles[name].id);
          assert.equal(session.session.publisher, name === "publisher");
        }
        for (const name of ["alice", "editor", "publisher"])
          await visibility(name, "public");
        const people = await expectJson(await request("/api/eggs/people"));
        assert.equal(people.people.length, 3);
        assert.ok(
          !people.people.some((person) => person.handle === "community_bob"),
        );
        assertPublicOnly(people);
      },
    );

    await t.test(
      "write API denies forged ownership, CSRF, unsafe fields and unrelated users",
      async () => {
        assert.equal(
          (
            await write(
              "alice",
              { action: "create", body: "CSRF" },
              { origin: "https://evil.invalid" },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await write("alice", {
              action: "create",
              body: "Forged",
              profile_id: profiles.bob.id,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await write("alice", {
              action: "create",
              body: "Forged",
              owner: hubIds.publisher,
            })
          ).status,
          400,
        );
        assert.equal(
          (await write("alice", { action: "create", body: "a".repeat(1001) }))
            .status,
          400,
        );
        assert.equal(
          (await write("alice", { action: "create", body: " " })).status,
          400,
        );
        assert.equal(
          (await write("alice", { action: "publish", body: "Wrong action" }))
            .status,
          400,
        );
        post = (
          await expectJson(
            await write("alice", {
              action: "create",
              body: "A public conversation about EGGS.",
            }),
          )
        ).post;
        assert.equal(post.author.id, profiles.alice.id);
        assert.equal(post.revision, 1);
        assertPublicOnly(post);
        for (const name of ["bob", "editor", "publisher"]) {
          assert.equal(
            (
              await write(name, {
                action: "edit",
                id: post.id,
                revision: post.revision,
                body: "Not my post",
              })
            ).status,
            403,
          );
          assert.equal(
            (await write(name, { action: "delete", id: post.id })).status,
            403,
          );
        }
      },
    );

    await t.test(
      "concurrent same-revision edits return one409 and preserve the winning content",
      async () => {
        const responses = await Promise.all([
          write("alice", {
            action: "edit",
            id: post.id,
            revision: post.revision,
            body: "First local tab",
          }),
          write(
            "alice",
            {
              action: "edit",
              id: post.id,
              revision: post.revision,
              body: "Second local tab",
            },
            { jar: jars.alice.clone() },
          ),
        ]);
        assert.deepEqual(
          responses.map((response) => response.status).sort(),
          [200, 409],
        );
        post = (
          await expectJson(
            responses.find((response) => response.status === 200),
          )
        ).post;
        assert.equal(post.revision, 2);
        const stale = await write("alice", {
          action: "edit",
          id: post.id,
          revision: 1,
          body: "Stale overwrite",
        });
        assert.equal(stale.status, 409);
        const thread = await expectJson(
          await request(`/api/eggs/community/posts/${post.id}`),
        );
        assert.equal(thread.post.body, post.body);
        assert.equal(thread.post.revision, 2);
      },
    );

    await t.test(
      "public comments, idempotent likes and owner deletion are backed by real PostgREST",
      async () => {
        await visibility("bob", "public");
        reply = (
          await expectJson(
            await write("bob", {
              action: "create",
              parent: post.id,
              body: "A reply from Bob.",
            }),
          )
        ).post;
        assert.equal(
          (
            await write("alice", {
              action: "create",
              parent: reply.id,
              body: "Nested reply is not supported",
            })
          ).status,
          404,
        );
        for (let i = 0; i < 2; i++) {
          const result = await expectJson(
            await write("bob", { action: "like", id: post.id }),
          );
          assert.equal(result.like_count, 1);
        }
        const mine = await expectJson(
          await request("/api/eggs/community/session", { jar: jars.bob }),
        );
        assert.deepEqual(mine.session.liked_post_ids, [post.id]);
        const thread = await expectJson(
          await request(`/api/eggs/community/posts/${post.id}`),
        );
        assert.equal(thread.replies.length, 1);
        assert.equal(thread.post.reply_count, 1);
        assert.equal(thread.post.like_count, 1);
        assertPublicOnly(thread);
        const unliked = await expectJson(
          await write("bob", { action: "unlike", id: post.id }),
        );
        assert.equal(unliked.like_count, 0);
        assert.equal(
          (await write("alice", { action: "delete", id: reply.id })).status,
          403,
        );
        assert.deepEqual(
          await expectJson(
            await write("bob", { action: "delete", id: reply.id }),
          ),
          { deleted: true },
        );
        assert.equal(
          (
            await expectJson(
              await request(`/api/eggs/community/posts/${post.id}`),
            )
          ).replies.length,
          0,
        );
        reply = (
          await expectJson(
            await write("bob", {
              action: "create",
              parent: post.id,
              body: "PRIVATE_ON_VISIBILITY_CHANGE_BOB_REPLY",
            }),
          )
        ).post;
        bobPost = (
          await expectJson(
            await write("bob", {
              action: "create",
              body: "PRIVATE_ON_VISIBILITY_CHANGE_BOB_POST",
            }),
          )
        ).post;
        await expectJson(
          await write("alice", {
            action: "create",
            parent: bobPost.id,
            body: "PRIVATE_WITH_PARENT_ALICE_REPLY",
          }),
        );
      },
    );

    await t.test(
      "keyset pagination, author search and people search return only bounded public DTOs",
      async () => {
        const extra = (
          await expectJson(
            await write("alice", {
              action: "create",
              body: "PLAIN_TEXT_MARKUP_SENTINEL <script>globalThis.unsafe=1</script>",
            }),
          )
        ).post;
        const first = await expectJson(
          await request("/api/eggs/community?limit=1"),
        );
        assert.equal(first.posts.length, 1);
        assert.ok(first.next_cursor?.before);
        const cursor = new URLSearchParams({
          ...first.next_cursor,
          limit: "1",
        });
        const next = await expectJson(
          await request("/api/eggs/community?" + cursor),
        );
        assert.equal(next.posts.length, 1);
        assert.notEqual(next.posts[0].id, first.posts[0].id);
        const byAuthor = await expectJson(
          await request("/api/eggs/community?author=community_bob"),
        );
        assert.deepEqual(
          byAuthor.posts.map((item) => item.id),
          [bobPost.id],
        );
        const people = await expectJson(
          await request("/api/eggs/people?q=COMMUNITY_ALICE&limit=1"),
        );
        assert.deepEqual(
          people.people.map((person) => person.handle),
          ["community_alice"],
        );
        assertPublicOnly(people);
        const html = await (await request("/community")).text();
        assert.match(html, /PLAIN_TEXT_MARKUP_SENTINEL/);
        assert.doesNotMatch(html, /<script>globalThis\.unsafe=1<\/script>/);
        for (const path of [
          "/api/eggs/community?limit=999",
          "/api/eggs/community?before_id=" + post.id,
          "/api/eggs/community?owner=forged",
          "/api/eggs/people?limit=999",
          "/api/eggs/people?after=../private",
        ])
          assert.equal((await request(path)).status, 400, path);
        assert.ok(extra.id);
      },
    );

    await t.test(
      "private profiles hide their posts, replies, counts and people from API, SSR and Next payload",
      async () => {
        await visibility("bob", "private");
        for (const jar of [undefined, jars.alice, jars.bob, jars.publisher]) {
          const feed = await expectJson(
            await request("/api/eggs/community", { jar }),
          );
          assert.ok(!feed.posts.some((item) => item.id === bobPost.id));
          assert.doesNotMatch(
            JSON.stringify(feed),
            /PRIVATE_ON_VISIBILITY_CHANGE|PRIVATE_WITH_PARENT/,
          );
          assert.equal(
            (await request(`/api/eggs/community/posts/${bobPost.id}`, { jar }))
              .status,
            404,
          );
          const thread = await expectJson(
            await request(`/api/eggs/community/posts/${post.id}`, { jar }),
          );
          assert.equal(thread.replies.length, 0);
          assert.equal(thread.post.reply_count, 0);
          const people = await expectJson(
            await request("/api/eggs/people", { jar }),
          );
          assert.ok(
            !people.people.some((person) => person.id === profiles.bob.id),
          );
          assertPublicOnly(feed);
          assertPublicOnly(people);
          for (const path of [
            "/community",
            "/people",
            "/profile/community_alice",
          ]) {
            const response = await request(path, { jar });
            assert.equal(response.status, 200, path);
            const html = await response.text();
            assertPublicOnly(html);
            assert.doesNotMatch(
              html,
              /PRIVATE_ON_VISIBILITY_CHANGE|PRIVATE_WITH_PARENT/,
            );
          }
          assert.equal(
            (await request("/profile/community_bob", { jar })).status,
            404,
          );
        }
        const raw = await fixture.rest.request("/eggs_profiles?select=bio");
        assert.equal(raw.status, 401);
        const privateSchema = await fixture.rest.request("/posts?select=*", {
          headers: { "Accept-Profile": "eggs_community_private" },
        });
        assert.notEqual(privateSchema.status, 200);
        assert.equal(
          (await write("bob", { action: "create", body: "Private again" }))
            .status,
          403,
        );
      },
    );

    await t.test(
      "only publisher membership moderates, with body-free durable audit",
      async () => {
        const reason = "Synthetic moderation fixture reason";
        assert.equal(
          (await write("editor", { action: "hide", id: post.id, body: reason }))
            .status,
          403,
        );
        assert.equal(
          (await write("alice", { action: "hide", id: post.id, body: reason }))
            .status,
          403,
        );
        await expectJson(
          await write("publisher", {
            action: "hide",
            id: post.id,
            body: reason,
          }),
        );
        assert.equal(
          (await request(`/api/eggs/community/posts/${post.id}`)).status,
          404,
        );
        const hiddenFeed = await expectJson(
          await request("/api/eggs/community"),
        );
        assert.ok(!hiddenFeed.posts.some((item) => item.id === post.id));
        await expectJson(
          await write("publisher", {
            action: "restore",
            id: post.id,
            body: "Synthetic review complete",
          }),
        );
        assert.equal(
          (await request(`/api/eggs/community/posts/${post.id}`)).status,
          200,
        );
        const rows = (
          await fixture.db.admin.query(
            "select action,reason from eggs_community_private.moderation_audit where post_id=$1 order by id",
            [post.id],
          )
        ).rows;
        assert.deepEqual(
          rows.map((row) => row.action),
          ["hide", "restore"],
        );
        assert.equal(rows[0].reason, reason);
        const columns = (
          await fixture.db.admin.query(
            "select column_name from information_schema.columns where table_schema='eggs_community_private' and table_name='moderation_audit'",
          )
        ).rows.map((row) => row.column_name);
        assert.ok(!columns.includes("body"));
        assert.ok(!columns.includes("email"));
      },
    );

    await t.test(
      "Reath reader receives explicitly published formats; drafts/private sources never appear",
      async () => {
        const base = {
          title: "REATH_FORMAT_HTTP_RELEASE",
          summary: "A real local reader test.",
          description: "Original deterministic fixture, not real journalism.",
          asset_id: "signal-grid",
          project_id: REATH_PROJECT_ID,
        };
        const created = await expectJson(
          await request("/api/eggs/hub/works", {
            jar: jars.editor,
            method: "POST",
            body: {
              action: "save",
              version: 0,
              slug: "reath-http-funnies",
              content: { ...base, format: "funnies" },
            },
          }),
        );
        let work = created.work;
        assert.equal(
          (await request("/library/reath-http-funnies")).status,
          404,
        );
        let reader = await (await request("/reath-digest")).text();
        assert.ok(!reader.includes(base.title));
        assert.doesNotMatch(
          reader,
          /https:\/\/reath-digest\.netlify\.app|Open Reath Wire/,
        );
        assert.equal((await request("/projects/reath-digest")).status, 308);
        assert.equal(
          (await request("/projects/reath-digest")).headers.get("location"),
          "/reath-digest",
        );
        const publishing = {
          action: "publish",
          id: work.id,
          slug: work.slug,
          version: work.version,
        };
        assert.equal(
          (
            await request("/api/eggs/hub/works", {
              jar: jars.editor,
              method: "POST",
              body: publishing,
            })
          ).status,
          403,
        );
        work = (
          await expectJson(
            await request("/api/eggs/hub/works", {
              jar: jars.publisher,
              method: "POST",
              body: publishing,
            }),
          )
        ).work;
        reader = await (await request("/reath-digest")).text();
        assert.ok(reader.includes(base.title));
        assert.match(reader, /Fiction within Reath/);
        assert.match(reader, /href="\/library\/reath-http-funnies"/);
        assert.doesNotMatch(
          reader,
          /drive\.google\.com|PRIVATE-|editorial_notes/,
        );
        const detail = await (
          await request("/library/reath-http-funnies")
        ).text();
        assert.match(detail, /Source &amp; permission/);
        assert.match(detail, /site-public/);
        const legacy = await expectJson(
          await request("/api/eggs/hub/works", {
            jar: jars.editor,
            method: "POST",
            body: {
              action: "save",
              version: 0,
              slug: "reath-http-legacy",
              content: { ...base, title: "LEGACY_FIVE_KEY_REATH_RELEASE" },
            },
          }),
        );
        await expectJson(
          await request("/api/eggs/hub/works", {
            jar: jars.publisher,
            method: "POST",
            body: {
              action: "publish",
              id: legacy.work.id,
              slug: legacy.work.slug,
              version: legacy.work.version,
            },
          }),
        );
        assert.match(
          await (await request("/reath-digest")).text(),
          /LEGACY_FIVE_KEY_REATH_RELEASE/,
        );
        for (const media_url of [
          "https://drive.google.com/private-file",
          "javascript:alert(1)",
          "https://www.youtube.com.evil.invalid/watch?v=dQw4w9WgXcQ",
        ]) {
          assert.equal(
            (
              await request("/api/eggs/hub/works", {
                jar: jars.editor,
                method: "POST",
                body: {
                  action: "save",
                  version: 0,
                  slug: "unsafe-video",
                  content: { ...base, format: "video", media_url },
                },
              })
            ).status,
            400,
          );
        }
        for (const content of [
          { ...base, format: "video" },
          { ...base, format: "video", media_url: "" },
        ]) {
          assert.equal(
            (
              await request("/api/eggs/hub/works", {
                jar: jars.editor,
                method: "POST",
                body: {
                  action: "save",
                  version: 0,
                  slug: "incomplete-video",
                  content,
                },
              })
            ).status,
            400,
          );
        }
        const video = await expectJson(
          await request("/api/eggs/hub/works", {
            jar: jars.editor,
            method: "POST",
            body: {
              action: "save",
              version: 0,
              slug: "reath-http-video",
              content: {
                ...base,
                title: "PUBLIC_VIDEO_FIXTURE",
                format: "video",
                media_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
              },
            },
          }),
        );
        await expectJson(
          await request("/api/eggs/hub/works", {
            jar: jars.publisher,
            method: "POST",
            body: {
              action: "publish",
              id: video.work.id,
              slug: video.work.slug,
              version: video.work.version,
            },
          }),
        );
        assert.match(
          await (await request("/reath-digest")).text(),
          /PUBLIC_VIDEO_FIXTURE/,
        );
        await expectJson(
          await request("/api/eggs/hub/works", {
            jar: jars.publisher,
            method: "POST",
            body: {
              action: "archive",
              id: work.id,
              slug: work.slug,
              version: work.version,
            },
          }),
        );
        assert.equal(
          (await request("/library/reath-http-funnies")).status,
          404,
        );
        assert.ok(
          !(await (await request("/reath-digest")).text()).includes(base.title),
        );
      },
    );

    await t.test(
      "database state survives app restart; logout/replayed cookie loses write authority",
      async () => {
        await stopConsumerApp(app);
        app = await startConsumerApp(fixture.env);
        assert.equal(
          (await request(`/api/eggs/community/posts/${post.id}`)).status,
          200,
        );
        const replay = jars.alice.clone();
        await expectJson(
          await request("/api/eggs/auth/logout", {
            jar: jars.alice,
            method: "POST",
          }),
        );
        assert.equal(
          (await request("/api/eggs/community/session", { jar: replay }))
            .status,
          401,
        );
        assert.equal(
          (
            await request("/api/eggs/community/post", {
              jar: replay,
              method: "POST",
              body: { action: "create", body: "Revoked cookie" },
            })
          ).status,
          401,
        );
        const raw = await fixture.rest.request("/rpc/write_eggs_community", {
          method: "POST",
          body: { p_action: "create", p_body: "Anonymous direct RPC" },
        });
        assert.equal(raw.status, 401);
        assert.equal((await raw.json()).code, "42501");
        // This test fixture never routes SQL outside its disposable loopback cluster.
        assert.match(fixture.rest.url, /^http:\/\/127\.0\.0\.1:/);
        assert.match(fixture.url, /^http:\/\/127\.0\.0\.1:/);
      },
    );
  },
);
