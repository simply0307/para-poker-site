import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { canonicalPokerHref, legacyPokerRedirects } from "../src/modules/para-poker/routes.mjs";
import { sanitizeRichText } from "../src/modules/para-poker/lib/newsroom/richText.js";
import { sourceFiles, apiInventory, requiresOperator } from "./helpers/routeInventory.mjs";

test("shared authentication and shell components contain no league role or service-client dependency", async () => {
  const files = [...await sourceFiles("src/lib"), ...await sourceFiles("src/components/eggs")];
  for (const filename of files) {
    const source = await readFile(filename, "utf8");
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|para_league_operator|requireOperator\s*\(|@\/modules\/para-poker|\.from\(["']profiles["']\)/u, filename);
  }
});

test("every current API belongs to Para Poker and its exported methods have an operator boundary", async () => {
  const entries = await apiInventory();
  assert.ok(entries.length > 40, "Expected full API inventory");
  for (const entry of entries) {
    assert.ok(entry.filename.includes(`${path.sep}(para-poker)${path.sep}`), entry.filename);
    const source = await readFile(entry.filename, "utf8");
    const body = source.slice(source.indexOf(`export async function ${entry.method}(`));
    if (requiresOperator(entry)) {
      const guard = body.match(new RegExp(`^export async function ${entry.method}\\([^)]*\\) \\{\\s*(?://[^\\n]*\\n\\s*)*const (\\w+) = await requireOperator\\([^;]*\\);\\s*if \\(!\\1\\.ok\\) return \\1\\.response;`));
      assert.ok(guard, `${entry.route} ${entry.method} must reject before any other work`);
    }
  }
});

test("code and settings emit canonical public links without relying on legacy redirects", async () => {
  const files = [...await sourceFiles("src"), ...await sourceFiles("newsroom-library")];
  for (const filename of files.filter(name => /\.(?:js|jsx|mjs|json)$/u.test(name))) {
    const source = await readFile(filename, "utf8");
    assert.doesNotMatch(source, /["'`]\/(?:sessions|players|standings|moments|articles)(?=\/|[?#"'`])/u, filename);
  }
});

test("legacy redirect families stay temporary and point directly to their canonical destination", () => {
  assert.equal(legacyPokerRedirects.length, 5);
  for (const section of ["sessions", "players", "standings", "moments", "articles"]) {
    assert.deepEqual(legacyPokerRedirects.find(rule => rule.source === `/${section}/:path*`), {
      source: `/${section}/:path*`, destination: `/para/poker/${section}/:path*`, permanent: false,
    });
  }
});

test("rich-text league links become canonical with identifiers, queries and hand anchors preserved", () => {
  for (const section of ["sessions", "players", "standings", "moments", "articles"]) {
    for (const suffix of ["", "/some%20id?season=S0#hand-7", "?season=S0", "#record"]) {
      const input = `/${section}${suffix}`;
      const expected = `/para/poker${input}`;
      assert.equal(canonicalPokerHref(input), expected);
      assert.equal(canonicalPokerHref(expected), expected);
      assert.match(sanitizeRichText(`<p><a href="${input}">Record</a></p>`), new RegExp(`href="${expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
    }
  }
  for (const value of ["https://other.test/players/a", "//other.test/players/a", "/admin/players/a", "/api/profiles/generate", "/profile/handle", "/players-archive", "#hand-4", "/"]) {
    assert.equal(canonicalPokerHref(value), value);
  }
  assert.doesNotMatch(sanitizeRichText('<a href="javascript:alert(1)">Bad</a>'), /href=/u);
});
