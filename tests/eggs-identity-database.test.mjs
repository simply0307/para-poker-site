import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { hasPostgres, localPostgres } from "./helpers/localPostgres.mjs";

const migrationPath = "supabase/migrations/20260922231308_eggs_consumer_identity_reviewed_claims.sql";
const migration = fs.readFileSync(migrationPath, "utf8");
const fixture = fs.readFileSync("tests/database/eggs-identity-live-schema.sql", "utf8")
  .replace(/^create role [^;]+;\r?\n/gmu, ""); // Roles are cluster-wide; create them once below.
const uid = n => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const pid = n => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const users = { owner: uid(1), alice: uid(2), bob: uid(3), carol: uid(4), unconfirmed: uid(5), anonymous: uid(6), admin: uid(7), dave: uid(8) };
const safeProfileColumns = "id,handle,display_name,bio,avatar_path,visibility,created_at,updated_at";
const legacyTables = ["profiles","players","sessions","hands","actions","raw_log_entries","notable_hands","game_session_imports","session_evidence_revisions","session_results","player_session_stats","player_season_stats","player_career_stats","standings","recap_drafts","published_articles","stat_recalculation_runs"];

async function beginActor(client, userId, role = "authenticated", metadata = {}) {
  assert.ok(["anon", "authenticated", "service_role"].includes(role));
  await client.query("begin");
  await client.query(`set local role ${role}`);
  await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: userId, role, ...metadata })]);
  const { rows: [actual] } = await client.query("select current_user as role, rolsuper, rolbypassrls from pg_roles where rolname=current_user");
  assert.equal(actual.role, role);
  if (role !== "service_role") assert.equal(actual.rolsuper || actual.rolbypassrls, false, "RLS tests must not run as a privileged owner");
}

async function actor(db, userId, work, { role = "authenticated", metadata } = {}) {
  const client = await db.connect();
  try {
    await beginActor(client, userId, role, metadata);
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally { await client.end(); }
}

const fails = (operation, codes) => assert.rejects(operation, error => {
  assert.ok([codes].flat().includes(error.code), `${error.code}: ${error.message}`);
  return true;
});

async function createProfile(db, user, handle, visibility = "private") {
  const result = await actor(db, user, c => c.query(
    `insert into public.eggs_profiles(handle,display_name,visibility) values($1,$2,$3) returning ${safeProfileColumns}`,
    [handle, `Profile ${handle}`, visibility],
  ));
  return result.rows[0];
}
async function submit(db, user, player = pid(1), note = "Private claim evidence") {
  const result = await actor(db, user, c => c.query(
    "insert into public.para_poker_player_claims(player_id,evidence_note) values($1,$2) returning id,claimant_profile_id,status", [player,note],
  ));
  return result.rows[0];
}
const review = (client, claimId, decision = "approve", note = null) => client.query(
  "select public.review_para_poker_claim($1,$2,$3) as result", [claimId,decision,note],
);

async function legacySnapshot(client) {
  const data = {};
  for (const table of legacyTables) {
    data[table] = (await client.query(`select count(*)::int as count,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) as hash from public.${table} t`)).rows[0];
  }
  const { rows: metadata } = await client.query(`
    select c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text,
      (select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
       from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as columns,
      (select jsonb_agg(pg_get_constraintdef(k.oid) order by k.conname) from pg_constraint k where k.conrelid=c.oid) as constraints,
      (select jsonb_agg(indexdef order by indexname) from pg_indexes where schemaname='public' and tablename=c.relname) as indexes,
      (select jsonb_agg(pg_get_triggerdef(t.oid) order by t.tgname) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal) as triggers,
      (select jsonb_agg(to_jsonb(p) order by p.policyname) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policies
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any($1) order by c.relname`, [legacyTables]);
  return { data, metadata };
}

async function waitForLock(admin, backendPid) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const { rows: [state] } = await admin.query("select wait_event_type,pg_blocking_pids(pid) as blockers from pg_stat_activity where pid=$1", [backendPid]);
    if (state?.wait_event_type === "Lock" && state.blockers.length) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.fail("Second connection never entered a real PostgreSQL lock wait");
}

test("consumer identity migration on disposable PostgreSQL 17", {
  skip: !hasPostgres && "Set EGGS_TEST_POSTGRES_BIN to PostgreSQL 17 binaries; this suite never accepts a remote database URL.",
  timeout: 180000,
}, async t => {
  const cluster = await localPostgres(t);
  await cluster.admin.query("create role anon; create role authenticated; create role service_role bypassrls;");
  // Match the hosted migration/function owner: BYPASSRLS, but not a superuser.
  await cluster.admin.query("grant anon,authenticated,service_role to postgres; set role postgres;");
  assert.deepEqual((await cluster.admin.query("select rolsuper,rolbypassrls from pg_roles where rolname=current_user")).rows[0], { rolsuper:false,rolbypassrls:true });
  let nextDatabase = 0;
  async function database({ apply = true } = {}) {
    const name = `identity_test_${++nextDatabase}`;
    await cluster.admin.query(`create database ${name}`);
    const admin = await cluster.connect(name);
    await admin.query(`begin; ${fixture} commit;`);
    for (const [kind,id] of Object.entries(users)) {
      await admin.query("insert into auth.users(id,email,email_confirmed_at,is_anonymous) values($1,$2,$3,$4)", [id,`${kind}@fixture.invalid`,kind === "unconfirmed" ? null : "2026-09-01T00:00:00Z",kind === "anonymous"]);
    }
    for (const [user,role] of [["owner","owner"],["admin","admin"],["bob","viewer"]]) {
      await admin.query("insert into public.profiles(email,identity_user_id,auth_user_id,role) values($1,$2,$3,$4)", [`${user}@fixture.invalid`,`legacy-${user}`,users[user],role]);
    }
    for (let n = 1; n <= 7; n++) await admin.query("insert into public.players(id,display_name,slug,pokernow_name) values($1,$2,$3,$4)", [pid(n),`Player ${n}`,`player-${n}`,`Legacy Name ${n}`]);
    const session = uid(100);
    const hand = uid(101);
    const imported = uid(102);
    await admin.query("insert into public.sessions(id,session_number,session_code) values($1,1,'TEST-001')", [session]);
    await admin.query("insert into public.hands(id,session_id,hand_no) values($1,$2,1)", [hand,session]);
    await admin.query("insert into public.actions(session_id,hand_id,hand_no,player_id,player_name,action,amount) values($1,$2,1,$3,'Legacy Name 1','raise',200)", [session,hand,pid(1)]);
    await admin.query("insert into public.game_session_imports(id,source_app,source_match_id,schema_version,event_schema_version,checksum,authority_type,visibility) values($1,'fixture','fixture-match','2','2','fixture-checksum','authoritative','private')", [imported]);
    await admin.query(`insert into public.session_evidence_revisions(session_id,import_id,revision_number,source_size_bytes,source_checksum,metadata,metadata_checksum,parser_version,parsed_manifest,manifest_checksum,validation_report,validation_report_checksum,preview_checksum)
      values($1,$2,1,10,'source','{}','metadata','fixture-1','{}','manifest','{}','validation','preview')`, [session,imported]);
    const before = await legacySnapshot(admin);
    if (apply) await admin.query(migration);
    return { admin, before, connect: () => cluster.connect(name) };
  }

  await t.test("migration preserves legacy schema, operator mappings and evidence; grants remain narrow", async () => {
    const db = await database();
    assert.deepEqual(await legacySnapshot(db.admin), db.before);
    assert.equal(db.before.data.players.count, 7);
    assert.equal(db.before.data.session_evidence_revisions.count, 1);
    for (const role of ["anon","authenticated"]) {
      const result = await actor(db, users.owner, c => c.query("select (select count(*)::int from public.profiles) as profiles,(select count(*)::int from public.players) as players"), { role });
      assert.deepEqual(result.rows[0], { profiles: 0, players: 0 });
      for (const table of ["eggs_profiles","para_poker_player_claims","para_poker_profile_links"]) {
        const { rows: [permissions] } = await db.admin.query("select has_table_privilege($1,$2,'TRUNCATE') as truncate,has_table_privilege($1,$2,'TRIGGER') as trigger", [role,`public.${table}`]);
        assert.deepEqual(permissions, { truncate: false, trigger: false });
      }
    }
    const { rows: functions } = await db.admin.query("select p.proname,n.nspname,p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eggs_private' or p.proname in ('get_my_eggs_profile','review_para_poker_claim','withdraw_para_poker_claim')");
    for (const fn of functions) {
      assert.ok(fn.proconfig.includes('search_path=""'));
      if (fn.nspname === "public") assert.equal(fn.prosecdef, false);
      if (!/^is_|^current_profile_id$/u.test(fn.proname)) assert.equal(fn.anon_execute, false);
    }
    const { rows: tables } = await db.admin.query("select relrowsecurity,relforcerowsecurity from pg_class where relname=any($1)", [["eggs_profiles","para_poker_player_claims","para_poker_profile_links"]]);
    assert.ok(tables.every(row => row.relrowsecurity && row.relforcerowsecurity));
    await fails(() => actor(db, null, c => c.query("insert into public.eggs_profiles(handle,display_name) values('service','Service')"), { role: "service_role" }), "42501");
  });

  await t.test("direct SQL enforces canonical handles, reservations, uniqueness and immutable identity", async () => {
    const db = await database();
    for (const handle of [null,"ABc"," alpha","alpha ","al","a".repeat(31),"a-b","a.b","ábc","a\u200Db","abc\n","abc\t","admin","para","poker","library"]) {
      await fails(() => actor(db, users.alice, c => c.query("insert into public.eggs_profiles(handle,display_name) values($1,'Alice')", [handle])), ["23502","23514"]);
    }
    await fails(() => db.admin.query("insert into public.eggs_profiles(auth_user_id,handle,display_name) values($1,'UPPER','Direct SQL')", [users.alice]), "23514");
    const profile = await createProfile(db, users.alice, "alice_123");
    assert.equal(profile.visibility, "private");
    await fails(() => createProfile(db, users.bob, "alice_123"), "23505");
    await fails(() => createProfile(db, users.alice, "another_handle"), "23505");
    for (const assignment of ["handle='changed'",`auth_user_id='${users.bob}'`,`id='${uid(90)}'`,"created_at=now()"])
      await fails(() => actor(db, users.alice, c => c.query(`update public.eggs_profiles set ${assignment} where id=$1`, [profile.id])), "42501");
    await fails(() => db.admin.query("update public.eggs_profiles set handle='changed' where id=$1", [profile.id]), "55000");
    await fails(() => actor(db, users.bob, c => c.query("insert into public.eggs_profiles(auth_user_id,handle,display_name) values($1,'spoof','Spoof')", [users.alice])), "42501");
  });

  await t.test("RLS separates public presentation, owner CRUD and operator privilege without leaking Auth IDs", async () => {
    const db = await database();
    for (const user of [null,users.unconfirmed,users.anonymous])
      await fails(() => createProfile(db, user, "not_allowed"), "42501");
    await fails(() => actor(db, null, c => c.query("insert into public.eggs_profiles(handle,display_name) values('anon_user','Anon')"), { role: "anon" }), "42501");
    const alice = await createProfile(db, users.alice, "alice");
    const bob = await createProfile(db, users.bob, "bob", "public");
    for (const user of [users.owner,users.bob]) {
      const hidden = await actor(db, user, c => c.query("select id from public.eggs_profiles where id=$1", [alice.id]));
      assert.equal(hidden.rowCount, 0, "Operators do not gain blanket consumer access");
    }
    const own = await actor(db, users.alice, c => c.query("select * from public.get_my_eggs_profile()"));
    assert.equal(own.rows[0].id, alice.id);
    for (const role of ["anon","authenticated"]) {
      const publicRows = await actor(db, users.alice, c => c.query("select * from public.eggs_public_profiles"), { role });
      assert.deepEqual(publicRows.rows.map(row => row.id), [bob.id]);
      assert.ok(publicRows.rows.every(row => !Object.hasOwn(row,"auth_user_id")));
      await fails(() => actor(db, users.alice, c => c.query("select auth_user_id from public.eggs_profiles"), { role }), "42501");
      await fails(() => actor(db, users.alice, c => c.query("select row_to_json(p) from public.eggs_profiles p"), { role }), "42501");
    }
    assert.equal((await actor(db, users.alice, c => c.query("update public.eggs_profiles set bio='stolen' where id=$1", [bob.id]))).rowCount, 0);
    assert.equal((await actor(db, users.alice, c => c.query("delete from public.eggs_profiles where id=$1", [bob.id]))).rowCount, 0);
    assert.equal((await actor(db, users.alice, c => c.query("update public.eggs_profiles set bio='My bio',visibility='public' where id=$1", [alice.id]))).rowCount, 1);
    await fails(() => actor(db, users.alice, c => c.query("update public.eggs_profiles set avatar_path=$1 where id=$2", [`${bob.id}/avatar.png`,alice.id])), "23514");
    await db.admin.query("update auth.users set deleted_at=now() where id=$1", [users.alice]);
    assert.equal((await actor(db, users.alice, c => c.query("select * from public.get_my_eggs_profile()"))).rowCount, 0);
    assert.equal((await actor(db, null, c => c.query("select id from public.eggs_public_profiles where id=$1", [alice.id]), { role: "anon" })).rowCount, 0);
  });

  await t.test("only fresh operator authorization can approve a claim and expose an opted-in association", async () => {
    const db = await database();
    const alice = await createProfile(db, users.alice, "alice", "public");
    await createProfile(db, users.bob, "bob");
    const claim = await submit(db, users.alice);
    await fails(() => submit(db, users.alice), "23505");
    await fails(() => submit(db, users.alice, pid(99)), "23503");
    await fails(() => actor(db, users.bob, c => c.query("insert into public.para_poker_player_claims(claimant_profile_id,player_id) values($1,$2)", [alice.id,pid(2)])), "42501");
    await fails(() => actor(db, users.alice, c => c.query("update public.para_poker_player_claims set status='approved' where id=$1", [claim.id])), "42501");
    await fails(() => actor(db, users.alice, c => c.query("insert into public.para_poker_profile_links(profile_id,player_id,claim_id,verified_at) values($1,$2,$3,now())", [alice.id,pid(1),claim.id])), "42501");
    assert.equal((await actor(db, users.bob, c => c.query("select id from public.para_poker_player_claims where id=$1", [claim.id]))).rowCount, 0);
    assert.equal((await actor(db, users.owner, c => c.query("select id from public.para_poker_player_claims where id=$1", [claim.id]))).rowCount, 1);
    await fails(() => actor(db, users.bob, c => review(c,claim.id), { metadata: { user_metadata: { role:"owner",auth_user_id:users.owner }, app_metadata: { role:"owner" } } }), "42501");
    await fails(() => actor(db, null, c => review(c,claim.id), { role:"anon" }), "42501");
    await fails(() => actor(db, users.owner, c => review(c,claim.id,"invalid")), "22023");
    await db.admin.query("update public.profiles set role='viewer' where auth_user_id=$1", [users.owner]);
    await fails(() => actor(db, users.owner, c => review(c,claim.id)), "42501");
    await db.admin.query("update public.profiles set role='owner' where auth_user_id=$1", [users.owner]);
    await actor(db, users.owner, c => review(c,claim.id,"approve","Private reviewer note"));
    await actor(db, users.admin, c => review(c,claim.id,"approve","Must not replace original review"));
    const stored = (await db.admin.query("select * from public.para_poker_player_claims where id=$1", [claim.id])).rows[0];
    assert.equal(stored.reviewer_auth_user_id, users.owner);
    assert.equal(stored.review_note,"Private reviewer note");
    await fails(() => actor(db, users.alice, c => c.query("select reviewer_auth_user_id,review_note from public.para_poker_player_claims where id=$1", [claim.id])), "42501");
    const publicLinks = () => actor(db, null, c => c.query("select * from public.para_poker_public_profile_links"), { role:"anon" });
    assert.equal((await publicLinks()).rowCount, 0);
    assert.equal((await actor(db, users.bob, c => c.query("update public.para_poker_profile_links set show_on_profile=true where profile_id=$1", [alice.id]))).rowCount, 0);
    await actor(db, users.alice, c => c.query("update public.para_poker_profile_links set show_on_profile=true where profile_id=$1", [alice.id]));
    assert.deepEqual((await publicLinks()).rows, [{ profile_id:alice.id,player_id:pid(1) }]);
    await actor(db, users.alice, c => c.query("update public.eggs_profiles set visibility='private' where id=$1", [alice.id]));
    assert.equal((await publicLinks()).rowCount, 0);
    await fails(() => actor(db, users.alice, c => c.query("select public.withdraw_para_poker_claim($1)", [claim.id])), "55000");
  });

  for (const scenario of ["same player","same profile","same claim","rollback winner"]) {
    await t.test(`independent connections contend safely: ${scenario}`, async () => {
      const db = await database();
      await createProfile(db, users.alice, "alice");
      await createProfile(db, users.bob, "bob");
      const first = await submit(db, users.alice);
      const second = scenario === "same claim" ? first : await submit(db, scenario === "same profile" ? users.alice : users.bob, scenario === "same profile" ? pid(2) : pid(1));
      const a = await db.connect();
      const b = await db.connect();
      try {
        await beginActor(a,users.owner);
        await beginActor(b,users.admin);
        const aPid = (await a.query("select pg_backend_pid() as pid")).rows[0].pid;
        const bPid = (await b.query("select pg_backend_pid() as pid")).rows[0].pid;
        assert.notEqual(aPid,bPid);
        await review(a,first.id);
        const contender = review(b,second.id).then(value=>({value}),error=>({error}));
        await waitForLock(db.admin,bPid);
        await a.query(scenario === "rollback winner" ? "rollback" : "commit");
        const result = await contender;
        if (["same player","same profile"].includes(scenario)) {
          assert.equal(result.error?.code,"23505");
          await b.query("rollback");
          const pending = (await db.admin.query("select status,reviewed_at,resolved_at from public.para_poker_player_claims where id=$1", [second.id])).rows[0];
          assert.deepEqual(pending,{status:"pending",reviewed_at:null,resolved_at:null});
        } else {
          assert.equal(result.error,undefined);
          assert.equal(result.value.rows[0].result.status,"approved");
          await b.query("commit");
        }
        assert.equal((await db.admin.query("select count(*)::int as n from public.para_poker_profile_links")).rows[0].n,1);
        if (scenario === "rollback winner") assert.equal((await db.admin.query("select status from public.para_poker_player_claims where id=$1", [first.id])).rows[0].status,"pending");
        assert.deepEqual(await legacySnapshot(db.admin),db.before);
      } finally {
        await a.query("rollback"); await b.query("rollback");
        await a.end(); await b.end();
      }
    });
  }

  await t.test("withdrawal and deletion preserve reviewed history and all Poker evidence", async () => {
    const db = await database();
    const alice = await createProfile(db,users.alice,"alice");
    const bob = await createProfile(db,users.bob,"bob");
    const approved = await submit(db,users.alice);
    const pending = await submit(db,users.bob,pid(2));
    await actor(db,users.owner,c=>review(c,approved.id,"approve","Reviewer text"));
    await fails(()=>actor(db,users.alice,c=>c.query("select public.withdraw_para_poker_claim($1)",[pending.id])),"42501");
    await actor(db,users.bob,c=>c.query("select public.withdraw_para_poker_claim($1)",[pending.id]));
    await actor(db,users.bob,c=>c.query("select public.withdraw_para_poker_claim($1)",[pending.id]));
    await fails(()=>actor(db,users.owner,c=>review(c,pending.id)),"55000");
    await actor(db,users.alice,c=>c.query("delete from public.eggs_profiles where id=$1",[alice.id]));
    await actor(db,users.bob,c=>c.query("delete from public.eggs_profiles where id=$1",[bob.id]));
    assert.equal((await db.admin.query("select count(*)::int as n from public.para_poker_profile_links")).rows[0].n,0);
    const history=(await db.admin.query("select status,claimant_profile_id,evidence_note,review_note from public.para_poker_player_claims order by status")).rows;
    assert.deepEqual(history,[{status:"approved",claimant_profile_id:null,evidence_note:null,review_note:null},{status:"withdrawn",claimant_profile_id:null,evidence_note:null,review_note:null}]);
    assert.deepEqual(await legacySnapshot(db.admin),db.before);
    const carol=await createProfile(db,users.carol,"carol");
    const carolClaim=await submit(db,users.carol,pid(3));
    await actor(db,users.owner,c=>review(c,carolClaim.id));
    await db.admin.query("delete from auth.users where id=$1",[users.carol]);
    assert.equal((await db.admin.query("select id from public.eggs_profiles where id=$1",[carol.id])).rowCount,0);
    assert.deepEqual(await legacySnapshot(db.admin),db.before);
  });

  await t.test("schema drift aborts the migration atomically before creating consumer objects", async () => {
    const db=await database({apply:false});
    await db.admin.query("alter table public.players disable row level security");
    await fails(()=>db.admin.query(migration),"P0001");
    await db.admin.query("rollback");
    const objects=(await db.admin.query("select to_regnamespace('eggs_private') as schema,to_regclass('public.eggs_profiles') as profiles")).rows[0];
    assert.deepEqual(objects,{schema:null,profiles:null});
    assert.equal((await db.admin.query("select count(*)::int as n from public.players")).rows[0].n,7);
  });

  await t.test("rejection, pending account deletion and reviewer deletion preserve the intended records", async () => {
    const db=await database();
    await createProfile(db,users.alice,"alice");
    const dave=await createProfile(db,users.dave,"dave");
    const rejected=await submit(db,users.alice);
    const pending=await submit(db,users.dave,pid(2));
    await actor(db,users.admin,c=>review(c,rejected.id,"reject","Insufficient evidence"));
    await actor(db,users.owner,c=>review(c,rejected.id,"reject","Must not replace original review"));
    await fails(()=>actor(db,users.owner,c=>review(c,rejected.id)),"55000");
    assert.equal((await db.admin.query("select count(*)::int as n from public.para_poker_profile_links")).rows[0].n,0);
    await db.admin.query("delete from auth.users where id=$1",[users.dave]);
    assert.equal((await db.admin.query("select id from public.eggs_profiles where id=$1",[dave.id])).rowCount,0);
    assert.deepEqual((await db.admin.query("select status,claimant_profile_id,evidence_note,review_note from public.para_poker_player_claims where id=$1",[pending.id])).rows[0],
      {status:"withdrawn",claimant_profile_id:null,evidence_note:null,review_note:null});
    assert.deepEqual(await legacySnapshot(db.admin),db.before);
    await db.admin.query("delete from auth.users where id=$1",[users.admin]);
    const decision=(await db.admin.query("select status,reviewer_auth_user_id,reviewer_role,review_note from public.para_poker_player_claims where id=$1",[rejected.id])).rows[0];
    assert.deepEqual(decision,{status:"rejected",reviewer_auth_user_id:null,reviewer_role:"admin",review_note:"Insufficient evidence"});
    // Existing operator behavior remains SET NULL, not deletion or cascade.
    assert.deepEqual((await db.admin.query("select auth_user_id,role from public.profiles where identity_user_id='legacy-admin'")).rows[0],{auth_user_id:null,role:"admin"});
    const after=await legacySnapshot(db.admin);
    delete after.data.profiles;
    delete db.before.data.profiles;
    assert.deepEqual(after,db.before);
  });

  await t.test("the complete additive DDL can roll back before commit without changing legacy data", async () => {
    const db=await database({apply:false});
    assert.match(migration,/commit;\s*$/u);
    await db.admin.query(migration.replace(/commit;\s*$/u,"rollback;"));
    assert.deepEqual(await legacySnapshot(db.admin),db.before);
    assert.equal((await db.admin.query("select to_regnamespace('eggs_private') as schema")).rows[0].schema,null);
    assert.equal((await db.admin.query("select to_regclass('public.eggs_profiles') as profiles")).rows[0].profiles,null);
  });
});
