import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Default validation must never write to a remote database, even when a shell
// inherited integration-test credentials. The separate explicit opt-in command
// remains available for a reviewed, confirmed disposable database environment.
const tests = readdirSync("tests").filter(name => name.endsWith(".test.mjs")).sort().map(name => `tests/${name}`);
// Native PostgreSQL and multiple built Next servers are resource-heavy on local
// Windows workspaces. Bound file-level concurrency; the database scenarios still
// use independent simultaneous connections to test real lock contention.
const result = spawnSync(process.execPath, ["--test", "--test-concurrency=2", ...tests], {
  stdio: "inherit",
  windowsHide: true,
  env: { ...process.env, ALLOW_DESTRUCTIVE_IMPORT_INTEGRATION_TESTS: "false" },
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
