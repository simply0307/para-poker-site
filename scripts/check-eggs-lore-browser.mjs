// Real built Next.js + disposable PG17/native PostgREST. Auth issuance and all
// dossiers are synthetic local fixtures. This is not hosted Auth verification.
// This script never builds, deploys, imports private sources or runs hosted SQL.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { loreHttpFixture } from "../tests/helpers/loreHttpFixture.mjs";
import { hubActor, hubIds } from "../tests/helpers/hubDatabase.mjs";
import { startConsumerApp, stopConsumerApp } from "../tests/helpers/consumerHttpFixture.mjs";

const out = path.resolve("docs/eggs-worlds-publications/verification");
const screenshotDirectory = path.join(out, "screenshots");
const cleanups = [], checks = [], screenshots = [], consoleErrors = [], networkDiagnostics = [];
const expectedNetwork = new Set();
const worldSlug = "browser-world";
const sourceSentinel = "PRIVATE_LORE_BROWSER_SOURCE";
const draftSentinel = "PRIVATE_LORE_BROWSER_UNPUBLISHED_BODY";
const kinds = { factions: "Factions", people: "People", events: "Events", terms: "Terms", places: "Places" };
const fixtureContent = (value = {}) => ({
  title: "Local verification world",
  summary: "Synthetic browser acceptance content; not a real EGGS release.",
  body: "This world exists only in a disposable local verification database.\n\nIts dossiers test reader navigation and preserve project boundaries.",
  continuity_note: "Synthetic local fixture. No story canon, source permission or real release is being approved.",
  attribution: "Local EGGS browser verification fixture",
  permission: "site-public", source_reviewed: true,
  public_source: "https://example.com/public-fixture",
  internal_source: sourceSentinel, project_id: null, ...value,
});
fs.mkdirSync(screenshotDirectory, { recursive: true });
let browser, outcome = "failed", failure;
const record = (message) => { checks.push(message); console.log(message); };

try {
  const fixture = await loreHttpFixture({ after: (callback) => cleanups.push(callback) });
  async function write(user, entry, content, kind = "world", slug = worldSlug, action = "save") {
    const result = await hubActor(fixture.db, user, (client) => client.query(
      "select public.save_eggs_lore($1,$2,$3,$4,$5,$6,$7) entry",
      [entry?.id || null, worldSlug, entry?.kind || kind, entry?.slug || slug, content, entry?.version || 0, action],
    ));
    return result.rows[0].entry;
  }
  let world = await write("editor", null, fixtureContent());
  world = await write("publisher", world, null, undefined, undefined, "publish");
  for (const kind of Object.keys(kinds)) {
    let entry = await write("editor", null, fixtureContent({
      title: "Browser fixture " + kinds[kind],
      body: "Reader navigation fixture for " + kind + ".\n\nLong unbroken text must remain inside the page: " + "W".repeat(180) + ".\n\nLiteral markup stays text: <script>window.syntheticLoreMustNotRun = true</script>.",
    }), kind, "browser-" + kind);
    entry = await write("publisher", entry, null, undefined, undefined, "publish");
  }
  const privateDraft = await write("editor", null, fixtureContent({
    title: "Unpublished private browser dossier", body: draftSentinel,
    permission: "unreviewed", source_reviewed: false,
  }), "people", "private-browser-person");
  record("Seeded one synthetic reviewed world, all five published dossier kinds and a private unpublished sentinel using live-role SQL/RPC in disposable PostgreSQL.");

  const app = await startConsumerApp(fixture.env);
  cleanups.push(() => stopConsumerApp(app));
  // Read-only public browsing must work before consumer rollout is enabled.
  const publicApp = await startConsumerApp({ ...fixture.env, EGGS_CONSUMER_ENABLED: "false" });
  cleanups.push(() => stopConsumerApp(publicApp));
  browser = await chromium.launch({ channel: "msedge", headless: true });
  cleanups.push(() => browser.close());
  async function context() {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    context.on("page", (page) => {
      page.on("pageerror", (error) => consoleErrors.push({ text: error.message, url: page.url(), type: "pageerror" }));
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push({ text: message.text(), url: message.location().url, type: "console" });
      });
      page.on("response", (response) => {
        if (response.status() >= 400) networkDiagnostics.push({ status: response.status(), url: response.url(), method: response.request().method() });
      });
    });
    return context;
  }
  const visitor = await context(), editorial = await context(), publishing = await context(), unrelated = await context();
  const publicPage = await visitor.newPage(), editor = await editorial.newPage(), publisher = await publishing.newPage(), alice = await unrelated.newPage();
  for (const base of [app.base, publicApp.base]) {
    expectedNetwork.add("GET " + base + "/api/eggs/profile 401");
    expectedNetwork.add("GET " + base + "/api/eggs/profile 503");
  }
  async function login(page, name) {
    await page.goto(app.base + "/login");
    await page.getByLabel("Email", { exact: true }).fill(name + "@fixture.invalid");
    await page.getByLabel("Password", { exact: true }).fill("fixture-password");
    await page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(app.base + "/profile");
  }
  async function uiWrite(page, click, status = 200) {
    const pending = page.waitForResponse((response) => response.url() === app.base + "/api/eggs/hub/lore" && response.request().method() === "POST");
    await click();
    const response = await pending;
    const text = await response.text();
    assert.equal(response.status(), status, text);
    return text ? JSON.parse(text) : null;
  }
  async function publicPrivacy(route) {
    const response = await visitor.request.get(publicApp.base + route);
    assert.equal(response.status(), 200, route);
    const html = await response.text();
    assert.doesNotMatch(html, /PRIVATE_LORE_BROWSER_SOURCE|PRIVATE_LORE_BROWSER_UNPUBLISHED_BODY|internal_source|source_reviewed|site-public/u, route + " public HTML/embedded payload privacy");
    return html;
  }
  async function noOverflow(page, label) {
    const size = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(size.scroll <= size.client + 1, label + " document overflow: " + JSON.stringify(size));
  }
  async function targets(page, selector, label) {
    const small = await page.locator(selector).evaluateAll((nodes) => nodes.filter((node) => {
      const box = node.getBoundingClientRect();
      return !node.disabled && node.getClientRects().length && box.height < 43.5;
    }).map((node) => node.outerHTML.slice(0, 160)));
    assert.deepEqual(small, [], label + " controls below 44px");
  }

  await publicPage.goto(publicApp.base + "/projects");
  await publicPage.getByRole("navigation", { name: "Studio", exact: true }).getByRole("link", { name: "Lore", exact: true }).click();
  await publicPage.waitForURL(publicApp.base + "/lore");
  await publicPage.locator(".lore-card").filter({ hasText: "Local verification world" }).getByRole("link").click();
  await publicPage.waitForURL(publicApp.base + "/lore/" + worldSlug);
  for (const [kind, title] of Object.entries(kinds)) {
    await publicPage.getByRole("navigation", { name: "Local verification world dossiers", exact: true }).getByRole("link", { name: new RegExp("^" + title, "u") }).click();
    await publicPage.waitForURL(publicApp.base + `/lore/${worldSlug}/${kind}`);
    const search = publicPage.getByLabel("Find a dossier", { exact: true });
    await search.fill("no-matching-local-fixture");
    await publicPage.locator('.lore-page [role="status"]').filter({ hasText: "0 dossiers" }).waitFor();
    assert.equal(await publicPage.locator(".lore-card").count(), 0);
    await search.fill("Browser fixture " + title);
    await publicPage.locator('.lore-page [role="status"]').filter({ hasText: "1 dossier" }).waitFor();
    await publicPage.locator(".lore-card").getByRole("link").click();
    await publicPage.waitForURL(publicApp.base + `/lore/${worldSlug}/${kind}/browser-${kind}`);
    await publicPage.getByRole("heading", { level: 1, name: "Browser fixture " + title, exact: true }).waitFor();
    assert.equal(await publicPage.evaluate(() => Boolean(window.syntheticLoreMustNotRun)), false);
    await publicPrivacy(`/lore/${worldSlug}/${kind}/browser-${kind}`);
    await publicPage.getByRole("navigation", { name: "Lore breadcrumb", exact: true }).getByRole("link", { name: "Local verification world", exact: true }).click();
    await publicPage.waitForURL(publicApp.base + "/lore/" + worldSlug);
  }
  const publicDto = await visitor.request.get(publicApp.base + "/api/eggs/lore");
  assert.equal(publicDto.status(), 200);
  const publicJson = await publicDto.text();
  assert.equal(JSON.parse(publicJson).entries.length, 6);
  assert.doesNotMatch(publicJson, /PRIVATE_LORE_BROWSER_SOURCE|PRIVATE_LORE_BROWSER_UNPUBLISHED_BODY|internal_source|source_reviewed|site-public/u);
  record("Anonymous navigation, all five sections, client search and dossier reading work with consumer rollout disabled; literal markup stays text and hidden draft/source data is absent from API, HTML and embedded payloads.");

  await login(editor, "editor");
  await editor.goto(app.base + "/eggs-admin/lore/new");
  await editor.getByLabel(/^Dossier type/u).selectOption("people");
  await editor.getByLabel("Permanent slug", { exact: true }).fill("browser-ui-person");
  await editor.getByLabel(/^World/u).selectOption(worldSlug);
  await editor.getByLabel("Dossier title", { exact: true }).fill("Local UI verification person");
  await editor.getByLabel("Summary", { exact: true }).fill("Synthetic browser UI content; not an actual EGGS character.");
  await editor.getByLabel(/^Dossier text/u).fill("Saved through the actual editor UI in a disposable database.");
  await editor.getByLabel(/^Continuity & scope note/u).fill("Synthetic UI verification; no canon or real publication decision.");
  await editor.getByLabel("Public creator/source credit", { exact: true }).fill("Local browser fixture");
  await editor.getByLabel(/^Public source link \(optional\)/u).fill("https://example.com/public-ui-fixture");
  await editor.getByLabel(/^Private source\/review record/u).fill(sourceSentinel);
  await editor.getByLabel(/^Text permission/u).selectOption("site-public");
  await editor.getByLabel("Source, creator credit and intended public use have been reviewed.", { exact: true }).check();
  await targets(editor, '.hub-editor-form input:not([type="checkbox"]),.hub-editor-form textarea,.hub-editor-form select,.hub-editor-form button', "Lore editor");
  const created = (await uiWrite(editor, () => editor.getByRole("button", { name: "Save dossier draft", exact: true }).click())).entry;
  await editor.waitForURL(app.base + "/eggs-admin/lore/" + created.id);
  await editor.getByRole("link", { name: /Preview saved revision/u }).click();
  await editor.getByRole("heading", { level: 1, name: "Local UI verification person", exact: true }).waitFor();
  await editor.getByText("A publisher can publish or archive this saved revision.", { exact: true }).waitFor();
  assert.equal(await editor.getByRole("button", { name: "Publish this saved dossier", exact: true }).count(), 0);
  assert.ok(!(await editor.locator("body").innerText()).includes(sourceSentinel));
  const uiPreview = editor.url();
  const uiPublic = `/lore/${worldSlug}/people/browser-ui-person`;
  assert.equal((await visitor.request.get(publicApp.base + uiPublic)).status(), 404);
  const anonPreview = await visitor.request.get(app.base + "/eggs-admin/lore/" + privateDraft.id + "/preview", { maxRedirects: 0 });
  assert.equal(anonPreview.status(), 307);
  assert.equal(new URL(anonPreview.headers().location, app.base).pathname, "/login");
  await editor.goto(app.base + "/eggs-admin/lore/" + privateDraft.id + "/preview");
  await editor.getByText(draftSentinel, { exact: true }).waitFor();
  await login(alice, "alice");
  await alice.goto(app.base + "/eggs-admin/lore/" + privateDraft.id + "/preview");
  assert.ok(!(await alice.locator("body").innerText()).includes(draftSentinel));
  await alice.getByRole("alert").filter({ hasText: "An explicit EGGS editorial role is required." }).waitFor();
  record("The real editor UI saves and previews a dossier without publishing; a signed editor can read the private draft, while anonymous users redirect and unrelated signed accounts cannot read it. Private source records remain absent even from saved-preview presentation.");

  await login(publisher, "publisher");
  await publisher.goto(uiPreview);
  const published = (await uiWrite(publisher, () => publisher.getByRole("button", { name: "Publish this saved dossier", exact: true }).click())).entry;
  await publisher.getByRole("status").filter({ hasText: "This saved dossier is published." }).waitFor();
  const publishedHtml = await publicPrivacy(uiPublic);
  assert.ok(publishedHtml.includes("Saved through the actual editor UI"));
  await publisher.goto(app.base + "/eggs-admin/lore/" + published.id + "/preview");
  await uiWrite(publisher, () => publisher.getByRole("button", { name: "Archive dossier", exact: true }).click());
  await publisher.getByRole("status").filter({ hasText: "This dossier is archived." }).waitFor();
  assert.equal((await visitor.request.get(publicApp.base + uiPublic)).status(), 404);
  record("A publisher explicitly releases the saved UI revision and archives it through actual browser controls; public visibility follows both operations without exposing source evidence.");

  await editor.goto(app.base + "/eggs-admin/lore/" + privateDraft.id);
  assert.equal(await editor.getByLabel(/^Private source\/review record/u).inputValue(), sourceSentinel);
  const before = (await fixture.db.admin.query("select content,version from public.eggs_lore_drafts where id=$1", [privateDraft.id])).rows;
  await fixture.db.admin.query("delete from auth.sessions where user_id=$1", [hubIds.editor]);
  await editor.getByLabel(/^Dossier text/u).fill("A revoked session must not overwrite the saved draft.");
  expectedNetwork.add("POST " + app.base + "/api/eggs/hub/lore 401");
  await uiWrite(editor, () => editor.getByRole("button", { name: "Save dossier draft", exact: true }).click(), 401);
  await editor.getByRole("alert").filter({ hasText: "Your EGGS session has ended." }).waitFor();
  assert.deepEqual((await fixture.db.admin.query("select content,version from public.eggs_lore_drafts where id=$1", [privateDraft.id])).rows, before);
  await editor.goto(app.base + "/eggs-admin/lore/" + privateDraft.id + "/preview");
  await editor.waitForURL(/\/login(?:[?#].*)?$/u);
  assert.ok(!(await editor.locator("body").innerText()).includes(draftSentinel));
  record("Revoking the editor's real database session makes an already-open editor Save fail with401 and preserves the entire saved revision; a subsequent private-preview navigation returns to login.");

  const routes = [
    ["lore", "/lore"],
    ["world", "/lore/" + worldSlug],
    ["category", `/lore/${worldSlug}/people`],
    ["dossier", `/lore/${worldSlug}/people/browser-people`],
  ];
  for (const theme of ["carton", "after-hours"]) for (const width of [320, 390, 768, 1024, 1440]) {
    await publicPage.setViewportSize({ width, height: 950 });
    for (const [name, route] of routes) {
      await publicPage.goto(publicApp.base + route);
      await publicPage.getByLabel("Studio theme", { exact: true }).selectOption(theme);
      await publicPage.evaluate(() => document.fonts.ready);
      await publicPage.waitForFunction((value) => document.querySelector(".personal-studio")?.dataset.theme === value, theme);
      await noOverflow(publicPage, `${name}/${theme}/${width}`);
      assert.equal(await publicPage.locator("h1").count(), 1, name + " main heading");
      await targets(publicPage, ".lore-page a,.lore-page input,.lore-page button,.lore-page select", name);
      const filename = `${name}-${theme}-${width}.png`;
      await publicPage.screenshot({ path: path.join(screenshotDirectory, filename), fullPage: true });
      screenshots.push("screenshots/" + filename);
    }
  }
  assert.equal(screenshots.length, 40);
  await publicPage.reload();
  await publicPage.waitForFunction(() => document.querySelector(".personal-studio")?.dataset.theme === "after-hours");
  record("Forty captures cover lore landing/world/category/detail in both themes at320/390/768/1024/1440px; new reader controls meet44px, every page has one main heading, long text stays contained and the selected theme survives reload.");
  await publicPage.emulateMedia({ reducedMotion: "reduce" });
  await publicPage.goto(publicApp.base + "/lore");
  assert.equal(await publicPage.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true);
  await publicPage.keyboard.press("Tab");
  const focus = await publicPage.evaluate(() => ({ tag: document.activeElement.tagName, outline: getComputedStyle(document.activeElement).outlineStyle }));
  assert.notEqual(focus.tag, "BODY"); assert.notEqual(focus.outline, "none");
  await publicPage.goto(publicApp.base + `/lore/${worldSlug}/people`);
  await publicPage.getByLabel("Find a dossier", { exact: true }).focus();
  await publicPage.keyboard.type("Browser fixture People");
  await publicPage.locator('.lore-page [role="status"]').filter({ hasText: "1 dossier" }).waitFor();
  record("Keyboard focus is visible, the labelled search works from the keyboard and reduced-motion preference is active.");

  const unexpectedResponses = networkDiagnostics.filter((response) => !expectedNetwork.has(`${response.method} ${response.url} ${response.status}`));
  assert.deepEqual(unexpectedResponses, [], "Unexpected failed browser responses");
  const unexpectedConsole = consoleErrors.filter((message) => {
    const resource = message.text.match(/^Failed to load resource: the server responded with a status of (\d+)/u);
    return !(message.type === "console" && resource && expectedNetwork.has(`GET ${message.url} ${resource[1]}`) || message.type === "console" && resource && expectedNetwork.has(`POST ${message.url} ${resource[1]}`));
  });
  assert.deepEqual(unexpectedConsole, [], "Unexpected browser console errors");
  outcome = "passed";
} catch (error) {
  failure = { message: error.message, stack: error.stack };
  throw error;
} finally {
  fs.writeFileSync(path.join(out, "lore-browser-results.json"), JSON.stringify({
    outcome, browser: browser ? await browser.version() : null,
    transport: "Real built Next.js + disposable PostgreSQL17 + native PostgREST16.4; simulated Auth issuance only",
    fixtureContent: "All lore text and identities are synthetic disposable verification fixtures; no private CreativeOS source or canon is seeded/published.",
    publicConsumerRollout: false, checks, screenshots, consoleErrors, networkDiagnostics, ...(failure ? { failure } : {}),
  }, null, 2) + "\n");
  for (const cleanup of cleanups.reverse()) await cleanup();
}
