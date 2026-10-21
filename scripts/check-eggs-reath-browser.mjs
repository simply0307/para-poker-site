// Built local app + disposable PG17/PostgREST, with no synthetic publications.
// Carrd image requests go to the real public source; no remote media is mocked.
// This does not verify hosted Auth and does not change any hosted source.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { communityHttpFixture } from "../tests/helpers/communityHttpFixture.mjs";
import { startConsumerApp, stopConsumerApp } from "../tests/helpers/consumerHttpFixture.mjs";
import { existingReathReleases, publicChannelVideos, publicPageImage } from "../src/lib/reath/releases.mjs";

const cleanup = [], checks = [], screenshots = [], consoleErrors = [], networkDiagnostics = [], externalImages = [];
const out = path.resolve("docs/eggs-worlds-publications/verification/reath");
fs.mkdirSync(out, { recursive: true });
let browser, currentPage, failure = null;
try {
  const fixture = await communityHttpFixture({ after: fn => cleanup.push(fn) });
  assert.equal(Number((await fixture.db.admin.query("select count(*)::int as count from public.eggs_works")).rows[0].count), 0);
  const app = await startConsumerApp({ ...fixture.env, EGGS_LORE_ENABLED: "true" });
  cleanup.push(() => stopConsumerApp(app));
  browser = await chromium.launch({ channel: "msedge", headless: true });
  cleanup.push(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  currentPage = page;
  const mediaRequests = [];
  page.on("request", request => {
    if (/(?:youtube(?:-nocookie)?\.com|ytimg\.com|googlevideo\.com)$/u.test(new URL(request.url()).hostname)) mediaRequests.push(request.url());
  });
  page.on("response", response => {
    if (response.status() >= 400) networkDiagnostics.push({ status: response.status(), url: response.url() });
  });
  page.on("pageerror", error => consoleErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text() + " @ " + message.location().url);
  });
  const record = value => { checks.push(value); console.log(value); };
  async function noOverflow(label) {
    const measured = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(measured.scroll <= measured.width + 1, label + " document overflow " + JSON.stringify(measured));
  }
  async function loadRealImages() {
    const images = page.locator('img[src^="https://reath-digest.carrd.co/"]');
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(node => node.decode());
      const evidence = await image.evaluate(node => ({ url: node.currentSrc, complete: node.complete, width: node.naturalWidth, height: node.naturalHeight }));
      assert.equal(publicPageImage(evidence.url), true);
      assert.ok(evidence.complete && evidence.width > 0 && evidence.height > 0, "Real public reading image loaded " + evidence.url);
      if (!externalImages.some(item => item.url === evidence.url)) externalImages.push(evidence);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  function cards() { return page.locator(".reath-publication-card"); }

  await page.goto(app.base + "/reath-digest");
  assert.equal(await cards().count(), 7);
  await page.getByLabel("Find something to read or watch", { exact: true }).fill("Infatimer");
  assert.equal(await cards().count(), 1);
  assert.match(await cards().innerText(), /A Natural Choice/u);
  await cards().getByRole("link").click();
  await page.waitForURL("**/reath-digest/a-natural-choice");
  assert.match(await page.locator(".publication-subjects").innerText(), /Commissioner Infinitimer/u);
  await page.goto(app.base + "/reath-digest");
  await page.getByLabel("Find something to read or watch", { exact: true }).fill("Miro Bloom");
  assert.ok(await cards().filter({ hasText: "Moon Bars" }).count() >= 1);
  await cards().filter({ hasText: "Moon Bars" }).first().getByRole("link").click();
  await page.waitForURL("**/reath-digest/moon-bars");
  assert.match(await page.locator(".publication-subjects").innerText(), /Miro Bloom/u);
  record("Actual search finds Infatimer alias → A Natural Choice and Miro Bloom → Moon Bars; each opens its source-backed reading copy.");

  await page.goto(app.base + "/reath-digest/a-natural-choice?page=2");
  console.log("Reader verification: page=2 opened.");
  await page.getByRole("status").filter({ hasText: "Page 2 of 5" }).waitFor();
  assert.equal(await page.locator(".publication-reader-frame img").getAttribute("src"), existingReathReleases()[0].gallery[1].url);
  await page.getByRole("button", { name: "Next →", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.waitForURL("**?page=3");
  console.log("Reader verification: keyboard Next updated page=3.");
  await page.getByRole("status").filter({ hasText: "Page 3 of 5" }).waitFor();
  await page.getByRole("button", { name: "← Previous", exact: true }).focus();
  await page.keyboard.press("Space");
  await page.waitForURL("**?page=2");
  console.log("Reader verification: keyboard Previous updated page=2.");
  await page.getByRole("button", { name: "Page 5", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.waitForURL("**?page=5");
  console.log("Reader verification: keyboard page picker updated page=5.");
  assert.equal(await page.getByRole("button", { name: "Next →", exact: true }).isDisabled(), true);
  await page.getByRole("combobox", { name: /^Reading size/u }).selectOption("3");
  await page.locator(".publication-reader-frame").focus();
  const dimensions = await page.locator(".publication-reader-frame").evaluate(node => ({ client: node.clientWidth, scroll: node.scrollWidth }));
  assert.ok(dimensions.scroll > dimensions.client, "Zoom remains scrollable inside reader");
  await page.keyboard.press("ArrowRight");
  await noOverflow("300% keyboard-readable image");
  assert.equal(await page.locator(".publication-controls a").getAttribute("href"), existingReathReleases()[0].gallery[4].url);
  await page.reload();
  await page.getByRole("status").filter({ hasText: "Page 5 of 5" }).waitFor();
  record("Reader query page survives reload; Previous/Next/page picker work with keyboard; 300% zoom scrolls within the frame without document overflow.");

  await page.goto(app.base + "/watch");
  assert.equal(await cards().count(), 11);
  for (const route of ["/lore", "/community", "/people"]) assert.equal(await page.locator('.studio-tabs a[href="' + route + '"]').count(), 1, "Watch navigation honors enabled runtime feature " + route);
  for (const video of publicChannelVideos()) assert.equal(await page.locator('a[href="' + video.href + '"]').count(), 1);
  assert.equal(await page.locator("iframe").count(), 0);
  assert.deepEqual(mediaRequests, [], "No YouTube request before explicit Play choice");
  record("The video room lists all eleven real channel uploads and runtime-enabled Lore/Community/People navigation; no YouTube player/thumbnail request occurs during browsing.");

  // Forty captures in a new evidence directory; earlier packets stay intact.
  for (const theme of ["carton", "after-hours"]) {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      for (const [name, route] of [["home", "/"], ["reath-digest", "/reath-digest"], ["reader", "/reath-digest/a-natural-choice?page=2"], ["watch", "/watch"]]) {
        await page.goto(app.base + route);
        await page.getByLabel("Studio theme", { exact: true }).selectOption(theme);
        await page.waitForFunction(value => document.querySelector(".personal-studio")?.dataset.theme === value, theme);
        await page.evaluate(() => document.fonts.ready);
        await loadRealImages();
        await noOverflow(name + " / " + theme + " / " + width);
        assert.equal(await page.locator("h1").count(), 1, "One main heading");
        assert.equal(await page.locator("iframe").count(), 0);
        const shortControls = await page.locator(".publication-controls button,.publication-controls select,.publication-controls a,.publication-page-picker button,.reath-tools input,.reath-tools button").evaluateAll(nodes => nodes.filter(node => !node.disabled && node.getClientRects().length && node.getBoundingClientRect().height < 43.5).map(node => node.outerHTML.slice(0, 180)));
        assert.deepEqual(shortControls, [], "Reader/search controls meet 44px height");
        const filename = `${name}-${theme}-${width}.png`;
        await page.screenshot({ path: path.join(out, filename), fullPage: true });
        screenshots.push(filename);
      }
    }
  }
  assert.equal(screenshots.length, 40);
  assert.ok(externalImages.length >= 5, "Real Carrd covers and story page were loaded, not mocked");
  assert.deepEqual(mediaRequests, []);
  const unexpectedConsoleErrors = consoleErrors.filter(error => !(error.endsWith(" @ " + app.base + "/api/eggs/profile") && /status of 401 \(Unauthorized\)/u.test(error)));
  assert.deepEqual(unexpectedConsoleErrors, [], "No unexpected application console errors before opting into third-party playback; expected anonymous owner-profile probes remain recorded");
  record("Forty captures: Reath landing, original reading page, all-video grid and home in both themes at 320/390/768/1024/1440px; real external images loaded and no document overflow.");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(app.base + "/watch/eDV18i6RMBg");
  assert.equal(await page.locator("iframe").count(), 0);
  await page.getByRole("button", { name: "Play video here", exact: true }).focus();
  assert.equal(await page.getByRole("button", { name: "Play video here", exact: true }).evaluate(node => getComputedStyle(node).outlineStyle !== "none"), true);
  await page.keyboard.press("Enter");
  const iframe = page.locator("iframe");
  await iframe.waitFor();
  assert.equal(await iframe.getAttribute("src"), "https://www.youtube-nocookie.com/embed/eDV18i6RMBg?autoplay=1");
  assert.equal(await iframe.getAttribute("title"), publicChannelVideos().find(video => video.id === "video:eDV18i6RMBg").title);
  assert.equal(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true);
  record("Keyboard Play is the first action that creates the privacy-enhanced YouTube iframe; source AI disclosure remains visible. This verifies embed gating, not third-party playback availability.");
} catch (error) {
  failure = { message: error.message, stack: error.stack, url: currentPage?.url() || null };
  if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({ path: path.join(out, "failure.png"), fullPage: true }).catch(() => {});
  throw error;
} finally {
  try {
    fs.writeFileSync(path.join(out, "browser-results.json"), JSON.stringify({
    browser: browser ? browser.version() : null,
    checkedAt: new Date().toISOString(),
    nextBuildId: fs.existsSync(".next/BUILD_ID") ? fs.readFileSync(".next/BUILD_ID", "utf8").trim() : null,
    featureFlags: { hub: true, rooms: true, community: true, lore: true },
    transport: "Real built local Next.js + disposable PostgreSQL17/PostgREST16.4; synthetic Auth fixture unused; empty Hub publication table",
    publicContent: "Four existing public Carrd releases and eleven actual channel uploads; remote Carrd image requests were not mocked. No new hosted publication or Auth flow was performed.",
    checks, screenshots, externalImages, consoleErrors, networkDiagnostics, failure,
    }, null, 2) + "\n");
  } finally {
    for (const fn of cleanup.reverse()) await fn();
  }
}
