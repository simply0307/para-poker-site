import assert from "node:assert/strict";
import test from "node:test";
import { consumerConfiguration, profileInput, requireSameOrigin, readConsumerJson, databaseError } from "../src/lib/eggs/consumerCore.mjs";
import { runClaimRetention } from "../netlify/functions/_shared/claimRetention.mjs";

test("consumer origins and request allowlists fail closed", async () => {
  const env = { EGGS_CONSUMER_ENABLED:"true", SUPABASE_URL:"https://fixture.supabase.co", SUPABASE_PUBLISHABLE_KEY:"fixture", EGGS_SITE_URL:"https://eggs.example" };
  const config=consumerConfiguration(env); assert.equal(config.secure,true);
  for(const site of ["http://eggs.example","https://user:password@eggs.example","https://eggs.example/path","https://eggs.example?next=evil"]) assert.equal(consumerConfiguration({...env,EGGS_SITE_URL:site}),null);
  assert.equal(consumerConfiguration({...env,EGGS_CONSUMER_ENABLED:"false"}),null);
  assert.throws(()=>requireSameOrigin(new Request("https://eggs.example/api",{method:"POST"}),config),{status:403});
  for(const body of [{handle:"renamed"},{auth_user_id:"spoof"},{role:"owner"},{id:"spoof"},{avatar_path:"other/avatar.png"}]) assert.throws(()=>profileInput(body),{status:400});
  assert.deepEqual(profileInput({handle:"simple_user"},true),{handle:"simple_user",display_name:"simple_user"});
  assert.throws(()=>profileInput({handle:"CANONICAL"},true),{status:400});
  const huge=new Request("https://eggs.example/api",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({bio:"a".repeat(9000)})});
  await assert.rejects(()=>readConsumerJson(huge),{status:413});
  assert.equal(databaseError({code:"23505",message:"secret database details"}).status,409);
  assert.ok(!databaseError({code:"unexpected",message:"secret database details"}).message.includes("secret"));
});

test("scheduled retention is bounded, idempotent and fails visibly without logging claim data",async()=>{
  const calls=[]; const counts=[{redacted:500,withdrawn:2},{redacted:3,withdrawn:0}];
  const result=await runClaimRetention({client:{rpc:async(...args)=>{calls.push(args);return {data:counts.shift(),error:null};}}});
  assert.deepEqual(result,{redacted:503,withdrawn:2,batches:2});
  assert.deepEqual(calls,[["run_poker_claim_retention"],["run_poker_claim_retention"]]);
  assert.deepEqual(await runClaimRetention({client:{rpc:async()=>({data:{redacted:0,withdrawn:0}})}}),{redacted:0,withdrawn:0,batches:1});
  await assert.rejects(()=>runClaimRetention({}),/missing its server configuration/u);
  await assert.rejects(()=>runClaimRetention({client:{rpc:async()=>({error:{message:"private evidence"}})}}),error=>!error.message.includes("private evidence"));
  await assert.rejects(()=>runClaimRetention({client:{rpc:async()=>({data:{redacted:500,withdrawn:0}})},maxBatches:2}),/batch limit/u);
});
