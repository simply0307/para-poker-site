import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Default validation must never write to a remote database, even when a shell
// inherited integration-test credentials. The separate explicit opt-in command
// remains available for a reviewed, confirmed disposable database environment.
const tests = readdirSync("tests").filter(name => name.endsWith(".test.mjs")).sort().map(name => `tests/${name}`);
const result = spawnSync(process.execPath, ["--test", ...tests], {
  stdio: "inherit",
  windowsHide: true,
  env: { ...process.env, ALLOW_DESTRUCTIVE_IMPORT_INTEGRATION_TESTS: "false" },
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
