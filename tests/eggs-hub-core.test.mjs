import test from "node:test";
import assert from "node:assert/strict";
import { bootstrapProjects } from "../src/lib/hub/catalog.mjs";
import { projectContent,projectCommand,expressionInput,safeLink } from "../src/lib/hub/core.mjs";
test("catalog validation admits approved facts and blocks executable links/unknown fields",()=>{
 for(const p of bootstrapProjects) assert.deepEqual(projectContent(p.content),p.content);
 for(const url of ["javascript:alert(1)","data:text/html,x","//evil.invalid","https://name:password@example.com","https://example.com/?access_token=private","/admin","/para/poker/../admin"]) assert.equal(safeLink(url),false,url);
 assert.throws(()=>projectContent({...bootstrapProjects[0].content,html:"<script>"}));
 assert.throws(()=>projectContent({...bootstrapProjects[0].content,featured:"yes"}));
 assert.throws(()=>projectCommand({slug:"demo",id:null,action:"publish",version:0}));
});
test("expression allows only bounded curated choices and never accepts owner identifiers",()=>{
 const value={favorite_project_ids:[bootstrapProjects[0].id],affiliation:"reader",pinned_project_id:null,featured_note:"A note",accent:"sage"};
 assert.equal(expressionInput(value).p_favorites.length,1);
 for(const input of [{...value,auth_user_id:"another"},{...value,affiliation:"verified winner"},{...value,accent:"url(evil)"},{...value,featured_note:"a".repeat(161)},{...value,favorite_project_ids:Array(6).fill(bootstrapProjects[0].id)}]) assert.throws(()=>expressionInput(input));
});
