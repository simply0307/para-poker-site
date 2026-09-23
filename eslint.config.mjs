import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  { files: ["netlify/**/*.mts"], languageOptions: { ecmaVersion: "latest", sourceType: "module" } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".reference/**",
    "artifacts/**",
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "gauntlet-online/**",
    "gauntlet-auth-hardening-worktree/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
