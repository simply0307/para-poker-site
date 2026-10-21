// Security advisors for an independently initialized disposable community database.
// No hosted URL, linked project, service-role token, or user input is accepted.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { communityDatabase } from "../tests/helpers/communityDatabase.mjs";

const cli = process.env.EGGS_TEST_SUPABASE_CLI;
if (!cli || !path.isAbsolute(cli) || !fs.existsSync(cli))
  throw new Error(
    "Set EGGS_TEST_SUPABASE_CLI to an existing absolute local CLI script.",
  );
const environment = {
  ...process.env,
  DO_NOT_TRACK: "1",
  SUPABASE_TELEMETRY_DISABLED: "true",
};
const options = {
  encoding: "utf8",
  windowsHide: true,
  timeout: 60000,
  env: environment,
};
const version = spawnSync(process.execPath, [cli, "--version"], options);
if (version.status !== 0 || !/^\d+\.\d+\.\d+/u.test(version.stdout.trim()))
  throw new Error("Unable to verify the local Supabase CLI version.");
const cleanup = [];
try {
  const db = await communityDatabase({ after: (fn) => cleanup.push(fn) });
  const connection = db.admin.connectionParameters;
  if (connection.host !== "127.0.0.1" || connection.database !== "hub_test")
    throw new Error("Only disposable loopback hub_test is permitted.");
  const databaseUrl =
    "postgresql://" +
    encodeURIComponent(connection.user) +
    ":" +
    encodeURIComponent(connection.password) +
    "@127.0.0.1:" +
    connection.port +
    "/hub_test?sslmode=disable";
  const sanitize = (text) =>
    String(text || "")
      .replaceAll(databaseUrl, "[disposable loopback database URL]")
      .replaceAll(connection.password, "[redacted]")
      .replace(/postgres(?:ql)?:\/\/[^\s"']+/gu, "[redacted database URL]");
  // These flags were checked against current `db advisors --help` (CLI 2.117.0).
  const result = spawnSync(
    process.execPath,
    [
      cli,
      "db",
      "advisors",
      "--db-url",
      databaseUrl,
      "--type",
      "security",
      "--level",
      "warn",
      "--fail-on",
      "none",
      "--output",
      "json",
      "--output-format",
      "json",
    ],
    options,
  );
  const stdout = sanitize(result.stdout),
    stderr = sanitize(result.stderr);
  const metadata = {
    target: "independent disposable loopback PostgreSQL 17 / hub_test",
    hosted: false,
    cliVersion: version.stdout.trim(),
    telemetryDisabled: true,
    command:
      "supabase db advisors --db-url [disposable loopback URL] --type security --level warn --fail-on none --output json --output-format json",
    exitCode: result.status,
    noIssuesReported:
      result.status === 0 && /No issues found/iu.test(stdout + stderr),
    stdout,
    stderr,
    ...(result.error ? { error: sanitize(result.error.message) } : {}),
  };
  fs.mkdirSync(".reference", { recursive: true });
  fs.writeFileSync(
    ".reference/community-advisors.json",
    JSON.stringify(metadata, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        cliVersion: metadata.cliVersion,
        exitCode: metadata.exitCode,
        noIssuesReported: metadata.noIssuesReported,
        outputFile: ".reference/community-advisors.json",
      },
      null,
      2,
    ),
  );
  process.exitCode = result.status ?? 1;
} finally {
  for (const fn of cleanup.reverse()) await fn();
}
