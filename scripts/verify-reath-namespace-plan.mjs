// Local design rehearsal only. This does not generate or apply a production
// migration, seed a hosted project, or modify the source Reath checkout.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const source = process.argv[2];
assert.ok(source, "Usage: node scripts/verify-reath-namespace-plan.mjs <existing Reath checkout>");
const root = await fs.realpath(source);
const requireSource = createRequire(path.join(root, "package.json"));
const checkPath = path.join(root, "scripts/reath-database-check.mjs");
let check = await fs.readFile(checkPath, "utf8");
const hashes = { "scripts/reath-database-check.mjs": createHash("sha256").update(check).digest("hex") };
const sqlFiles = (await fs.readdir(path.join(root, "supabase/migrations"))).filter(name => name.endsWith(".sql"));
for (const name of sqlFiles) hashes[`supabase/migrations/${name}`] = createHash("sha256").update(await fs.readFile(path.join(root, "supabase/migrations", name))).digest("hex");

// Use only the source project's existing embedded checks; discard its optional
// live-DB inspection before evaluating anything. No credentials are accepted.
const cutoff = check.indexOf("\nconst url = process.env.SUPABASE_URL;");
assert.ok(cutoff > check.indexOf("await runEmbeddedDatabaseChecks();"));
check = check.slice(0, cutoff);
check = check.replace('import { readFile } from "node:fs/promises";', 'import { readFile as originalReadFile } from "node:fs/promises";');
check = check.replace('import { createClient } from "@supabase/supabase-js";\n', "");
check = check.replace('import { deriveSupabaseProjectRef } from "../netlify/functions/lib/runtime-contract.mjs";\n', "");
check = check.replace('import { PGlite } from "@electric-sql/pglite";', `import { createRequire } from "node:module"; const sourceRequire = createRequire(${JSON.stringify(path.join(root,"package.json"))}); const { PGlite } = sourceRequire("@electric-sql/pglite");`);
check = check.replace('import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";', 'const { pgcrypto } = sourceRequire("@electric-sql/pglite/contrib/pgcrypto");');
requireSource.resolve("@electric-sql/pglite/contrib/pgcrypto");
check = check.replace('const directory = path.dirname(fileURLToPath(import.meta.url));', `const directory = ${JSON.stringify(path.join(root,"scripts"))};`);
check = check.replaceAll("public\\\\.", "reath\\\\.").replaceAll("public\\.", "reath\\.").replaceAll("public.", "reath.").replaceAll("'public'", "'reath'").replaceAll("service_role", "reath_runtime");
assert.doesNotMatch(check, /createClient\(|process\.env|fetch\(/, "Embedded rehearsal must have no live network path");

const namespaceSql = sql => sql
  .replace(/drop schema if exists public cascade;\s*create schema public;/i, "create schema reath;")
  .replace(/\bpublic\./g, "reath.")
  .replace(/\bschema public\b/gi, "schema reath")
  .replace(/pg_catalog, public\b/g, "pg_catalog, reath")
  .replace(/\bservice_role\b/g, "reath_runtime");
const wrapper = `
process.on('uncaughtException', error => { console.error(JSON.stringify({name:error.name,message:error.message,code:error.code,detail:error.detail})); process.exit(1); });
const readFile = async (...args) => {
  const value = await originalReadFile(...args);
  if (!String(args[0]).endsWith('.sql')) return value;
  const transformed = (${namespaceSql.toString()})(value);
  assert.doesNotMatch(transformed, /drop schema/i, 'Never reset a schema in the namespaced rehearsal');
  assert.doesNotMatch(transformed, /\\bpublic\\./, 'Unexpected dependency on legacy public objects');
  return transformed;
};
`;
const before = `
    await database.exec(\`
      create table public.players(id integer primary key, name text not null);
      create table public.profiles(id integer primary key, role text not null);
      create table public.eggs_profiles(id integer primary key, handle text not null);
      insert into public.players values (1,'Preserved Poker player');
      insert into public.profiles values (1,'owner');
      insert into public.eggs_profiles values (1,'preserved_handle');
      create function public.set_updated_at() returns trigger language plpgsql as $$ begin return new; end; $$;
      revoke all on all tables in schema public from public, anon, authenticated, reath_runtime;
      create role gauntlet_runtime nologin;
    \`);
    const legacyFingerprint = async () => (await database.query(\`
      select (select jsonb_agg(to_jsonb(t)) from public.players t) players,
             (select jsonb_agg(to_jsonb(t)) from public.profiles t) profiles,
             (select jsonb_agg(to_jsonb(t)) from public.eggs_profiles t) eggs_profiles,
             pg_get_functiondef('public.set_updated_at()'::regprocedure) function_definition,
             (select jsonb_agg(jsonb_build_array(c.relname,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity) order by c.relname)
                from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r') metadata
    \`)).rows;
    const legacyBefore = await legacyFingerprint();
`;
assert.ok(check.includes("    await database.exec(migration);"));
check = check.replace("    await database.exec(migration);", () => before + "\n    await database.exec(migration);");
const isolate = `
    await database.exec(\`
      revoke all on schema reath from public, anon, authenticated, gauntlet_runtime;
      grant usage on schema reath to reath_runtime;
      do $$ declare r record; begin
        for r in select tablename from pg_tables where schemaname='reath' loop
          execute format('alter table reath.%I force row level security',r.tablename);
          execute format('create policy reath_runtime_access on reath.%I for all to reath_runtime using (true) with check (true)',r.tablename);
        end loop;
      end $$;
    \`);
`;
assert.ok(check.includes("    await database.exec(evidencePreservationMigration);"));
check = check.replace("    await database.exec(evidencePreservationMigration);", () => "    await database.exec(evidencePreservationMigration);\n" + isolate);
const after = `
    assert.deepEqual(await legacyFingerprint(), legacyBefore, 'Legacy rows, ACLs, RLS flags and colliding function must be unchanged');
    await database.exec('set role reath_runtime');
    const role = (await database.query("select rolsuper,rolbypassrls from pg_roles where rolname=current_user")).rows[0];
    assert.deepEqual(role,{rolsuper:false,rolbypassrls:false});
    assert.equal((await database.query('select count(*)::integer n from reath.sources')).rows[0].n,78);
    for (const sql of ['select * from public.players','select * from public.profiles','select * from public.eggs_profiles',"insert into public.players values(2,'Denied')"])
      await assert.rejects(database.query(sql), e => e.code==='42501');
    await database.exec('reset role');
    for (const role of ['anon','authenticated','gauntlet_runtime']) {
      await database.exec('set role '+role);
      await assert.rejects(database.query('select * from reath.sources'), e => e.code==='42501');
      await assert.rejects(database.query("select reath.reath_evidence_origin_key('Example','example')"), e => e.code==='42501');
      await database.exec('reset role');
    }
    assert.deepEqual(await legacyFingerprint(), legacyBefore);
    console.log('Namespace rehearsal passed: legacy sentinels preserved; scoped non-bypass Reath role works; anonymous, consumer and Gauntlet roles denied.');
`;
assert.ok(check.includes('    console.log("Embedded Postgres checks passed:'));
check = check.replace('    console.log("Embedded Postgres checks passed:', () => after + '\n    console.log("Embedded Postgres checks passed:');
const directory = await fs.mkdtemp(path.join(os.tmpdir(), "eggs-reath-namespace-"));
try {
  const file = path.join(directory,"rehearsal.mjs");
  await fs.writeFile(file,wrapper+check);
  const result = spawnSync(process.execPath,[file],{encoding:"utf8",windowsHide:true,timeout:120000,maxBuffer:1024*1024,env:{...process.env,SUPABASE_URL:"",SUPABASE_PROJECT_REF:"",SUPABASE_SERVICE_ROLE_KEY:"",SUPABASE_SECRET_KEY:""}});
  if(result.stdout)process.stdout.write(result.stdout);
  if(result.status!==0){process.stderr.write((result.stderr||result.error?.message||"Rehearsal failed").slice(0,7000));process.exitCode=1;}
  await fs.mkdir(".reference",{recursive:true});
  await fs.writeFile(".reference/reath-namespace-rehearsal.json",JSON.stringify({source:root,sourceHashes:hashes,exitCode:result.status,output:result.stdout,designOnly:true,remoteOperations:false},null,2)+"\n");
} finally {
  const resolved=await fs.realpath(directory);
  assert.equal(path.dirname(resolved).toLowerCase(),(await fs.realpath(os.tmpdir())).toLowerCase());
  assert.ok(path.basename(resolved).startsWith("eggs-reath-namespace-"));
  await fs.rm(resolved,{recursive:true,force:true});
}
