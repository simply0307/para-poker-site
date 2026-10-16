// Real PostgREST 16.4, bound only to loopback. Auth tokens are synthetic test JWTs.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createHmac, randomBytes } from "node:crypto";
import net from "node:net";
import path from "node:path";
import fs from "node:fs";
import assert from "node:assert/strict";
import { postgresBin } from "./localPostgres.mjs";
import { hubIds } from "./hubDatabase.mjs";
export const postgrestBin =
  process.env.EGGS_TEST_POSTGREST_BIN ||
  path.resolve(".reference/postgrest-16.4/postgrest.exe");
export const hasPostgrest = fs.existsSync(postgrestBin);
export async function localPostgrest(t, db) {
  const password = randomBytes(24).toString("hex"),
    secret = randomBytes(40).toString("hex");
  await db.bootstrap.query(
    "reset role; create role room_rest login noinherit password '" +
      password +
      "'; grant anon,authenticated to room_rest; set role postgres",
  );
  const reservation = net.createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise((r) => reservation.close(r));
  const config = db.admin.connectionParameters;
  const server = spawn(postgrestBin, [], {
    windowsHide: true,
    env: {
      ...process.env,
      PATH: postgresBin + path.delimiter + process.env.PATH,
      PGRST_DB_URI:
        "postgres://room_rest:" +
        password +
        "@127.0.0.1:" +
        config.port +
        "/hub_test",
      PGRST_DB_SCHEMAS: "public",
      PGRST_DB_ANON_ROLE: "anon",
      PGRST_JWT_SECRET: secret,
      PGRST_SERVER_HOST: "127.0.0.1",
      PGRST_SERVER_PORT: String(port),
      PGRST_DB_POOL: "4",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  server.stdout.on("data", (b) => (logs += b));
  server.stderr.on("data", (b) => (logs += b));
  t.after(async () => {
    if (server.exitCode === null) {
      const closed = once(server, "close");
      server.kill();
      await closed;
    }
  });
  const url = "http://127.0.0.1:" + port;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    assert.equal(server.exitCode, null, logs);
    try {
      if ((await fetch(url + "/eggs_projects?select=id")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready, logs);
  const sign = (claims) => {
    const input =
      Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
        "base64url",
      ) +
      "." +
      Buffer.from(
        JSON.stringify({
          exp: Math.floor(Date.now() / 1000) + 3600,
          ...claims,
        }),
      ).toString("base64url");
    return (
      input +
      "." +
      createHmac("sha256", secret).update(input).digest("base64url")
    );
  };
  const token = (user) =>
    sign({
      role: "authenticated",
      sub: hubIds[user],
      session_id: hubIds[user],
    });
  const request = (
    endpoint,
    { user, method = "GET", body, headers = {} } = {},
  ) =>
    fetch(url + endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(user ? { Authorization: "Bearer " + token(user) } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  return { url, request, token, sign };
}
