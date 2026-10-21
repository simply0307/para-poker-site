// Loopback test adapter: real disposable PostgreSQL/RLS, simulated Supabase Auth
// and PostgREST transport. Never accepts a remote database or real credentials.
import { hubDatabase,hubIds } from "./hubDatabase.mjs";
import { consumerFixture,fixturePublishableKey,fixtureServiceKey } from "./consumerHttpFixture.mjs";
export async function hubHttpFixture(t){
 const db=await hubDatabase(t);await db.apply();const seen=new Set();
 const fixture=await consumerFixture({restHandler:async({url,body,request,user,active,token,send,fail})=>{
  const claims=user?JSON.parse(Buffer.from(token.split(".")[1],"base64url").toString()):{role:"anon"};
  if(user && active && !seen.has(token)){await db.admin.query("insert into auth.sessions(id,user_id) values($1,$2)",[claims.session_id,user.id]);seen.add(token);}
  if(user && !active)await db.admin.query("delete from auth.sessions where id=$1",[claims.session_id]);
  const c=await db.connect();await c.query("begin");await c.query(user?"set local role authenticated":"set local role anon");await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims)]);
  async function finish(sql,args=[],scalar=false){
   const {rows}=await c.query(sql,args);await c.query("commit");
   if(scalar)send(rows[0]?.value??null);
   else if((request.headers.accept||"").includes("vnd.pgrst.object")) rows.length===1?send(rows[0]):fail("PGRST116",406);
   else send(rows);
   return true;
  }
  const name=url.pathname.split("/").at(-1);const eq=key=>url.searchParams.get(key)?.replace(/^eq\./u,"");
  try{
   if(url.pathname.includes("/rpc/")){
    if(name==="is_eggs_session_active")return await finish("select public.is_eggs_session_active() value",[],true);
    if(name==="get_my_eggs_profile")return await finish("select * from public.get_my_eggs_profile()");
    if(name==="eggs_hub_editor_role")return await finish("select public.eggs_hub_editor_role() value",[],true);
    if(name==="save_eggs_project")return await finish("select public.save_eggs_project($1,$2,$3,$4,$5) value",[body.p_id,body.p_slug,body.p_content,body.p_version,body.p_action],true);
    if(name==="eggs_project_audit")return await finish("select public.eggs_project_audit($1) value",[body.p_id],true);
    if(name==="save_eggs_expression")return await finish("select public.save_eggs_expression($1,$2,$3,$4,$5) value",[body.p_favorites,body.p_affiliation,body.p_pin,body.p_note,body.p_accent],true);
   }
   if(name==="eggs_projects")return await finish("select * from public.eggs_projects order by slug");
   if(name==="eggs_project_drafts")return await finish("select * from public.eggs_project_drafts where ($1::uuid is null or id=$1) order by updated_at desc limit 100",[eq("id")||null]);
   if(name==="eggs_profile_expression")return await finish("select * from public.eggs_profile_expression where profile_id=$1",[eq("profile_id")]);
   if(name==="eggs_public_profiles")return await finish("select * from public.eggs_public_profiles where handle=$1",[eq("handle")]);
   if(name==="para_poker_profile_links"||name==="para_poker_public_profile_links")return await finish("select profile_id,player_id"+(name==="para_poker_profile_links"?",show_on_profile":"")+" from public."+name+" where profile_id=$1",[eq("profile_id")]);
   if(name==="eggs_profiles"){
    if(request.method==="POST")return await finish("insert into public.eggs_profiles(handle,display_name,bio,visibility) values($1,$2,$3,$4) returning id,handle,display_name,bio,avatar_path,visibility,created_at,updated_at",[body.handle,body.display_name,body.bio||"",body.visibility||"private"]);
    if(request.method==="PATCH")return await finish("update public.eggs_profiles set display_name=coalesce($1,display_name),bio=coalesce($2,bio),visibility=coalesce($3,visibility) where id=$4 returning id,handle,display_name,bio,avatar_path,visibility,created_at,updated_at",[body.display_name,body.bio,body.visibility,eq("id")]);
   }
   await c.query("rollback");return false;
  }catch(e){await c.query("rollback");fail(e.code,e.code==="42501"?403:400);return true;}finally{await c.end();}
 }});
 for(const [name,id] of Object.entries(hubIds))fixture.users.set(name+"@fixture.invalid",{id,email:name+"@fixture.invalid",email_confirmed_at:"2026-09-01T00:00:00Z",is_anonymous:false,user_metadata:{role:"publisher"}});
 t.after(()=>fixture.close());
 return {...fixture,db,env:{EGGS_HUB_ENABLED:"true",SUPABASE_URL:fixture.url,SUPABASE_PUBLISHABLE_KEY:fixturePublishableKey,SUPABASE_SERVICE_ROLE_KEY:fixtureServiceKey}};
}
