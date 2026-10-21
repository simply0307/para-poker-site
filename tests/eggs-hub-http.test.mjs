import test from "node:test";
import assert from "node:assert/strict";
import { hasPostgres } from "./helpers/localPostgres.mjs";
import { hubHttpFixture } from "./helpers/hubHttpFixture.mjs";
import { startConsumerApp,stopConsumerApp,CookieJar } from "./helpers/consumerHttpFixture.mjs";
import { bootstrapProjects } from "../src/lib/hub/catalog.mjs";
test("built Hub journeys with real local PostgreSQL and simulated Auth/PostgREST transport",{skip:!hasPostgres,timeout:180000},async t=>{
 const fixture=await hubHttpFixture(t);let app=await startConsumerApp(fixture.env);t.after(()=>stopConsumerApp(app));
 async function request(path,{jar,body,method="GET",origin=app.base}={}){
  const res=await fetch(app.base+path,{method,redirect:"manual",headers:{Origin:origin,...(body?{"Content-Type":"application/json"}:{}),...(jar?{Cookie:jar.header()}:{})},...(body?{body:JSON.stringify(body)}:{})});jar?.absorb(res);return res;
 }
 async function login(name){const jar=new CookieJar();const response=await request("/api/eggs/auth",{jar,method:"POST",body:{action:"login",email:name+"@fixture.invalid",password:"fixture-password"}});assert.equal(response.status,200,await response.text());return jar;}
 const publisher=await login("publisher"),editor=await login("editor"),alice=await login("alice"),bob=await login("bob"),operator=await login("operator");
 await t.test("anonymous visitor discovers stable showcases and official destinations",async()=>{
  const home=await request("/");assert.equal(home.status,200);assert.match(await home.text(),/Discover the projects/u);
  for(const project of bootstrapProjects){const page=await request("/projects/"+project.slug);if(project.slug==="reath-digest"){assert.equal(page.status,308);assert.equal(page.headers.get("location"),"/reath-digest");const reader=await request("/reath-digest");assert.equal(reader.status,200);assert.match(await reader.text(),/Reath Funnies/u);}else{assert.equal(page.status,200);assert.ok((await page.text()).includes(project.content.destination));}}
  assert.equal((await request("/projects/unknown-project")).status,404);
  assert.match(await (await request("/projects?category=world")).text(),/Nothing published/u);
 });
 const content={...bootstrapProjects[1].content,title:"Local HTTP showcase",summary:"A safe local draft",description:"Only disposable records.",destination:"https://example.com"};
 let project;
 await t.test("server editorial authorization, CSRF and validation fail closed",async()=>{
  const command={slug:"local-http",content,version:0,action:"save"};
  assert.equal((await request("/api/eggs/hub/projects",{method:"POST",body:command})).status,401);
  for(const jar of [alice,bob,operator])assert.equal((await request("/api/eggs/hub/projects",{jar,method:"POST",body:command})).status,403);
  assert.equal((await request("/api/eggs/hub/projects",{jar:publisher,origin:"https://evil.invalid",method:"POST",body:command})).status,403);
  assert.equal((await request("/api/eggs/hub/projects",{jar:publisher,method:"POST",body:{...command,content:{...content,destination:"javascript:alert(1)"}}})).status,400);
  const create=await request("/api/eggs/hub/projects",{jar:editor,method:"POST",body:command});assert.equal(create.status,201,await create.clone().text());project=(await create.json()).project;
 });
 await t.test("private preview, publication, version conflict and public refresh",async()=>{
  const preview="/eggs-admin/projects/"+project.id+"/preview";
  assert.equal((await request("/projects/local-http")).status,404);
  assert.equal((await request(preview)).status,307);
  assert.ok(!(await (await request(preview,{jar:alice})).text()).includes("Local HTTP showcase"));
  assert.match(await (await request(preview,{jar:editor})).text(),/A publisher must approve/u);
  assert.match(await (await request(preview,{jar:publisher})).text(),/Publish this revision/u);
  const command={id:project.id,slug:project.slug,version:1,action:"publish"};
  assert.equal((await request("/api/eggs/hub/projects",{jar:editor,method:"POST",body:command})).status,403);
  const publish=await request("/api/eggs/hub/projects",{jar:publisher,method:"POST",body:command});assert.equal(publish.status,200,await publish.clone().text());
  assert.equal((await request("/api/eggs/hub/projects",{jar:publisher,method:"POST",body:command})).status,409);
  assert.match(await (await request("/projects/local-http")).text(),/Local HTTP showcase/u);
  assert.match(await (await request("/projects")).text(),/Local HTTP showcase/u);
 });
 await t.test("published catalog survives an application process restart",async()=>{
  await stopConsumerApp(app);app=await startConsumerApp(fixture.env);
  assert.match(await (await request("/projects/local-http")).text(),/Local HTTP showcase/u);
 });
 await t.test("owner expression, private/public previews and unrelated-user denial",async()=>{
  assert.equal((await request("/api/eggs/profile",{jar:alice,method:"POST",body:{handle:"hub_alice",display_name:"Local Alice",bio:"Only my profile"}})).status,201);
  assert.equal((await request("/api/eggs/profile",{jar:bob,method:"POST",body:{handle:"hub_bob"}})).status,201);
  const expression={favorite_project_ids:[bootstrapProjects[0].id,project.id],affiliation:"reader",pinned_project_id:bootstrapProjects[1].id,featured_note:"A personal <script>note</script>",accent:"amber"};
  const save=await request("/api/eggs/expression",{jar:alice,method:"PUT",body:expression});assert.equal(save.status,200,await save.clone().text());
  assert.equal((await request("/profile/hub_alice")).status,404);
  assert.equal((await request("/profile/hub_alice",{jar:bob})).status,404);
  const own=await request("/profile",{jar:alice});assert.match(await own.text(),/Only you can see this preview/u);
  assert.equal((await request("/api/eggs/expression",{jar:bob,method:"PUT",body:{...expression,profile_id:(await save.json()).expression.profile_id}})).status,400);
  const visible=await request("/api/eggs/profile",{jar:alice,method:"PATCH",body:{display_name:"Alice — local preview",bio:"Here for games, good stories and the next interesting idea.",visibility:"public"}});
  assert.equal(visible.status,200,await visible.clone().text());
  // The rollback reader deliberately excludes expression. Rooms use the new narrow projection.
  const html=await (await request("/profile/hub_alice")).text();assert.match(html,/Alice — local preview/u);assert.doesNotMatch(html,/Gauntlet Online|featured_note/u);assert.ok(!html.includes("<script>note</script>"));
  assert.equal((await request("/api/eggs/profile",{jar:alice,method:"PATCH",body:{visibility:"private"}})).status,200);
  assert.equal((await request("/profile/hub_alice")).status,404);
 });
 await t.test("archive updates catalog immediately; logout denies editorial writes",async()=>{
  assert.equal((await request("/api/eggs/hub/projects",{jar:publisher,method:"POST",body:{id:project.id,slug:project.slug,version:2,action:"archive"}})).status,200);
  assert.equal((await request("/projects/local-http")).status,404);
  assert.equal((await request("/api/eggs/profile",{jar:alice,method:"PATCH",body:{visibility:"public"}})).status,200);
  assert.ok(!(await (await request("/profile/hub_alice")).text()).includes("Local HTTP showcase"));
  assert.equal((await request("/api/eggs/auth/logout",{jar:publisher,method:"POST"})).status,200);
  assert.equal((await request("/api/eggs/hub/projects",{jar:publisher,method:"POST",body:{slug:"signed-out",content,version:0,action:"save"}})).status,401);
 });
});
