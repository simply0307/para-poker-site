import fs from "node:fs";
import assert from "node:assert/strict";
import { localPostgres } from "./localPostgres.mjs";
export const hubIds={publisher:"b0000000-0000-4000-8000-000000000001",editor:"b0000000-0000-4000-8000-000000000002",alice:"b0000000-0000-4000-8000-000000000003",bob:"b0000000-0000-4000-8000-000000000004",operator:"b0000000-0000-4000-8000-000000000005"};
export const hubMigration=fs.readFileSync("supabase/migrations/20261016030028_eggs_hub_catalog_expression.sql","utf8");
export async function hubDatabase(t){
 const cluster=await localPostgres(t);
 await cluster.admin.query("create role anon; create role authenticated; create role service_role bypassrls; grant anon,authenticated,service_role to postgres; set role postgres");
 await cluster.admin.query("create database hub_test");
 const admin=await cluster.connect("hub_test");
 await admin.query(fs.readFileSync("tests/database/eggs-identity-live-schema.sql","utf8").replace(/^create role [^;]+;\r?\n/gmu,""));
 await admin.query(fs.readFileSync("supabase/migrations/20260922231308_eggs_consumer_identity_reviewed_claims.sql","utf8"));
 for(const [name,id] of Object.entries(hubIds)) {
  await admin.query("insert into auth.users(id,email,email_confirmed_at,is_anonymous) values($1,$2,now(),false)",[id,name+"@fixture.invalid"]);
  await admin.query("insert into auth.sessions(id,user_id) values($1,$1)",[id]);
 }
 await admin.query("insert into public.profiles(email,identity_user_id,auth_user_id,role) values('operator@fixture.invalid','legacy-hub-fixture',$1,'owner')",[hubIds.operator]);
 return {...cluster,admin,bootstrap:cluster.admin,connect:()=>cluster.connect("hub_test"),async apply(){await admin.query(hubMigration);await admin.query("insert into eggs_hub_private.editors(auth_user_id,role) values($1,'publisher'),($2,'editor')",[hubIds.publisher,hubIds.editor]);}};
}
export async function beginHubActor(client,user="alice",role="authenticated"){
 assert.ok(["anon","authenticated","service_role"].includes(role));
 await client.query("begin");await client.query("set local role "+role);
 await client.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:hubIds[user],session_id:hubIds[user],role,user_metadata:{role:"publisher"}})]);
}
export async function hubActor(db,user,work,role="authenticated"){
 const c=await db.connect();try{await beginHubActor(c,user,role);const result=await work(c);await c.query("commit");return result;}catch(e){await c.query("rollback");throw e;}finally{await c.end();}
}
export const rejected=(operation,codes)=>assert.rejects(operation,e=>{assert.ok([codes].flat().includes(e.code),e.code+": "+e.message);return true;});
