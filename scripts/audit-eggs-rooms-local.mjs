// Optional CLI advisors against a disposable database only; no linked/hosted target accepted.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { roomsDatabase } from "../tests/helpers/roomsDatabase.mjs";
const cli = process.env.EGGS_TEST_SUPABASE_CLI;
if (!cli)
  throw new Error("Set EGGS_TEST_SUPABASE_CLI to a local Supabase CLI script.");
const cleanup = [];
try {
  const db = await roomsDatabase({ after: (fn) => cleanup.push(fn) }),
    c = db.admin.connectionParameters;
  if (c.host !== "127.0.0.1" || c.database !== "hub_test")
    throw new Error("Disposable loopback database required.");
  const url =
    "postgresql://" +
    encodeURIComponent(c.user) +
    ":" +
    encodeURIComponent(c.password) +
    "@127.0.0.1:" +
    c.port +
    "/hub_test?sslmode=disable";
  const result = spawnSync(
    process.execPath,
    [
      cli,
      "db",
      "advisors",
      "--db-url",
      url,
      "--type",
      "security",
      "--level",
      "warn",
      "--fail-on",
      "none",
      "--output",
      "json",
    ],
    { encoding: "utf8", windowsHide: true, timeout: 60000 },
  );
  fs.mkdirSync(".reference", { recursive: true });
  fs.writeFileSync(
    ".reference/personal-advisors.json",
    JSON.stringify(
      {
        target: "disposable loopback PostgreSQL 17 / hub_test",
        exitCode: result.status,
        stdout: result.stdout || "",
        stderr: (result.stderr || "").replaceAll(c.password, "[redacted]"),
      },
      null,
      2,
    ) + "\n",
  );
  // Never echo database connection arguments or password.
  console.log(
    JSON.stringify(
      {
        exitCode: result.status,
        outputFile: ".reference/personal-advisors.json",
        stdoutBytes: (result.stdout || "").length,
        error: (result.stderr || "")
          .replaceAll(c.password, "[redacted]")
          .slice(0, 2000),
      },
      null,
      2,
    ),
  );
  process.exitCode = result.status ?? 1;
} finally {
  for (const fn of cleanup.reverse()) await fn();
}
