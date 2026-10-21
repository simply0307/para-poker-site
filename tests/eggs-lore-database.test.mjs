import test from "node:test";
import assert from "node:assert/strict";
import { communityDatabase } from "./helpers/communityDatabase.mjs";
import { loreMigration } from "./helpers/loreDatabase.mjs";
import { hasPostgres } from "./helpers/localPostgres.mjs";
import { hasPostgrest, localPostgrest } from "./helpers/localPostgrest.mjs";
import { hubActor, hubIds, beginHubActor, rejected } from "./helpers/hubDatabase.mjs";
import { loreCommand, publicLoreSource } from "../src/lib/lore/core.mjs";

const content = (overrides = {}) => ({ title: "A synthetic dossier", summary: "A source review fixture, never a real release.", body: "Plain text fixture.\n<script>not markup</script>", continuity_note: "Test continuity only; no canon approval.", attribution: "Local test fixture", permission: "unreviewed", source_reviewed: false, public_source: "", internal_source: "PRIVATE_LORE_SOURCE / restricted review notes", project_id: null, ...overrides });
const rpc = (db, user, sql, args = [], role = "authenticated") => hubActor(db, user, (c) => c.query("select public." + sql + " result", args), role).then((r) => r.rows[0].result);
const save = (db, user, entry = null, action = "save", value = content(), identity = {}) => rpc(db, user, "save_eggs_lore($1,$2,$3,$4,$5,$6,$7)", [entry?.id || null, identity.world || entry?.world || "fixture-world", identity.kind || entry?.kind || "world", identity.slug || entry?.slug || "fixture-world", value, entry?.version || 0, action]);
const published = (db, role = "anon", user = "alice") => hubActor(db, user, (c) => c.query("select * from public.eggs_lore order by world,kind,slug"), role).then((r) => r.rows);
const reviewed = () => content({ permission: "site-public", source_reviewed: true, public_source: "https://example.com/public-source" });

test("Lore API shape and source validation reject private source exposure and canon fields", () => {
  const command = { world: "fixture-world", kind: "world", slug: "fixture-world", version: 0, action: "save", content: content() };
  assert.equal(loreCommand(command).p_content.internal_source, command.content.internal_source);
  for (const value of ["http://example.com", "https://name:secret@example.com", "https://drive.google.com/file/d/private/view", "https://docs.google.com/document/d/private/edit", "https://sub.docs.google.com/document/d/private/edit", "https://example.com/?token=secret", "https://example.com/?%74oken=secret", "https://example.com/?X-Amz-Signature=secret", "https://example.com/?client_secret=secret", "https://example.com/?accessToken=secret", "https://example.com/?page=2", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&client_secret=secret", "https://www.youtube.com/watch?v=dQw4w9WgXcQ#extra", "https://127.0.0.1/private", "https://host.local/file", "https://example.com\\private", "https://example.com/\nprivate"]) {
    assert.equal(publicLoreSource(value), false, value);
    assert.throws(() => loreCommand({ ...command, content: content({ public_source: value }) }), (e) => e.status === 400);
  }
  assert.ok(publicLoreSource("https://www.youtube.com/watch?v=dQw4w9WgXcQ"));
  assert.ok(publicLoreSource("https://reath-digest.carrd.co/#infatimer"));
  for (const fragment of ["#access_token=secret", "#client_secret=secret", "#part&secret", "#part%20two", "#", "#part#second", "#" + "a".repeat(81)]) {
    assert.equal(publicLoreSource("https://example.com/" + fragment), false, fragment);
    assert.throws(() => loreCommand({ ...command, content: content({ public_source: "https://example.com/" + fragment }) }), (e) => e.status === 400);
  }
  assert.throws(() => loreCommand({ ...command, version: 2147483648 }), (e) => e.status === 400);
  assert.throws(() => loreCommand({ ...command, content: { ...content(), canon_status: "canon" } }), (e) => e.status === 400);
  assert.throws(() => loreCommand({ ...command, action: "publish", id: hubIds.alice, version: 1 }), (e) => e.status === 400);
  assert.throws(() => loreCommand({ ...command, kind: "people", slug: "person", content: content({ project_id: hubIds.alice }) }), (e) => e.status === 400);
});

test("Lore: real PG17 grants, saved snapshots, public world boundary, private history and actual PostgREST", { skip: !hasPostgres, timeout: 180000 }, async (t) => {
  const db = await communityDatabase(t);
  const legacy = async () => {
    const tables = (await db.admin.query("select c.relname,c.relacl::text,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname !~ '^eggs_' order by c.relname")).rows;
    for (const table of tables) table.data = (await db.admin.query('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),\'[]\') data from public."' + table.relname.replaceAll('"', '""') + '" t')).rows[0].data;
    return tables;
  };
  const before = await legacy();
  await t.test("migration failure and clean transaction rollback leave all prior schema/data/grants unchanged", async () => {
    await assert.rejects(db.admin.query(loreMigration.replace(/commit;\s*$/u, "select 1/0; commit;")), (e) => e.code === "22012");
    await db.admin.query("rollback");
    assert.equal((await db.admin.query("select to_regnamespace('eggs_lore_private') ns")).rows[0].ns, null);
    assert.deepEqual(await legacy(), before);
    await db.admin.query(loreMigration.replace(/commit;\s*$/u, "rollback;"));
    assert.equal((await db.admin.query("select to_regclass('public.eggs_lore') relation")).rows[0].relation, null);
  });
  await db.admin.query(loreMigration);
  let world, person, term;
  await t.test("forced RLS, narrow table grants and fixed-search-path private definers", async () => {
    const tables = (await db.admin.query("select c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname='eggs_lore_private' or (n.nspname='public' and c.relname in ('eggs_lore','eggs_lore_drafts'))) and c.relkind='r'")).rows;
    assert.equal(tables.length, 3); assert.ok(tables.every((r) => r.relrowsecurity && r.relforcerowsecurity));
    assert.deepEqual(await published(db), []);
    await rejected(hubActor(db, "alice", (c) => c.query("select * from public.eggs_lore_drafts"), "anon"), "42501");
    assert.deepEqual((await hubActor(db, "alice", (c) => c.query("select * from public.eggs_lore_drafts"))).rows, []);
    await rejected(hubActor(db, "publisher", (c) => c.query("select * from eggs_lore_private.audit")), "42501");
    for (const role of ["anon", "authenticated"]) {
      await rejected(hubActor(db, "alice", (c) => c.query("delete from public.eggs_lore"), role), "42501");
      await rejected(hubActor(db, "alice", (c) => c.query("update public.eggs_lore_drafts set state='published'"), role), "42501");
    }
    const functions = (await db.admin.query("select p.proconfig,p.prosecdef,exists(select 1 from aclexplode(p.proacl) g where g.grantee=0 and g.privilege_type='EXECUTE') public_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eggs_lore_private' or (n.nspname='public' and p.proname in ('save_eggs_lore','eggs_lore_audit'))")).rows;
    assert.ok(functions.every((f) => !f.public_execute && f.proconfig.includes('search_path=""')));
    assert.equal((await db.admin.query("select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('save_eggs_lore','eggs_lore_audit') and p.prosecdef")).rows[0].n, 0);
  });
  await t.test("live editor draft access, immutable scoped identity and no permission from JWT metadata", async () => {
    await rejected(save(db, "alice"), "42501");
    await rejected(save(db, "operator"), "42501");
    await rejected(save(db, "editor", null, "save", content(), { kind: "people", slug: "unregistered-person" }), "23514");
    world = await save(db, "editor");
    assert.equal(world.version, 1); assert.equal(world.state, "draft");
    person = await save(db, "editor", null, "save", content({ title: "Fixture person" }), { kind: "people", slug: "fixture-person" });
    assert.equal((await hubActor(db, "editor", (c) => c.query("select * from public.eggs_lore_drafts"))).rows.length, 2);
    assert.deepEqual((await hubActor(db, "bob", (c) => c.query("select * from public.eggs_lore_drafts"))).rows, []);
    await rejected(save(db, "editor", person, "save", content(), { slug: "changed-person" }), "22023");
    await rejected(save(db, "editor", person, "save", content(), { world: "other-world" }), "23514");
    await rejected(save(db, "editor", person, "save", { ...content(), canon_status: "canon" }), "23514");
  });
  await t.test("publisher requires source review and saved preview; unpublished world blocks dossier publication", async () => {
    await rejected(save(db, "editor", world, "publish", null), "42501");
    await rejected(save(db, "publisher", world, "publish", null), "23514");
    world = await save(db, "editor", world, "save", reviewed());
    person = await save(db, "editor", person, "save", reviewed());
    await rejected(save(db, "publisher", person, "publish", null), "23514");
    await rejected(save(db, "publisher", world, "publish", reviewed()), "22023");
    world = await save(db, "publisher", world, "publish", null);
    person = await save(db, "publisher", person, "publish", null);
    assert.equal((await published(db)).length, 2);
    for (const row of await published(db)) {
      assert.ok(!Object.hasOwn(row.content, "internal_source"));
      assert.ok(!JSON.stringify(row).includes("PRIVATE_LORE_SOURCE"));
      assert.equal(row.content.permission, "site-public");
    }
    const saved = await save(db, "editor", person, "save", reviewed());
    assert.equal((await published(db)).find((r) => r.id === person.id).version, person.version);
    person = saved;
  });
  await t.test("unsafe public sources and invalid project associations fail atomically", async () => {
    const prior = (await db.admin.query("select * from public.eggs_lore_drafts where id=$1", [person.id])).rows;
    const audits = (await db.admin.query("select count(*)::int n from eggs_lore_private.audit")).rows[0].n;
    for (const public_source of ["https://docs.google.com/document/d/private", "https://drive.google.com/file/private", "https://sub.docs.google.com/document/d/private", "https://user:secret@example.com", "https://example.com/?access_token=secret", "https://example.com/?%74oken=secret", "https://example.com/?X-Amz-Signature=secret", "https://example.com/?client_secret=secret", "https://example.com/?accessToken=secret", "https://example.com/?page=2", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&client_secret=secret", "https://www.youtube.com/watch?v=dQw4w9WgXcQ#extra", "http://example.com", "https://127.0.0.1/private"]) await rejected(save(db, "editor", person, "save", reviewedWith({ public_source })), "23514");
    for (const public_source of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://reath-digest.carrd.co/#infatimer"]) assert.equal((await db.admin.query("select eggs_lore_private.safe_source($1) valid", [public_source])).rows[0].valid, true);
    for (const fragment of ["#access_token=secret", "#client_secret=secret", "#part&secret", "#part%20two", "#", "#part#second", "#" + "a".repeat(81)]) await rejected(save(db, "editor", person, "save", reviewedWith({ public_source: "https://example.com/" + fragment })), "23514");
    for (const [field, max] of [["title", 120], ["summary", 300], ["body", 20000], ["attribution", 300]]) await rejected(save(db, "editor", person, "save", reviewedWith({ [field]: " ".repeat(max) + "x" })), "23514");
    await rejected(save(db, "editor", world, "save", reviewedWith({ project_id: hubIds.alice })), "23514");
    await rejected(save(db, "editor", person, "save", reviewedWith({ project_id: hubIds.alice })), "23514");
    assert.deepEqual((await db.admin.query("select * from public.eggs_lore_drafts where id=$1", [person.id])).rows, prior);
    assert.equal((await db.admin.query("select count(*)::int n from eggs_lore_private.audit")).rows[0].n, audits);
  });
  function reviewedWith(extra) { return { ...reviewed(), ...extra }; }
  await t.test("concurrent same-revision saves serialize, return409 and preserve the winning draft", async () => {
    const a = await db.connect(), b = await db.connect();
    try {
      await beginHubActor(a, "editor"); await beginHubActor(b, "publisher");
      const args = [person.id, person.world, person.kind, person.slug, reviewedWith({ body: "Winning lore revision" }), person.version, "save"];
      await a.query("select public.save_eggs_lore($1,$2,$3,$4,$5,$6,$7)", args);
      const pid = (await b.query("select pg_backend_pid() pid")).rows[0].pid;
      const pending = b.query("select public.save_eggs_lore($1,$2,$3,$4,$5,$6,$7)", [...args.slice(0, 4), reviewedWith({ body: "Stale overwrite" }), ...args.slice(5)]).then(() => null, (e) => e.code);
      let locked = false;
      for (let i = 0; i < 80; i++) {
        if ((await db.admin.query("select wait_event_type from pg_stat_activity where pid=$1", [pid])).rows[0]?.wait_event_type === "Lock") { locked = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      assert.ok(locked); await a.query("commit"); assert.equal(await pending, "PT409");
    } finally { await a.query("rollback"); await b.query("rollback"); await a.end(); await b.end(); }
    person = (await db.admin.query("select * from public.eggs_lore_drafts where id=$1", [person.id])).rows[0];
    assert.equal(person.content.body, "Winning lore revision");
    assert.ok(!person.content.body.includes("Stale"));
  });
  await t.test("archiving world suppresses all dossiers even for direct authenticated reads; drafts and audit remain", async () => {
    term = await save(db, "editor", null, "save", reviewed(), { kind: "terms", slug: "fixture-term" });
    term = await save(db, "publisher", term, "publish", null);
    const historyBefore = await rpc(db, "editor", "eggs_lore_audit($1)", [world.id]);
    world = await save(db, "publisher", world, "archive", null);
    for (const user of ["alice", "editor", "publisher"]) assert.deepEqual(await published(db, "authenticated", user), []);
    assert.deepEqual(await published(db), []);
    assert.equal((await db.admin.query("select * from public.eggs_lore where kind<>'world'")).rows.length, 2);
    assert.equal((await db.admin.query("select * from public.eggs_lore_drafts")).rows.length, 3);
    assert.equal((await rpc(db, "editor", "eggs_lore_audit($1)", [world.id])).length, historyBefore.length + 1);
    await rejected(save(db, "publisher", person, "publish", null), "23514");
    world = await save(db, "publisher", world, "publish", null);
    assert.equal((await published(db)).length, 3);
  });
  await t.test("real PostgREST anonymous projection, direct draft denial, live JWT role boundaries and409", { skip: !hasPostgrest }, async () => {
    const rest = await localPostgrest(t, db);
    const anon = await rest.request("/eggs_lore?select=*");
    assert.equal(anon.status, 200); const rows = await anon.json(); assert.equal(rows.length, 3);
    assert.ok(!JSON.stringify(rows).includes("PRIVATE_LORE_SOURCE")); assert.ok(rows.every((r) => !Object.hasOwn(r.content, "internal_source")));
    assert.notEqual((await rest.request("/eggs_lore_drafts?select=*")).status, 200);
    assert.deepEqual(await (await rest.request("/eggs_lore_drafts?select=*", { user: "alice" })).json(), []);
    assert.equal((await (await rest.request("/eggs_lore_drafts?select=*", { user: "editor" })).json()).length, 3);
    const args = { p_id: person.id, p_world: person.world, p_kind: person.kind, p_slug: person.slug, p_content: null, p_version: 1, p_action: "publish" };
    assert.equal((await rest.request("/rpc/save_eggs_lore", { user: "editor", method: "POST", body: args })).status, 403);
    assert.equal((await rest.request("/rpc/save_eggs_lore", { user: "publisher", method: "POST", body: args })).status, 409);
    assert.equal((await rest.request("/rpc/eggs_lore_audit", { user: "alice", method: "POST", body: { p_id: world.id } })).status, 403);
    assert.notEqual((await rest.request("/audit?select=*", { user: "publisher", headers: { "Accept-Profile": "eggs_lore_private" } })).status, 200);
    await db.admin.query("delete from auth.sessions where user_id=$1", [hubIds.editor]);
    assert.deepEqual(await (await rest.request("/eggs_lore_drafts?select=*", { user: "editor" })).json(), []);
    assert.equal((await rest.request("/rpc/save_eggs_lore", { user: "editor", method: "POST", body: args })).status, 403);
  });
  await t.test("account deletion retains source/audit history and published snapshots without Poker mutations", async () => {
    const count = (await db.admin.query("select count(*)::int n from eggs_lore_private.audit where actor_id=$1", [hubIds.editor])).rows[0].n;
    assert.ok(count > 0);
    await db.admin.query("delete from auth.users where id=$1", [hubIds.editor]);
    assert.ok((await db.admin.query("select count(*)::int n from eggs_lore_private.audit where actor_id is null")).rows[0].n >= count);
    assert.equal((await published(db)).length, 3);
    assert.deepEqual(await legacy(), before);
  });
});
