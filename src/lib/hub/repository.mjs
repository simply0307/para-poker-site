import { ConsumerError, databaseError } from "../eggs/consumerCore.mjs";
function result({data,error}) {
 if(error) { if (error.code==="40001") throw new ConsumerError(409,"This project changed. Reload before saving or publishing."); throw databaseError(error); }
 return data;
}
// Uses only the caller's publishable-key client and token. No filesystem/service fallback.
export function hubRepository(client) {
 return {
  async published() { return result(await client.from("eggs_projects").select("id,slug,content,version,published_at").order("slug")) || []; },
  async drafts() { return result(await client.from("eggs_project_drafts").select("id,slug,content,state,version,updated_at").order("updated_at",{ascending:false}).limit(100)) || []; },
  async draft(id) { return result(await client.from("eggs_project_drafts").select("id,slug,content,state,version,updated_at").eq("id",id).maybeSingle()); },
  async role() { return result(await client.rpc("eggs_hub_editor_role")); },
  async save(command) { return result(await client.rpc("save_eggs_project",command)); },
  async audit(id) { return result(await client.rpc("eggs_project_audit",{p_id:id})) || []; },
  async expression(id) { return result(await client.from("eggs_profile_expression").select("profile_id,favorite_project_ids,affiliation,pinned_project_id,featured_note,accent").eq("profile_id",id).maybeSingle()); },
  async saveExpression(input) { return result(await client.rpc("save_eggs_expression",input)); }
 };
}
export const orderProjects = projects => [...projects].sort((a,b)=>a.content.sort_order-b.content.sort_order||a.slug.localeCompare(b.slug));
