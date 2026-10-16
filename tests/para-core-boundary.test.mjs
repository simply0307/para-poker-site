import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { paraCorePorts,pokerBoundary } from "../src/modules/para-core/contracts.mjs";
test("Para Core remains a contract; Hub repositories cannot reach privileged Poker data",()=>{
 assert.equal(pokerBoundary.publicRoot,"/para/poker");assert.ok(paraCorePorts.includes("resultApproval"));assert.ok(pokerBoundary.owns.includes("hands"));
 for(const file of fs.readdirSync("src/lib/hub")){const source=fs.readFileSync(path.join("src/lib/hub",file),"utf8");assert.doesNotMatch(source,/SUPABASE_SERVICE_ROLE_KEY|from\(["']profiles["']\)|modules\/para-poker\/lib/u);}
});
