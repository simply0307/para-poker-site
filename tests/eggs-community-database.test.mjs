import test from "node:test";
import assert from "node:assert/strict";
import { hasPostgres } from "./helpers/localPostgres.mjs";
import { roomsDatabase } from "./helpers/roomsDatabase.mjs";
import { communityMigration } from "./helpers/communityDatabase.mjs";
import {
  hubActor,
  hubIds,
  beginHubActor,
  rejected,
} from "./helpers/hubDatabase.mjs";
import { hasPostgrest, localPostgrest } from "./helpers/localPostgrest.mjs";
const rpc = (db, user, sql, args = [], role = "authenticated") =>
  hubActor(
    db,
    user,
    (c) => c.query("select public." + sql + " result", args),
    role,
  ).then((r) => r.rows[0].result);
const write = (
  db,
  user,
  action,
  id = null,
  body = null,
  parent = null,
  revision = null,
) =>
  rpc(db, user, "write_eggs_community($1,$2,$3,$4,$5)", [
    action,
    id,
    body,
    parent,
    revision,
  ]);
const feed = (db) => rpc(db, "alice", "get_eggs_community()", [], "anon");
const thread = (db, id) =>
  rpc(db, "alice", "get_eggs_community_post($1)", [id], "anon");
const work = {
  title: "Reath publication",
  summary: "A source-owned publication",
  description: "Original approved geometric work.",
  asset_id: "signal-grid",
  project_id: null,
};
test(
  "Community: native PG17, narrow grants, public projections and actual PostgREST",
  { skip: !hasPostgres, timeout: 180000 },
  async (t) => {
    const db = await roomsDatabase(t);
    const legacy = async () => {
      const tables = (
        await db.admin.query(
          "select c.relname,c.relacl::text,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname !~ '^eggs_' order by c.relname",
        )
      ).rows;
      for (const table of tables)
        table.data = (
          await db.admin.query(
            "select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') data from public.\"" +
              table.relname.replaceAll('"', '""') +
              '" t',
          )
        ).rows[0].data;
      return tables;
    };
    await db.admin.query(
      "insert into public.players(id,display_name,slug) values($1,'Preserved Poker identity','preserved-poker')",
      [hubIds.operator],
    );
    const before = await legacy();
    await t.test(
      "migration failure and explicit transaction rollback restore prior schema and validator",
      async () => {
        const validator = (
          await db.admin.query(
            "select pg_get_functiondef('eggs_rooms_private.valid_work(jsonb)'::regprocedure) source",
          )
        ).rows;
        await assert.rejects(
          () =>
            db.admin.query(
              communityMigration.replace(/commit;\s*$/u, "select 1/0; commit;"),
            ),
          (e) => e.code === "22012",
        );
        await db.admin.query("rollback");
        assert.equal(
          (
            await db.admin.query(
              "select to_regnamespace('eggs_community_private') n",
            )
          ).rows[0].n,
          null,
        );
        assert.deepEqual(
          (
            await db.admin.query(
              "select pg_get_functiondef('eggs_rooms_private.valid_work(jsonb)'::regprocedure) source",
            )
          ).rows,
          validator,
        );
        assert.deepEqual(await legacy(), before);
        await db.admin.query(
          communityMigration.replace(/commit;\s*$/u, "rollback;"),
        );
        assert.equal(
          (
            await db.admin.query(
              "select to_regnamespace('eggs_community_private') n",
            )
          ).rows[0].n,
          null,
        );
      },
    );
    await db.admin.query(communityMigration);
    const profiles = {};
    for (const user of ["alice", "bob", "editor"]) {
      profiles[user] = (
        await hubActor(db, user, (c) =>
          c.query(
            "insert into public.eggs_profiles(handle,display_name,bio,visibility) values($1,$2,$3,'public') returning id",
            ["community_" + user, user, "PRIVATE_BIO_" + user],
          ),
        )
      ).rows[0].id;
    }
    let post, reply, other;
    await t.test(
      "private storage is forced RLS with no table access, no PUBLIC execution or exposed definer",
      async () => {
        const tables = (
          await db.admin.query(
            "select c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='eggs_community_private' and c.relkind='r'",
          )
        ).rows;
        assert.equal(tables.length, 4);
        assert.ok(
          tables.every((x) => x.relrowsecurity && x.relforcerowsecurity),
        );
        for (const role of ["anon", "authenticated"]) {
          for (const table of [
            "posts",
            "likes",
            "rate_events",
            "moderation_audit",
          ])
            await rejected(
              hubActor(
                db,
                "alice",
                (c) => c.query("select * from eggs_community_private." + table),
                role,
              ),
              "42501",
            );
          await rejected(
            hubActor(
              db,
              "alice",
              (c) =>
                c.query("select eggs_community_private.person($1)", [
                  profiles.alice,
                ]),
              role,
            ),
            "42501",
          );
        }
        assert.equal(
          (
            await db.admin.query(
              "select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('get_eggs_community','get_eggs_community_post','get_my_eggs_community','write_eggs_community','list_eggs_people') and p.prosecdef",
            )
          ).rows[0].n,
          0,
        );
        const grants = (
          await db.admin.query(
            "select p.proname,p.proconfig,exists(select 1 from aclexplode(p.proacl) x where x.grantee=0 and x.privilege_type='EXECUTE') public_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eggs_community_private'",
          )
        ).rows;
        assert.ok(
          grants.every(
            (x) => !x.public_execute && x.proconfig.includes('search_path=""'),
          ),
        );
      },
    );
    await t.test(
      "live owner creates a post and one-level reply with only public basic identity",
      async () => {
        post = (
          await write(
            db,
            "alice",
            "create",
            null,
            "First <script> is plain text",
          )
        ).post;
        other = (await write(db, "bob", "create", null, "Bob's note")).post;
        reply = (await write(db, "bob", "create", null, "A reply", post.id))
          .post;
        assert.equal(post.author.id, profiles.alice);
        assert.deepEqual(Object.keys(post.author).sort(), [
          "avatar",
          "display_name",
          "handle",
          "id",
          "theme",
        ]);
        assert.equal((await thread(db, post.id)).replies[0].id, reply.id);
        assert.equal((await thread(db, post.id)).post.reply_count, 1);
        assert.equal(await thread(db, reply.id), null);
        assert.equal((await feed(db)).posts.length, 2);
        assert.ok(!JSON.stringify(await feed(db)).includes("PRIVATE_BIO"));
        assert.ok(!JSON.stringify(await feed(db)).includes(hubIds.alice));
        await rejected(
          write(db, "alice", "create", null, "Nested reply", reply.id),
          "PT404",
        );
        await rejected(
          write(db, "alice", "create", null, "Fabricated", hubIds.operator),
          "PT404",
        );
        await rejected(write(db, "alice", "create", null, " "), "22023");
        await rejected(
          write(db, "alice", "create", null, "x".repeat(1001)),
          "22023",
        );
        await rejected(
          write(db, "alice", "create", post.id, "Injected id"),
          "22023",
        );
        await rejected(
          write(db, "alice", "delete", post.id, "Ignored argument"),
          "22023",
        );
        await rejected(
          write(db, "operator", "create", null, "No profile"),
          "42501",
        );
        await rejected(
          rpc(
            db,
            "alice",
            "write_eggs_community('create',null,'Anonymous')",
            [],
            "anon",
          ),
          "42501",
        );
      },
    );
    await t.test(
      "owner edit revisions serialize two real connections and unrelated users cannot edit/delete",
      async () => {
        await rejected(
          write(db, "bob", "edit", post.id, "Cannot overwrite", null, 1),
          "42501",
        );
        await rejected(write(db, "bob", "delete", post.id), "42501");
        const a = await db.connect(),
          b = await db.connect();
        try {
          await beginHubActor(a, "alice");
          await beginHubActor(b, "alice");
          await a.query(
            "select public.write_eggs_community('edit',$1,'Winning revision',null,1)",
            [post.id],
          );
          const pid = (await b.query("select pg_backend_pid() pid")).rows[0]
            .pid;
          const pending = b
            .query(
              "select public.write_eggs_community('edit',$1,'Stale revision',null,1)",
              [post.id],
            )
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
        post = (await thread(db, post.id)).post;
        assert.equal(post.revision, 2);
        assert.equal(post.body, "Winning revision");
        await rejected(
          write(db, "alice", "edit", post.id, "Missing revision"),
          "22023",
        );
      },
    );
    await t.test(
      "likes are explicit, idempotent under concurrency and bounded to live public targets",
      async () => {
        await Promise.all([
          write(db, "bob", "like", post.id),
          write(db, "bob", "like", post.id),
        ]);
        assert.equal((await thread(db, post.id)).post.like_count, 1);
        assert.equal(
          (await rpc(db, "bob", "get_my_eggs_community()")).liked_post_ids[0],
          post.id,
        );
        await Promise.all([
          write(db, "bob", "unlike", post.id),
          write(db, "bob", "unlike", post.id),
        ]);
        assert.equal((await thread(db, post.id)).post.like_count, 0);
        await write(db, "bob", "like", post.id);
        await rejected(write(db, "bob", "like", hubIds.operator), "PT404");
        await rejected(
          write(db, "bob", "like", post.id, "Ignored body"),
          "22023",
        );
      },
    );
    await t.test(
      "private or unconfirmed authors disappear from feed, people, replies and like counts",
      async () => {
        await db.admin.query(
          "update public.eggs_profiles set visibility='private' where id=$1",
          [profiles.bob],
        );
        let data = await thread(db, post.id);
        assert.equal(data.post.like_count, 0);
        assert.equal(data.post.reply_count, 0);
        assert.deepEqual(data.replies, []);
        assert.deepEqual(
          (await feed(db)).posts.map((x) => x.id),
          [post.id],
        );
        assert.equal(await thread(db, other.id), null);
        assert.ok(
          !(
            await rpc(db, "alice", "list_eggs_people()", [], "anon")
          ).people.some((x) => x.id === profiles.bob),
        );
        await rejected(
          write(db, "bob", "create", null, "Private post"),
          "42501",
        );
        await rejected(write(db, "bob", "like", post.id), "PT404");
        await db.admin.query(
          "update public.eggs_profiles set visibility='public' where id=$1",
          [profiles.bob],
        );
        await db.admin.query(
          "update auth.users set email_confirmed_at=null where id=$1",
          [hubIds.bob],
        );
        assert.equal((await thread(db, post.id)).post.reply_count, 0);
        await rejected(
          write(db, "bob", "create", null, "Unconfirmed post"),
          "42501",
        );
        await db.admin.query(
          "update auth.users set email_confirmed_at=now() where id=$1",
          [hubIds.bob],
        );
        await db.admin.query(
          "update public.eggs_profiles set visibility='private' where id=$1",
          [profiles.alice],
        );
        assert.equal(await thread(db, post.id), null);
        await rejected(
          write(db, "bob", "create", null, "Hidden parent", post.id),
          "PT404",
        );
        assert.equal(
          (await rpc(db, "alice", "get_my_eggs_community()")).profile
            .visibility,
          "private",
        );
        await db.admin.query(
          "update public.eggs_profiles set visibility='public' where id=$1",
          [profiles.alice],
        );
      },
    );
    await t.test(
      "publisher-only hide/restore reasons remain auditable without leaking post body",
      async () => {
        for (const actor of ["bob", "editor", "operator"])
          await rejected(
            write(db, actor, "hide", post.id, "Review reason"),
            "42501",
          );
        await rejected(write(db, "publisher", "hide", post.id, " "), "22023");
        await write(db, "publisher", "hide", post.id, "Spam review");
        assert.equal(await thread(db, post.id), null);
        for (const actor of ["bob", "editor", "operator"])
          await rejected(
            rpc(db, actor, "get_eggs_community_moderation()"),
            "42501",
          );
        assert.equal(
          (await rpc(db, "publisher", "get_eggs_community_moderation()"))
            .posts[0].id,
          post.id,
        );
        await db.admin.query(
          "update public.eggs_profiles set visibility='private' where id=$1",
          [profiles.alice],
        );
        assert.deepEqual(
          (await rpc(db, "publisher", "get_eggs_community_moderation()")).posts,
          [],
        );
        await rejected(
          write(
            db,
            "publisher",
            "restore",
            post.id,
            "Cannot moderate private content",
          ),
          "PT404",
        );
        await db.admin.query(
          "update public.eggs_profiles set visibility='public' where id=$1",
          [profiles.alice],
        );
        await rejected(
          write(db, "bob", "create", null, "Hidden parent", post.id),
          "PT404",
        );
        await write(
          db,
          "publisher",
          "restore",
          post.id,
          "Reviewed and cleared",
        );
        assert.equal((await thread(db, post.id)).post.revision, 4);
        const audits = (
          await db.admin.query(
            "select * from eggs_community_private.moderation_audit order by id",
          )
        ).rows;
        assert.deepEqual(
          audits.map((x) => x.action),
          ["hide", "restore"],
        );
        assert.ok(!JSON.stringify(audits).includes("Winning revision"));
        await rejected(
          hubActor(db, "publisher", (c) =>
            c.query("delete from eggs_community_private.moderation_audit"),
          ),
          "42501",
        );
      },
    );
    await t.test(
      "stable feed/people pagination, literal search, no private-profile enumeration",
      async () => {
        const one = await rpc(
          db,
          "alice",
          "get_eggs_community(null,null,1,null)",
          [],
          "anon",
        );
        assert.equal(one.posts.length, 1);
        assert.ok(one.next_cursor);
        const two = await rpc(
          db,
          "alice",
          "get_eggs_community($1,$2,1,null)",
          [one.next_cursor.before, one.next_cursor.before_id],
          "anon",
        );
        assert.equal(two.posts.length, 1);
        assert.notEqual(one.posts[0].id, two.posts[0].id);
        assert.equal(two.next_cursor, null);
        assert.deepEqual(
          (
            await rpc(
              db,
              "alice",
              "get_eggs_community(null,null,20,'community_alice')",
              [],
              "anon",
            )
          ).posts.map((x) => x.id),
          [post.id],
        );
        let page = await rpc(
          db,
          "alice",
          "list_eggs_people('',null,1)",
          [],
          "anon",
        );
        assert.equal(page.people.length, 1);
        const next = await rpc(
          db,
          "alice",
          "list_eggs_people('',$1,1)",
          [page.next_cursor],
          "anon",
        );
        assert.notEqual(next.people[0].handle, page.people[0].handle);
        assert.deepEqual(
          (await rpc(db, "alice", "list_eggs_people('%',null,20)", [], "anon"))
            .people,
          [],
        );
        assert.deepEqual(
          (
            await rpc(
              db,
              "alice",
              "list_eggs_people('PRIVATE_BIO',null,20)",
              [],
              "anon",
            )
          ).people,
          [],
        );
        for (const sql of [
          "get_eggs_community(null,null,0,null)",
          "get_eggs_community(now(),null,20,null)",
          "get_eggs_community(null,null,20,'UPPER')",
          "list_eggs_people('',null,51)",
        ])
          await rejected(rpc(db, "alice", sql, [], "anon"), "22023");
      },
    );
    await t.test(
      "rolling limits survive deletion and concurrent last-slot creation, with separate reply budget",
      async () => {
        await db.admin.query(
          "insert into eggs_community_private.rate_events(profile_id,kind) select $1,'post' from generate_series(1,19)",
          [profiles.editor],
        );
        const results = await Promise.allSettled([
          write(db, "editor", "create", null, "Last slot one"),
          write(db, "editor", "create", null, "Last slot two"),
        ]);
        assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
        assert.equal(
          results.find((x) => x.status === "rejected").reason.code,
          "PT429",
        );
        await write(
          db,
          "editor",
          "delete",
          results.find((x) => x.status === "fulfilled").value.post.id,
        );
        await rejected(
          write(db, "editor", "create", null, "Deletion cannot bypass"),
          "PT429",
        );
        assert.ok(
          (
            await write(
              db,
              "editor",
              "create",
              null,
              "Independent reply budget",
              post.id,
            )
          ).post,
        );
        await db.admin.query(
          "insert into eggs_community_private.rate_events(profile_id,kind) select $1,'reply' from generate_series(1,49)",
          [profiles.editor],
        );
        await rejected(
          write(db, "editor", "create", null, "Reply limit", post.id),
          "PT429",
        );
        await db.admin.query(
          "update eggs_community_private.rate_events set created_at=clock_timestamp()-interval '61 minutes' where profile_id=$1",
          [profiles.editor],
        );
        assert.ok(
          (await write(db, "editor", "create", null, "Budget renewed")).post,
        );
      },
    );
    await t.test(
      "legacy works stay valid; optional formats/media cannot bypass registered provenance or URLs",
      async () => {
        for (const format of [
          undefined,
          "article",
          "issue",
          "comic",
          "funnies",
          "video",
        ]) {
          const content = {
            ...work,
            ...(format ? { format } : {}),
            ...(format === "video"
              ? { media_url: "https://www.youtube.com/watch?v=abcdefghijk" }
              : {}),
          };
          const draft = await rpc(
            db,
            "editor",
            "save_eggs_work(null,$1,$2,0,'save')",
            ["publication-" + (format || "legacy"), content],
          );
          await rpc(db, "publisher", "save_eggs_work($1,$2,null,1,'publish')", [
            draft.id,
            draft.slug,
          ]);
        }
        for (const content of [
          { ...work, unknown: "x" },
          { ...work, format: "music" },
          { ...work, format: null },
          { ...work, format: "video" },
          { ...work, format: "video", media_url: "" },
          { ...work, format: "article", media_url: "https://vimeo.com/123" },
          { ...work, format: "video", media_url: "javascript:alert(1)" },
          {
            ...work,
            format: "video",
            media_url: "https://www.youtube.com/watch?v=abcdefghijk&evil=x",
          },
          {
            ...work,
            format: "video",
            media_url: "https://youtube.com.evil/watch?v=abcdefghijk",
          },
          { ...work, format: "video", media_url: 123 },
        ])
          await rejected(
            rpc(
              db,
              "editor",
              "save_eggs_work(null,'bad-publication',$1,0,'save')",
              [content],
            ),
            "23514",
          );
        for (const media_url of [
          "https://vimeo.com/0",
          "https://vimeo.com/01234",
          "https://vimeo.com/1234567890123",
          "https://vimeo.com/123?evil=x",
        ])
          await rejected(
            rpc(
              db,
              "editor",
              "save_eggs_work(null,'bad-vimeo-publication',$1,0,'save')",
              [{ ...work, format: "video", media_url }],
            ),
            "23514",
          );
        const vimeo = {
          ...work,
          format: "video",
          media_url: "https://vimeo.com/123456",
        };
        assert.equal(
          (
            await rpc(
              db,
              "editor",
              "save_eggs_work(null,'vimeo-publication',$1,0,'save')",
              [vimeo],
            )
          ).content.media_url,
          vimeo.media_url,
        );
        await db.admin.query(
          "insert into eggs_rooms_private.assets values('reference-source','archive/ref','unknown','reference-only',null,'none')",
        );
        const draft = await rpc(
          db,
          "editor",
          "save_eggs_work(null,'uncleared-comic',$1,0,'save')",
          [{ ...work, format: "comic", asset_id: "reference-source" }],
        );
        await rejected(
          rpc(
            db,
            "publisher",
            "save_eggs_work($1,'uncleared-comic',null,1,'publish')",
            [draft.id],
          ),
          "23514",
        );
      },
    );
    await t.test(
      "actual PostgREST anon/owner/unrelated/editor/publisher and revoked-session boundaries",
      { skip: !hasPostgrest },
      async () => {
        const rest = await localPostgrest(t, db);
        const request = (name, body = {}, user) =>
          rest.request("/rpc/" + name, { method: "POST", body, user });
        assert.equal((await request("get_eggs_community")).status, 200);
        assert.equal((await request("get_my_eggs_community")).status, 401);
        assert.equal(
          (
            await request("write_eggs_community", {
              p_action: "create",
              p_body: "Anonymous",
            })
          ).status,
          401,
        );
        for (const user of ["alice", "bob", "editor", "publisher"]) {
          const r = await request("get_my_eggs_community", {}, user);
          assert.equal(r.status, 200, await r.clone().text());
          assert.equal((await r.json()).publisher, user === "publisher");
        }
        const newPost = await (
          await request(
            "write_eggs_community",
            { p_action: "create", p_body: "REST real database" },
            "alice",
          )
        ).json();
        assert.ok(newPost.post.id);
        let r = await request(
          "write_eggs_community",
          {
            p_action: "edit",
            p_id: newPost.post.id,
            p_body: "REST updated",
            p_revision: 1,
          },
          "alice",
        );
        assert.equal(r.status, 200, await r.clone().text());
        assert.equal(
          (
            await request(
              "write_eggs_community",
              {
                p_action: "edit",
                p_id: newPost.post.id,
                p_body: "Stale",
                p_revision: 1,
              },
              "alice",
            )
          ).status,
          409,
        );
        assert.equal(
          (
            await request(
              "write_eggs_community",
              { p_action: "delete", p_id: newPost.post.id },
              "bob",
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await request(
              "write_eggs_community",
              {
                p_action: "hide",
                p_id: newPost.post.id,
                p_body: "Editor cannot moderate",
              },
              "editor",
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await request(
              "write_eggs_community",
              {
                p_action: "hide",
                p_id: newPost.post.id,
                p_body: "Publisher review",
              },
              "publisher",
            )
          ).status,
          200,
        );
        assert.equal(
          await (
            await request("get_eggs_community_post", { p_id: newPost.post.id })
          ).json(),
          null,
        );
        assert.equal((await rest.request("/posts?select=*")).status, 404);
        await db.admin.query("delete from auth.sessions where user_id=$1", [
          hubIds.alice,
        ]);
        assert.equal(
          (
            await request(
              "write_eggs_community",
              { p_action: "create", p_body: "Revoked token" },
              "alice",
            )
          ).status,
          403,
        );
        assert.equal(
          (await request("get_my_eggs_community", {}, "alice")).status,
          403,
        );
        await db.admin.query(
          "insert into auth.sessions(id,user_id) values($1,$1)",
          [hubIds.alice],
        );
      },
    );
    await t.test(
      "private owner deletion works; account deletion cascades community while keeping audit, reserved handle and Poker",
      async () => {
        await db.admin.query(
          "update public.eggs_profiles set visibility='private' where id=$1",
          [profiles.alice],
        );
        assert.deepEqual(await write(db, "alice", "delete", post.id), {
          deleted: true,
        });
        assert.equal(
          (
            await db.admin.query(
              "select count(*)::int n from eggs_community_private.posts where id=$1 or parent_id=$1",
              [post.id],
            )
          ).rows[0].n,
          0,
        );
        await db.admin.query("delete from auth.users where id=$1", [
          hubIds.alice,
        ]);
        assert.equal(
          (
            await db.admin.query(
              "select count(*)::int n from eggs_community_private.posts where profile_id=$1",
              [profiles.alice],
            )
          ).rows[0].n,
          0,
        );
        assert.equal(
          (
            await db.admin.query(
              "select count(*)::int n from eggs_private.handle_registry where handle='community_alice'",
            )
          ).rows[0].n,
          1,
        );
        assert.ok(
          (
            await db.admin.query(
              "select count(*)::int n from eggs_community_private.moderation_audit",
            )
          ).rows[0].n >= 2,
        );
        assert.deepEqual(await legacy(), before);
      },
    );
  },
);
