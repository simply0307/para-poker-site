import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import pg from "pg";

const executable = name => process.platform === "win32" ? `${name}.exe` : name;
export const postgresBin = process.env.EGGS_TEST_POSTGRES_BIN || (process.platform === "win32"
  ? path.resolve(".reference/pg17-tools/node_modules/@embedded-postgres/windows-x64/native/bin") : "");
export const hasPostgres = Boolean(postgresBin && fs.existsSync(path.join(postgresBin, executable("postgres"))));

export async function localPostgres(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "eggs-identity-pg-"));
  const data = path.join(root, "data");
  const password = randomBytes(32).toString("hex");
  const passwordFile = path.join(root, "password");
  fs.writeFileSync(passwordFile, password, { mode: 0o600 });
  let server;
  let logs = "";
  const clients = new Set();
  t.after(async () => {
    await Promise.allSettled([...clients].map(client => client.end()));
    if (server && server.exitCode === null) {
      const closed = once(server, "close");
      const stopped = spawnSync(path.join(postgresBin, executable("pg_ctl")), ["-D", data, "-m", "fast", "-w", "stop"], {
        windowsHide: true, encoding: "utf8", timeout: 15000,
      });
      if (stopped.status !== 0 && server.exitCode === null) server.kill();
      await closed;
    }
    // Delete only the exact temporary directory created by this test run.
    const resolved = fs.realpathSync(root);
    assert.equal(path.dirname(resolved).toLowerCase(), fs.realpathSync(os.tmpdir()).toLowerCase());
    assert.ok(path.basename(resolved).startsWith("eggs-identity-pg-"));
    // Windows can briefly retain directory handles after postgres exits.
    await fs.promises.rm(resolved, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  });
  const initialized = spawnSync(path.join(postgresBin, executable("initdb")), [
    "-D", data, "-U", "eggs_test_bootstrap", "--pwfile", passwordFile, "--auth-host=scram-sha-256",
    "--auth-local=scram-sha-256", "--locale=C", "--encoding=UTF8", "--no-instructions",
  ], { windowsHide: true, encoding: "utf8", timeout: 30000 });
  assert.equal(initialized.status, 0, initialized.stderr || initialized.error?.message);
  const reservation = net.createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  server = spawn(path.join(postgresBin, executable("postgres")), [
    "-D", data, "-h", "127.0.0.1", "-p", String(port), "-c", "max_connections=20",
  ], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", value => { logs += value; });
  server.stderr.on("data", value => { logs += value; });
  // No DATABASE_URL or remote project credentials are accepted by this helper.
  const config = { host: "127.0.0.1", port, user: "postgres", password, database: "postgres", connectionTimeoutMillis: 1000 };
  async function connect(database = "postgres", user = "postgres") {
    const client = new pg.Client({ ...config, database, user });
    await client.connect();
    clients.add(client);
    client.once("end", () => clients.delete(client));
    return client;
  }
  let admin;
  for (let attempt = 0; attempt < 100; attempt++) {
    assert.equal(server.exitCode, null, logs);
    try { admin = await connect("postgres", "eggs_test_bootstrap"); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  assert.ok(admin, logs);
  const { rows: [identity] } = await admin.query("select current_setting('data_directory') as directory, current_setting('server_version_num')::int as version");
  assert.equal(path.resolve(identity.directory).toLowerCase(), path.resolve(data).toLowerCase());
  assert.equal(Math.floor(identity.version / 10000), 17, "Use PostgreSQL 17 to match the audited database");
  // initdb's bootstrap user cannot lose SUPERUSER. A separate, non-superuser
  // postgres role mirrors the hosted migration owner and owns all test objects.
  assert.match(password, /^[a-f0-9]+$/u);
  await admin.query(`create role postgres login nosuperuser createdb createrole bypassrls password '${password}'`);
  return { admin, connect };
}
