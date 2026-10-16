// Explicit local preview only: disposable PostgreSQL + simulated Auth/PostgREST.
import { hubHttpFixture } from "../tests/helpers/hubHttpFixture.mjs";
import { startConsumerApp,stopConsumerApp } from "../tests/helpers/consumerHttpFixture.mjs";
import { hasPostgres } from "../tests/helpers/localPostgres.mjs";
if(!hasPostgres)throw new Error("Set EGGS_TEST_POSTGRES_BIN to local PostgreSQL 17 binaries.");
const cleanup=[];const t={after(fn){cleanup.push(fn);}};
const fixture=await hubHttpFixture(t);
const app=await startConsumerApp(fixture.env,3113);
cleanup.push(()=>stopConsumerApp(app));
console.log("Local Hub preview: "+app.base);
console.log("Disposable users: publisher@fixture.invalid, editor@fixture.invalid, alice@fixture.invalid, bob@fixture.invalid. Password: fixture-password");
console.log("Type stop and Enter to remove the disposable database and stop the preview.");
let stopping=false;
async function stop(){if(stopping)return;stopping=true;for(const fn of cleanup.reverse())await fn();process.exit(0);}
process.on("SIGINT",stop);process.on("SIGTERM",stop);
process.stdin.setEncoding("utf8");process.stdin.on("data",text=>{if(text.trim()==="stop")void stop();});process.stdin.resume();
