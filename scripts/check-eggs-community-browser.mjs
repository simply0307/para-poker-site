// Real built Next app + disposable PG17/PostgREST. Auth and all people/content
// in this test are synthetic fixtures. This is not hosted authentication proof.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { communityHttpFixture } from "../tests/helpers/communityHttpFixture.mjs";
import { seedCommunityPreview } from "../tests/helpers/communityPreviewSeed.mjs";
import { hubIds } from "../tests/helpers/hubDatabase.mjs";
import { editableRoom } from "../src/lib/rooms/core.mjs";
import { REATH_PROJECT_ID } from "../src/lib/reath/catalog.mjs";
import {
  startConsumerApp,
  stopConsumerApp,
} from "../tests/helpers/consumerHttpFixture.mjs";

const cleanup = [],
  checks = [],
  errors = [],
  networkDiagnostics = [],
  screenshots = [];
const out = path.resolve("docs/eggs-hub-community/screenshots");
fs.mkdirSync(out, { recursive: true });
try {
  const fixture = await communityHttpFixture({
    after: (fn) => cleanup.push(fn),
  });
  await seedCommunityPreview(fixture.db, { publications: true });
  const app = await startConsumerApp(fixture.env);
  cleanup.push(() => stopConsumerApp(app));
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  cleanup.push(() => browser.close());
  const context = async () => {
    const value = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    value.on("page", (page) => {
      page.on("response", (response) => {
        if (response.status() >= 400)
          networkDiagnostics.push({ status: response.status(), url: response.url() });
      });
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        // Anonymous, stale revision, and revoked-session requests deliberately
        // produce browser network diagnostics; they are asserted separately.
        if (
          message.type() === "error" &&
          !/Failed to load resource: the server responded with a status of (401|403|409)/u.test(
            message.text(),
          )
        )
          errors.push(message.text() + " @ " + message.location().url);
      });
    });
    return value;
  };
  const alice = await context(),
    bob = await context(),
    publisher = await context(),
    visitor = await context();
  const page = await alice.newPage(),
    bobPage = await bob.newPage(),
    pubPage = await publisher.newPage(),
    publicPage = await visitor.newPage();
  const record = (message) => {
    checks.push(message);
    console.log(message);
  };
  async function login(p, user) {
    await p.goto(app.base + "/login");
    await p
      .getByLabel("Email", { exact: true })
      .fill(user + "@fixture.invalid");
    await p.getByLabel("Password", { exact: true }).fill("fixture-password");
    await p
      .locator("form")
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await p.waitForURL("**/profile");
  }
  const card = (p, text) =>
    p.locator(".community-post").filter({ hasText: text });
  async function postResponse(p, click, status = 200) {
    const pending = p.waitForResponse(
      (r) =>
        r.url().endsWith("/api/eggs/community/post") &&
        r.request().method() === "POST",
    );
    await click();
    const response = await pending;
    assert.equal(response.status(), status, await response.text());
    return response.json();
  }
  async function create(p, text, reply = false) {
    await p
      .getByLabel(reply ? "Your reply" : "Your post", { exact: true })
      .fill(text);
    const result = await postResponse(p, () =>
      p
        .getByRole("button", {
          name: reply ? "Post reply ↗" : "Post to EGGS ↗",
          exact: true,
        })
        .click(),
    );
    await p
      .getByRole("status")
      .filter({ hasText: reply ? "Your reply is up." : "Your post is up." })
      .waitFor();
    return result.post;
  }
  async function focusRefresh(p) {
    const response = p.waitForResponse(
      (r) =>
        r.url().includes("/api/eggs/community") && !r.url().endsWith("/post"),
    );
    await p.evaluate(() => window.dispatchEvent(new Event("focus")));
    await response;
  }
  async function visibility(value) {
    const response = await alice.request.get(app.base + "/api/eggs/room");
    assert.equal(response.status(), 200);
    const room = (await response.json()).room,
      next = editableRoom(room);
    next.profile.visibility = value;
    const save = await alice.request.put(app.base + "/api/eggs/room", {
      headers: { Origin: app.base },
      data: { revision: room.revision, value: next },
    });
    assert.equal(save.status(), 200, await save.text());
  }
  async function noOverflow(p, label) {
    const value = await p.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    if (value.scroll > value.client + 1) {
      fs.mkdirSync(".reference", { recursive: true });
      await p.screenshot({
        path: ".reference/community-browser-overflow.png",
        fullPage: true,
      });
    }
    assert.ok(
      value.scroll <= value.client + 1,
      label + " overflow: " + JSON.stringify(value),
    );
  }
  async function targets(p, selector, label) {
    const short = await p
      .locator(selector)
      .evaluateAll((nodes) =>
        nodes
          .filter(
            (node) =>
              !node.disabled &&
              node.getClientRects().length &&
              node.getBoundingClientRect().height < 43.5,
          )
          .map((node) => node.outerHTML.slice(0, 120)),
      );
    assert.deepEqual(short, [], label + " controls under 44px");
  }

  await publicPage.goto(app.base + "/projects");
  assert.equal(await publicPage.locator('link[rel="icon"][href="/brand/eggs-initial.svg"]').count(), 1);
  const iconResponse = await visitor.request.get(app.base + "/brand/eggs-initial.svg");
  assert.equal(iconResponse.status(), 200);
  assert.ok(iconResponse.headers()["content-type"].includes("image/svg+xml"));
  record("Studio metadata points to the deterministic EGGS initial icon, which returns HTTP 200 as SVG.");
  const reathCard = publicPage.locator(".project-reath-digest");
  assert.equal(
    await reathCard.getByRole("link").first().getAttribute("href"),
    "/reath-digest",
  );
  assert.ok(
    await reathCard
      .locator('img[src="/brand/reath-digest.png"]')
      .evaluate((image) => image.complete && image.naturalWidth > 0),
  );
  await reathCard.getByRole("link").first().click();
  await publicPage.waitForURL("**/reath-digest");
  assert.ok(
    await publicPage
      .getByRole("img", { name: "Reath Digest", exact: true })
      .evaluate((image) => image.complete && image.naturalWidth > 0),
  );
  record(
    "Reath project card opens the internal Digest reading room; the actual Reath logo loads.",
  );

  // Actual editorial UI, with fixtures clearly labelled as local verification.
  const editorial = await context(),
    editor = await editorial.newPage();
  await login(editor, "editor");
  await editor.goto(app.base + "/eggs-admin/works/new");
  await editor
    .getByLabel("Work title", { exact: true })
    .fill("Local verification fixture — Reath Funnies");
  await editor
    .getByLabel("Permanent slug", { exact: true })
    .fill("verification-funnies");
  await editor
    .getByLabel("Summary", { exact: true })
    .fill("Synthetic browser acceptance content; not an actual Reath release.");
  await editor
    .getByLabel("Description", { exact: true })
    .fill(
      "A local saved preview of original EGGS geometry in the Reath Funnies section.",
    );
  await editor
    .getByLabel("Publication format (optional)")
    .selectOption("funnies");
  await editor
    .getByLabel("Associated project (optional)")
    .selectOption(REATH_PROJECT_ID);
  await editor
    .getByRole("button", { name: "Save work draft", exact: true })
    .click();
  await editor.waitForURL(/\/eggs-admin\/works\/[0-9a-f-]+$/u);
  await editor.getByRole("link", { name: /Preview saved revision/u }).click();
  await editor
    .getByText("A publisher can publish or archive this saved revision.")
    .waitFor();
  assert.equal(
    await editor
      .getByRole("button", { name: "Publish this saved work", exact: true })
      .count(),
    0,
  );
  const preview = editor.url();
  await editorial.close();
  await login(pubPage, "publisher");
  await pubPage.goto(preview);
  const publishResponse = pubPage.waitForResponse(
    (r) =>
      r.url().endsWith("/api/eggs/hub/works") &&
      r.request().method() === "POST",
  );
  await pubPage
    .getByRole("button", { name: "Publish this saved work", exact: true })
    .click();
  assert.equal((await publishResponse).status(), 200);
  await publicPage.goto(app.base + "/reath-digest");
  await publicPage
    .getByRole("group", { name: "Publication collection" })
    .getByRole("button", { name: /Reath Funnies/u })
    .click();
  assert.equal(await publicPage.locator(".reath-publication-card").count(), 1);
  await publicPage
    .getByRole("heading", {
      name: "Local verification fixture — Reath Funnies",
      exact: true,
    })
    .waitFor();
  await publicPage
    .getByRole("group", { name: "Publication collection" })
    .getByRole("button", { name: /Videos/u })
    .click();
  assert.equal(await publicPage.locator(".reath-publication-card").count(), 1);
  assert.equal(await publicPage.locator("iframe,video").count(), 0);
  record(
    "Editor saves and previews a Funnies draft; publisher explicitly publishes; real Reath collections filter publications without embedding third-party video.",
  );

  await login(page, "alice");
  await page.goto(app.base + "/community");
  const post = await create(
    page,
    "Local browser verification — a shared EGGS hello.",
  );
  await login(bobPage, "bob");
  const onboarding = await bob.request.post(app.base + "/api/eggs/profile", {
    headers: { Origin: app.base },
    data: {
      handle: "local_bob",
      display_name: "Bob / local verification",
      bio: "A synthetic browser account.",
      visibility: "public",
    },
  });
  assert.equal(onboarding.status(), 201, await onboarding.text());
  await bobPage.goto(app.base + "/community");
  await postResponse(bobPage, () =>
    card(bobPage, post.body)
      .getByRole("button", { name: "Like post by @local_alice", exact: true })
      .click(),
  );
  await card(bobPage, post.body)
    .getByRole("button", { name: "Unlike post by @local_alice", exact: true })
    .waitFor();
  await bobPage.goto(app.base + "/community/" + post.id);
  const reply = await create(bobPage, "Local browser verification — Bob's reply.", true);
  const replyLink = card(bobPage, reply.body).locator("header a:has(time)");
  assert.equal(await replyLink.getAttribute("href"), "/community/" + post.id + "#post-" + reply.id);
  await replyLink.click();
  await bobPage.waitForURL(app.base + "/community/" + post.id + "#post-" + reply.id);
  await card(bobPage, reply.body).waitFor();
  record(
    "Alice creates a post through the composer; Bob creates a public account, likes once and replies through the thread UI; reply permalinks resolve to the parent conversation and reply anchor.",
  );
  await publicPage.goto(app.base + "/people");
  await publicPage.getByLabel("Find a name or handle", { exact: true }).fill("local_bob");
  await publicPage.getByRole("button", { name: "Find people", exact: true }).click();
  await publicPage.waitForURL("**/people?q=local_bob");
  assert.equal(await publicPage.locator(".people-card").count(), 1);
  assert.ok((await publicPage.locator(".people-card").innerText()).includes("@local_bob"));
  record("People search submits a real public directory query and finds only the matching public handle.");

  await page.goto(app.base + "/community");
  let own = page.locator("#post-" + post.id);
  await own.getByRole("button", { name: "Edit", exact: true }).click();
  const unsaved = "Unsaved browser draft must survive a refresh and conflict.";
  await own.getByLabel("Edit your post", { exact: true }).fill(unsaved);
  const second = await alice.newPage();
  await second.goto(app.base + "/community");
  const peer = second.locator("#post-" + post.id);
  await peer.getByRole("button", { name: "Edit", exact: true }).click();
  await peer
    .getByLabel("Edit your post", { exact: true })
    .fill("Local browser verification — winning second-tab edit.");
  await postResponse(second, () =>
    peer.getByRole("button", { name: "Save edit", exact: true }).click(),
  );
  await postResponse(page, () =>
    own
      .getByRole("button", { name: "Like post by @local_alice", exact: true })
      .click(),
  );
  own = page.locator("#post-" + post.id);
  assert.equal(
    await own.getByLabel("Edit your post", { exact: true }).inputValue(),
    unsaved,
  );
  await postResponse(
    page,
    () => own.getByRole("button", { name: "Save edit", exact: true }).click(),
    409,
  );
  assert.equal(
    await own.getByLabel("Edit your post", { exact: true }).inputValue(),
    unsaved,
  );
  const saved = await (
    await visitor.request.get(app.base + "/api/eggs/community/posts/" + post.id)
  ).json();
  assert.equal(
    saved.post.body,
    "Local browser verification — winning second-tab edit.",
  );
  await own.getByRole("button", { name: "Cancel", exact: true }).click();
  await own.getByRole("button", { name: "Edit", exact: true }).click();
  await own
    .getByLabel("Edit your post", { exact: true })
    .fill("Local browser verification — a shared EGGS hello, revised.");
  await postResponse(page, () =>
    own.getByRole("button", { name: "Save edit", exact: true }).click(),
  );
  await second.close();
  const finalBody =
    "Local browser verification — a shared EGGS hello, revised.";
  record(
    "Two editor tabs conflict with HTTP 409; a Like-triggered refresh preserves the unsaved draft and its original revision; a fresh owner edit succeeds.",
  );
  const remove = await create(
    page,
    "Local browser verification — temporary post to delete.",
  );
  const doomed = card(page, remove.body);
  await doomed.getByRole("button", { name: "Delete", exact: true }).click();
  await postResponse(page, () =>
    doomed.getByRole("button", { name: "Remove post", exact: true }).click(),
  );
  await doomed.waitFor({ state: "detached" });
  record(
    "Owner deletion uses an explicit confirmation and removes the disposable post.",
  );

  await publicPage.goto(app.base + "/community");
  await card(publicPage, finalBody).waitFor();
  await visibility("private");
  await focusRefresh(publicPage);
  await card(publicPage, finalBody).waitFor({ state: "detached" });
  await visibility("public");
  await focusRefresh(publicPage);
  await card(publicPage, finalBody).waitFor();
  record(
    "Changing overall profile privacy through the room API removes and restores authored content in an already-open visitor feed on focus.",
  );

  async function hideThroughUi() {
    await pubPage.goto(app.base + "/community");
    const target = card(pubPage, finalBody);
    await target.getByText("Publisher controls", { exact: true }).click();
    await target
      .getByLabel("Decision reason", { exact: true })
      .fill("Local browser moderation verification.");
    await postResponse(pubPage, () =>
      target.getByRole("button", { name: "Hide post", exact: true }).click(),
    );
    await pubPage.goto(app.base + "/eggs-admin/community");
    await card(pubPage, finalBody).waitFor();
  }
  await hideThroughUi();
  const hidden = card(pubPage, finalBody);
  await hidden.getByText("Publisher controls", { exact: true }).click();
  await hidden
    .getByLabel("Decision reason", { exact: true })
    .fill("Local browser restore verification.");
  await targets(
    pubPage,
    ".community-stream button,.community-stream input",
    "Publisher review",
  );
  await postResponse(pubPage, () =>
    hidden.getByRole("button", { name: "Restore post", exact: true }).click(),
  );
  await hidden.waitFor({ state: "detached" });
  await hideThroughUi();
  await fixture.db.admin.query("delete from auth.sessions where user_id=$1", [
    hubIds.publisher,
  ]);
  await focusRefresh(pubPage);
  await card(pubPage, finalBody).waitFor({ state: "detached" });
  assert.ok(!(await pubPage.locator("body").innerText()).includes(finalBody));
  await login(pubPage, "publisher");
  await pubPage.goto(app.base + "/eggs-admin/community");
  await card(pubPage, finalBody).waitFor();
  const logout = await publisher.request.post(
    app.base + "/api/eggs/auth/logout",
    { headers: { Origin: app.base } },
  );
  assert.equal(logout.status(), 200, await logout.text());
  await pubPage.evaluate(() => window.dispatchEvent(new Event("eggs-auth")));
  await card(pubPage, finalBody).waitFor({ state: "detached" });
  assert.ok(!(await pubPage.locator("body").innerText()).includes(finalBody));
  record(
    "Publisher hides and restores with reasons; revoked-session focus and logout auth-change both remove hidden queue content from the DOM.",
  );
  await login(pubPage, "publisher");
  await pubPage.goto(app.base + "/eggs-admin/community");
  const restore = card(pubPage, finalBody);
  await restore.getByText("Publisher controls", { exact: true }).click();
  await restore
    .getByLabel("Decision reason", { exact: true })
    .fill("Restore for local screenshot verification.");
  await postResponse(pubPage, () =>
    restore.getByRole("button", { name: "Restore post", exact: true }).click(),
  );

  // Forty new captures. Existing Personal Internet evidence is never overwritten.
  for (const theme of ["carton", "after-hours"]) {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await publicPage.setViewportSize({ width, height: 950 });
      for (const [name, route] of [
        ["home", "/"],
        ["reath-digest", "/reath-digest"],
        ["community", "/community"],
        ["people", "/people"],
      ]) {
        await publicPage.goto(app.base + route);
        await publicPage
          .getByLabel("Studio theme", { exact: true })
          .selectOption(theme);
        await publicPage.evaluate(() => document.fonts.ready);
        await publicPage.waitForFunction(
          (value) =>
            document.querySelector(".personal-studio")?.dataset.theme === value,
          theme,
        );
        await noOverflow(publicPage, name + " / " + theme + " / " + width);
        assert.equal(
          await publicPage.locator("h1").count(),
          1,
          name + " semantic main heading",
        );
        await targets(
          publicPage,
          ".reath-reader button,.reath-reader input,.people-search button,.people-search input,.community-stream button,.community-stream input,.community-stream textarea",
          name,
        );
        const filename = name + "-" + theme + "-" + width + ".png";
        await publicPage.screenshot({
          path: path.join(out, filename),
          fullPage: true,
        });
        screenshots.push(filename);
      }
    }
  }
  assert.equal(screenshots.length, 40);
  record(
    "Home, Reath Digest, Community and People captured in both themes at 320/390/768/1024/1440px; no document overflow and one main heading per page.",
  );
  await page.goto(app.base + "/community");
  await page.getByLabel("Your post", { exact: true }).waitFor();
  await targets(
    page,
    ".community-stream button,.community-stream input,.community-stream textarea",
    "Signed-in community",
  );
  await publicPage.emulateMedia({ reducedMotion: "reduce" });
  await publicPage.goto(app.base + "/community");
  assert.equal(
    await publicPage.evaluate(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    true,
  );
  await publicPage.keyboard.press("Tab");
  const focus = await publicPage.evaluate(() => ({
    tag: document.activeElement.tagName,
    outline: getComputedStyle(document.activeElement).outlineStyle,
  }));
  assert.notEqual(focus.tag, "BODY");
  assert.notEqual(focus.outline, "none");
  await page
    .getByLabel("Your post", { exact: true })
    .fill("Local long-content verification " + "W".repeat(970));
  await noOverflow(page, "Long unbroken composer content");
  record(
    "New form controls meet 44px height, labels are usable, keyboard focus is visible, reduced motion is active and long composer text does not overflow.",
  );
  fs.writeFileSync(
    path.join(out, "browser-results.json"),
    JSON.stringify(
      {
        browser: await browser.version(),
        transport:
          "Real built Next.js + PostgreSQL 17 + native PostgREST 16.4; simulated Auth only",
        fixtureContent:
          "All people, posts and Reath works shown are disposable local browser verification fixtures; the normal preview seeds no community posts.",
        checks,
        screenshots,
        consoleErrors: errors,
        networkDiagnostics,
      },
      null,
      2,
    ) + "\n",
  );
  assert.deepEqual(errors, []);
} finally {
  for (const fn of cleanup.reverse()) await fn();
}
