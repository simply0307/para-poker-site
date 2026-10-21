import test from "node:test";
import assert from "node:assert/strict";
import { hasPostgres } from "./helpers/localPostgres.mjs";
import { hubDatabase,hubActor,beginHubActor,hubIds,hubMigration,rejected } from "./helpers/hubDatabase.mjs";
import { bootstrapProjects } from "../src/lib/hub/catalog.mjs";
const content={...bootstrapProjects[1].content,title:"Local test project",destination:"https://example.com",featured:false};
const save=(db,user,{id=null,slug="local-test",value=content,version=0,action="save"}={})=>hubActor(db,user,c=>c.query("select public.save_eggs_project($1,$2,$3,$4,$5) as project",[id,slug,value,version,action])).then(r=>r.rows[0].project);
const legacy=async db=>(await db.admin.query("select c.relname,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity,(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull) order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as columns from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname !~ '^eggs_project|^eggs_profile_expression' order by c.relname")).rows;
test("Hub additive migration and publication/privacy on disposable PostgreSQL 17",{skip:!hasPostgres,timeout:180000},async t=>{
 const db=await hubDatabase(t);const before=await legacy(db);
 await t.test("complete rollback leaves identity and legacy schema intact",async()=>{
  await db.admin.query(hubMigration.replace(/commit;\s*$/u,"rollback;"));
  assert.equal((await db.admin.query("select to_regclass('public.eggs_projects') as table")).rows[0].table,null);
  assert.deepEqual(await legacy(db),before);
 });
 await db.apply();
 await t.test("additive schema preserves legacy/identity grants and mappings",async()=>{
  assert.deepEqual(await legacy(db),before);
  assert.equal((await db.admin.query("select count(*)::int n from public.profiles where auth_user_id=$1 and role='owner'",[hubIds.operator])).rows[0].n,1);
  const tables=(await db.admin.query("select relrowsecurity,relforcerowsecurity from pg_class where relname in ('eggs_projects','eggs_project_drafts','eggs_profile_expression','project_audit','editors')")).rows;
  assert.equal(tables.length,5);assert.ok(tables.every(x=>x.relrowsecurity&&x.relforcerowsecurity));
 });
 await t.test("anonymous published projection matches existing entries; drafts and audit are denied",async()=>{
  const rows=await hubActor(db,"alice",c=>c.query("select id,slug,content from public.eggs_projects order by slug"),"anon");
  assert.deepEqual(rows.rows,bootstrapProjects.toSorted((a,b)=>a.slug.localeCompare(b.slug)));
  await rejected(hubActor(db,"alice",c=>c.query("select * from public.eggs_project_drafts"),"anon"),"42501");
  await rejected(hubActor(db,"alice",c=>c.query("select * from eggs_hub_private.project_audit"),"anon"),"42501");
 });
 await t.test("consumer metadata and legacy Poker operator role confer no editorial authority",async()=>{
  for(const user of ["alice","operator"]){assert.equal((await hubActor(db,user,c=>c.query("select public.eggs_hub_editor_role() role"))).rows[0].role,null);await rejected(save(db,user),"42501");}
  await rejected(hubActor(db,"alice",c=>c.query("insert into eggs_hub_private.editors values($1,'publisher',now())",[hubIds.alice])),"42501");
 });
 let draft;
 await t.test("editor creates a private draft but cannot publish or write public snapshots directly",async()=>{
  draft=await save(db,"editor");assert.equal(draft.version,1);
  assert.equal((await hubActor(db,"alice",c=>c.query("select * from public.eggs_project_drafts"))).rowCount,0);
  assert.equal((await hubActor(db,"alice",c=>c.query("select * from public.eggs_projects where id=$1",[draft.id]),"anon")).rowCount,0);
  await rejected(save(db,"editor",{id:draft.id,version:1,value:null,action:"publish"}),"42501");
  await rejected(hubActor(db,"publisher",c=>c.query("delete from public.eggs_projects")),"42501");
 });
 await t.test("publisher publishes exact saved revision with immutable audit",async()=>{
  draft=await save(db,"publisher",{id:draft.id,version:1,value:null,action:"publish"});
  assert.equal(draft.state,"published");assert.equal(draft.version,2);
  const published=await hubActor(db,"alice",c=>c.query("select content from public.eggs_projects where id=$1",[draft.id]),"anon");assert.deepEqual(published.rows[0].content,content);
  const audit=await hubActor(db,"editor",c=>c.query("select public.eggs_project_audit($1) audit",[draft.id]));assert.equal(audit.rows[0].audit.length,2);
  await rejected(hubActor(db,"publisher",c=>c.query("delete from eggs_hub_private.project_audit")),"42501");
  await rejected(hubActor(db,"alice",c=>c.query("select public.eggs_project_audit($1)",[draft.id])),"42501");
 });
 await t.test("draft edits do not change publication; stale previews fail atomically",async()=>{
  draft=await save(db,"editor",{id:draft.id,version:2,value:{...content,title:"Saved new title"}});
  assert.equal((await db.admin.query("select content->>'title' title from public.eggs_projects where id=$1",[draft.id])).rows[0].title,content.title);
  await rejected(save(db,"publisher",{id:draft.id,version:2,value:null,action:"publish"}),"40001");
  await rejected(save(db,"publisher",{id:draft.id,version:3,value:content,action:"publish"}),"22023");
 });
 await t.test("simultaneous publication has one winner and a real row-lock conflict",async()=>{
  const a=await db.connect(),b=await db.connect();await beginHubActor(a,"publisher");await beginHubActor(b,"publisher");
  const args=[draft.id,"local-test",null,3,"publish"];const query="select public.save_eggs_project($1,$2,$3,$4,$5)";
  try {
   await a.query(query,args);
   const pid=(await b.query("select pg_backend_pid() pid")).rows[0].pid;
   const pending=b.query(query,args).then(()=>({ok:true}),error=>({error}));
   let blocked=false;for(let i=0;i<80;i++){const row=(await db.admin.query("select wait_event_type from pg_stat_activity where pid=$1",[pid])).rows[0];if(row.wait_event_type==="Lock"){blocked=true;break;}await new Promise(r=>setTimeout(r,25));}
   assert.ok(blocked);await a.query("commit");assert.equal((await pending).error?.code,"40001");await b.query("rollback");
  }finally{await a.query("rollback");await b.query("rollback");await a.end();await b.end();}
  draft=(await db.admin.query("select * from public.eggs_project_drafts where id=$1",[draft.id])).rows[0];assert.equal(draft.version,4);
 });
 await t.test("DB rejects unsafe content, unknown fields, mutable slugs and forged public writes",async()=>{
  for(const value of [{...content,destination:"javascript:alert(1)"},{...content,destination:"https://user:secret@example.com"},{...content,destination:"//example.com"},{...content,admin:true},{...content,sort_order:-1},{...content,title:null},{...content,asset:"../secret.svg"}]) await rejected(save(db,"editor",{slug:"unsafe-project",value}),["23514","23502"]);
  await rejected(save(db,"editor",{id:draft.id,slug:"rename",version:4}),"22023");
 });
 let aliceProfile;
 await t.test("expression is private by default, owner-writable and hidden from editors/unrelated users",async()=>{
  aliceProfile=(await hubActor(db,"alice",c=>c.query("insert into public.eggs_profiles(handle,display_name) values('hub_alice','Alice') returning id"))).rows[0].id;
  await hubActor(db,"bob",c=>c.query("insert into public.eggs_profiles(handle,display_name) values('hub_bob','Bob')"));
  await hubActor(db,"alice",c=>c.query("select public.save_eggs_expression($1,'player',$2,'My favorite place','sky')",[[bootstrapProjects[0].id],bootstrapProjects[0].id]));
  assert.equal((await hubActor(db,"alice",c=>c.query("select * from public.eggs_profile_expression"))).rowCount,1);
  for(const user of ["bob","editor","publisher"]) assert.equal((await hubActor(db,user,c=>c.query("select * from public.eggs_profile_expression"))).rowCount,0);
  assert.equal((await hubActor(db,"alice",c=>c.query("select * from public.eggs_profile_expression"),"anon")).rowCount,0);
  assert.equal((await hubActor(db,"bob",c=>c.query("update public.eggs_profile_expression set featured_note='stolen' where profile_id=$1",[aliceProfile]))).rowCount,0);
  await rejected(hubActor(db,"alice",c=>c.query("update public.eggs_profile_expression set profile_id=gen_random_uuid()")),"42501");
 });
 await t.test("public visibility is explicit and reversible, with bounded curated expression",async()=>{
  await hubActor(db,"alice",c=>c.query("update public.eggs_profiles set visibility='public' where id=$1",[aliceProfile]));
  assert.equal((await hubActor(db,"bob",c=>c.query("select * from public.eggs_profile_expression"),"anon")).rowCount,1);
  await hubActor(db,"alice",c=>c.query("update public.eggs_profiles set visibility='private' where id=$1",[aliceProfile]));
  assert.equal((await hubActor(db,"bob",c=>c.query("select * from public.eggs_profile_expression"),"anon")).rowCount,0);
  for(const favorites of [[bootstrapProjects[0].id,bootstrapProjects[0].id],[hubIds.bob],[null]]) await rejected(hubActor(db,"alice",c=>c.query("select public.save_eggs_expression($1,'',null,'','sage')",[favorites])),"23514");
  await rejected(hubActor(db,"alice",c=>c.query("select public.save_eggs_expression('{}','verified champion',null,'','sage')")),"23514");
 });
 await t.test("archiving removes public snapshot but preserves audit; hidden favorites cannot be newly selected",async()=>{
  await save(db,"publisher",{id:draft.id,version:4,value:null,action:"archive"});
  assert.equal((await hubActor(db,"bob",c=>c.query("select * from public.eggs_projects where id=$1",[draft.id]),"anon")).rowCount,0);
  await rejected(hubActor(db,"alice",c=>c.query("select public.save_eggs_expression($1,'',null,'','sage')",[[draft.id]])),"23514");
  assert.equal((await db.admin.query("select count(*)::int n from eggs_hub_private.project_audit where project_id=$1",[draft.id])).rows[0].n,5);
 });
 await t.test("role revocation and session revocation are checked on every write",async()=>{
  await db.admin.query("delete from eggs_hub_private.editors where auth_user_id=$1",[hubIds.editor]);await rejected(save(db,"editor",{slug:"revoked-role"}),"42501");
  await db.admin.query("delete from auth.sessions where user_id=$1",[hubIds.publisher]);await rejected(save(db,"publisher",{slug:"revoked-session"}),"42501");
 });
 await t.test("account deletion cascades expression, preserves operator mapping and permanent handles",async()=>{
  await db.admin.query("delete from auth.users where id=$1",[hubIds.alice]);
  assert.equal((await db.admin.query("select count(*)::int n from public.eggs_profile_expression where profile_id=$1",[aliceProfile])).rows[0].n,0);
  assert.equal((await db.admin.query("select count(*)::int n from eggs_private.handle_registry where handle='hub_alice'")).rows[0].n,1);
  assert.equal((await db.admin.query("select count(*)::int n from public.profiles where auth_user_id=$1",[hubIds.operator])).rows[0].n,1);
  assert.deepEqual(await legacy(db),before);
 });
});
