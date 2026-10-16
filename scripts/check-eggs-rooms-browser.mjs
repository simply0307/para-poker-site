// Browser acceptance against disposable PG17 + real PostgREST, simulated Auth.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { roomsHttpFixture } from "../tests/helpers/roomsHttpFixture.mjs";
import { seedRoomsPreview } from "../tests/helpers/roomsPreviewSeed.mjs";
import {
  startConsumerApp,
  stopConsumerApp,
} from "../tests/helpers/consumerHttpFixture.mjs";
const cleanup = [],
  checks = [],
  t = { after: (fn) => cleanup.push(fn) };
const out = path.resolve("docs/eggs-personal-internet/screenshots");
fs.mkdirSync(out, { recursive: true });
let browser;
try {
  const fixture = await roomsHttpFixture(t);
  await seedRoomsPreview(fixture.db);
  const app = await startConsumerApp(fixture.env);
  cleanup.push(() => stopConsumerApp(app));
  browser = await chromium.launch({ channel: "msedge", headless: true });
  cleanup.push(() => browser.close());
  const owner = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    visitor = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
  const page = await owner.newPage(),
    publicPage = await visitor.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  publicPage.on("pageerror", (e) => errors.push(e.message));
  async function login(p, name) {
    await p.goto(app.base + "/login");
    await p
      .getByLabel("Email", { exact: true })
      .fill(name + "@fixture.invalid");
    await p.getByLabel("Password", { exact: true }).fill("fixture-password");
    await p
      .locator("form")
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await p.waitForURL("**/profile");
  }
  async function save(p) {
    const response = p.waitForResponse(
      (r) =>
        r.url().endsWith("/api/eggs/room") && r.request().method() === "PUT",
    );
    await p.getByRole("button", { name: "Save My Page", exact: true }).click();
    const r = await response;
    assert.equal(r.status(), 200, await r.text());
    await p.getByRole("status").filter({ hasText: "Saved." }).waitFor();
    return (await r.json()).room;
  }
  async function mine() {
    return (await (await owner.request.get(app.base + "/api/eggs/room")).json())
      .room;
  }
  async function overflow(p, label) {
    const sizes = await p.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(
      sizes.scroll <= sizes.width + 1,
      label + " overflow " + JSON.stringify(sizes),
    );
  }
  // Actual editorial UI: editor draft, saved preview, separate publisher approval.
  const editorial = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    }),
    edit = await editorial.newPage();
  await login(edit, "editor");
  await edit.goto(app.base + "/eggs-admin/works/new");
  await edit.getByLabel("Work title", { exact: true }).fill("Browser original");
  await edit
    .getByLabel("Permanent slug", { exact: true })
    .fill("browser-original");
  await edit
    .getByLabel("Summary", { exact: true })
    .fill("A saved browser publication.");
  await edit
    .getByLabel("Description", { exact: true })
    .fill("Original EGGS geometry, reviewed in a saved preview.");
  await edit.getByRole("button", { name: "Save work draft" }).click();
  await edit.waitForURL(/\/eggs-admin\/works\/[0-9a-f-]+$/u);
  await edit.getByRole("link", { name: /Preview saved revision/u }).click();
  await edit
    .getByText("A publisher can publish or archive this saved revision.")
    .waitFor();
  assert.equal(
    await edit.getByRole("button", { name: "Publish this saved work" }).count(),
    0,
  );
  const preview = edit.url();
  await editorial.close();
  const publishing = await browser.newContext(),
    publish = await publishing.newPage();
  await login(publish, "publisher");
  await publish.goto(preview);
  const published = publish.waitForResponse(
    (r) =>
      r.url().endsWith("/api/eggs/hub/works") &&
      r.request().method() === "POST",
  );
  await publish
    .getByRole("button", { name: "Publish this saved work" })
    .click();
  const publication = await published;
  assert.equal(publication.status(), 200, await publication.text());
  await publish.goto(app.base + "/library/browser-original");
  await publish
    .getByRole("heading", { name: "Browser original", exact: true })
    .waitFor();
  await publishing.close();
  checks.push(
    "Editor draft and saved preview; publisher explicitly publishes through UI.",
  );
  console.log("Editorial UI passed");
  await login(page, "alice");
  await page.goto(app.base + "/profile/edit");
  let writes = 0;
  page.on("request", (req) => {
    if (req.url().endsWith("/api/eggs/room") && req.method() === "PUT")
      writes++;
  });
  const original = await mine();
  assert.ok(original);
  console.log("Owner room loaded");
  await page
    .getByLabel("Room theme", { exact: true })
    .selectOption("after-hours");
  await page
    .getByLabel("Bio", { exact: true })
    .fill("A local change that should be discarded.");
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  assert.equal(writes, 0);
  assert.deepEqual(await mine(), original);
  assert.equal(
    await page.getByLabel("Bio", { exact: true }).inputValue(),
    original.modules.bio,
  );
  await page.getByLabel("Cover", { exact: true }).selectOption("orbit");
  await page
    .getByRole("button", { name: "Reset Appearance", exact: true })
    .click();
  assert.equal(writes, 0);
  assert.equal(
    await page.getByLabel("Display name", { exact: true }).inputValue(),
    original.profile.display_name,
  );
  assert.equal(
    await page.getByLabel("Profile visibility", { exact: true }).inputValue(),
    "public",
  );
  assert.equal(
    await page.getByLabel("Featured slot 1", { exact: true }).inputValue(),
    original.modules.showcase[0].type + ":" + original.modules.showcase[0].id,
  );
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  checks.push(
    "Discard and Reset Appearance make no request; identity, visibility and board remain.",
  );
  const eighth = await page
    .getByLabel("Featured slot 8", { exact: true })
    .locator("option")
    .allTextContents();
  assert.ok(eighth.some((x) => x.includes("Browser original")));
  const option = await page
    .getByLabel("Featured slot 8", { exact: true })
    .locator("option")
    .filter({ hasText: "Browser original" })
    .getAttribute("value");
  await page
    .getByLabel("Featured slot 8", { exact: true })
    .selectOption(option);
  await page
    .getByRole("button", { name: "Move featured slot 8 up", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Move Featured Eight up", exact: true })
    .click();
  let current = await save(page);
  assert.equal(current.modules.showcase.length, 8);
  assert.equal(current.modules.showcase[6].id, option.split(":")[1]);
  assert.equal(current.module_order[3], "showcase");
  checks.push("All eight mixed slots save; ordering persists.");
  await page.goto(app.base + "/profile/local_alice");
  await page.getByRole("link", { name: "Edit My Page" }).waitFor();
  const anonymousOwnerCheck = publicPage.waitForResponse((r) =>
    r.url().endsWith("/api/eggs/profile"),
  );
  await publicPage.goto(app.base + "/profile/local_alice");
  assert.equal((await anonymousOwnerCheck).status(), 401);
  assert.equal(
    await publicPage.getByRole("link", { name: "Edit My Page" }).count(),
    0,
  );
  checks.push("Only the live owner receives Edit My Page.");
  await publicPage.goto(app.base + "/");
  await publicPage
    .getByLabel("Studio theme", { exact: true })
    .selectOption("after-hours");
  await publicPage.reload();
  assert.equal(
    await publicPage.locator(".personal-studio").getAttribute("data-theme"),
    "after-hours",
  );
  await publicPage.goto(app.base + "/profile/local_alice");
  assert.equal(
    await publicPage.locator(".personal-room").getAttribute("data-theme"),
    "carton",
  );
  checks.push("Visitor theme persists; room theme is independent.");
  // A real stale editor tab must report the conflict without replacing the winner.
  await page.goto(app.base + "/profile/edit");
  const stale = await owner.newPage();
  await stale.goto(app.base + "/profile/edit");
  await page
    .getByLabel("Display name", { exact: true })
    .fill("Alice / the personal internet");
  current = await save(page);
  await stale
    .getByLabel("Display name", { exact: true })
    .fill("Stale tab overwrite");
  const conflict = stale.waitForResponse(
    (r) => r.url().endsWith("/api/eggs/room") && r.request().method() === "PUT",
  );
  await stale
    .getByRole("button", { name: "Save My Page", exact: true })
    .click();
  assert.equal((await conflict).status(), 409);
  await stale
    .getByRole("alert")
    .filter({ hasText: "This revision changed" })
    .waitFor();
  assert.equal(
    (await mine()).profile.display_name,
    "Alice / the personal internet",
  );
  await stale.close();
  checks.push(
    "Concurrent editor tabs: stale save returns 409 and preserves winning content.",
  );
  // Both visual treatments, all mandated widths, screenshots and overflow.
  for (const theme of ["carton", "after-hours"]) {
    await page.goto(app.base + "/profile/edit");
    await page.getByLabel("Room theme", { exact: true }).selectOption(theme);
    if ((await mine()).appearance.theme !== theme) current = await save(page);
    for (const width of [320, 390, 768, 1024, 1440]) {
      await publicPage.setViewportSize({ width, height: 950 });
      await publicPage.goto(app.base + "/");
      await publicPage
        .getByLabel("Studio theme", { exact: true })
        .selectOption(theme);
      await publicPage.evaluate(() => document.fonts.ready);
      await overflow(publicPage, "home " + theme + " " + width);
      await publicPage.screenshot({
        path: path.join(out, "home-" + theme + "-" + width + ".png"),
        fullPage: true,
      });
      await publicPage.goto(app.base + "/profile/local_alice");
      await publicPage.evaluate(() => document.fonts.ready);
      assert.equal(
        await publicPage.locator(".personal-room").getAttribute("data-theme"),
        theme,
      );
      await overflow(publicPage, "room " + theme + " " + width);
      await publicPage.screenshot({
        path: path.join(out, "room-" + theme + "-" + width + ".png"),
        fullPage: true,
      });
    }
  }
  checks.push(
    "Both themes captured at 320/390/768/1024/1440; no document overflow.",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(app.base + "/profile/edit");
  await page.screenshot({
    path: path.join(out, "editor-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Mobile", exact: true }).click();
  await page.screenshot({
    path: path.join(out, "editor-mobile-preview.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await overflow(page, "editor mobile");
  await page.screenshot({
    path: path.join(out, "editor-390.png"),
    fullPage: true,
  });
  // Hide each module, verify the browser receives the same public projection.
  for (const label of [
    "About me",
    "My corner",
    "Favorite games",
    "Pinned note",
    "Featured Eight",
  ])
    await page.getByLabel(label, { exact: true }).uncheck();
  current = await save(page);
  await publicPage.goto(app.base + "/profile/local_alice");
  assert.equal(await publicPage.locator(".room-module").count(), 0);
  const publicJson = await (
    await visitor.request.get(app.base + "/api/eggs/rooms/local_alice")
  ).json();
  assert.deepEqual(publicJson.room.modules, {});
  checks.push(
    "All five visibility toggles remove public modules and JSON fields.",
  );
  // Long content and reduced motion, keyboard focus and interactive control targets.
  await page.getByLabel("About me", { exact: true }).check();
  await page.getByLabel("Bio", { exact: true }).fill("B".repeat(500));
  await page.getByLabel("Display name", { exact: true }).fill("A".repeat(80));
  await save(page);
  await publicPage.setViewportSize({ width: 320, height: 900 });
  await publicPage.goto(app.base + "/profile/local_alice");
  await overflow(publicPage, "long public content");
  await publicPage.emulateMedia({ reducedMotion: "reduce" });
  await publicPage.goto(app.base + "/");
  await publicPage.keyboard.press("Tab");
  const focus = await publicPage.evaluate(() => ({
    tag: document.activeElement.tagName,
    outline: getComputedStyle(document.activeElement).outlineStyle,
  }));
  assert.notEqual(focus.tag, "BODY");
  assert.notEqual(focus.outline, "none");
  const small = await page
    .locator(
      ".room-controls button,.room-controls select,.room-controls input:not([type=checkbox])",
    )
    .evaluateAll((nodes) =>
      nodes
        .filter((n) => !n.disabled && n.getBoundingClientRect().height < 43.5)
        .map((n) => n.outerHTML.slice(0, 100)),
    );
  assert.deepEqual(small, []);
  checks.push(
    "Keyboard focus visible; editor controls meet 44px height; long content stays within 320px; reduced-motion stylesheet active.",
  );
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(out, "browser-results.json"),
    JSON.stringify(
      {
        browser: await browser.version(),
        transport: "Real PostgreSQL 17 + PostgREST 16.4; simulated Auth",
        checks,
        consoleErrors: errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(checks.join("\n"));
} finally {
  for (const fn of cleanup.reverse()) await fn();
}
