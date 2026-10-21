// Built Next.js + real disposable PostgreSQL 17/PostgREST. No account is
// created here; the fixture's Auth service is synthetic, not hosted evidence.
// Reading-copy and video metadata are the actual existing public releases.
import test from "node:test";
import assert from "node:assert/strict";
import { hasPostgres } from "./helpers/localPostgres.mjs";
import { hasPostgrest } from "./helpers/localPostgrest.mjs";
import { communityHttpFixture } from "./helpers/communityHttpFixture.mjs";
import { startConsumerApp, stopConsumerApp } from "./helpers/consumerHttpFixture.mjs";
import { existingReathReleases, publicChannelVideos } from "../src/lib/reath/releases.mjs";

const escaped = value => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
const withoutAutomaticMedia = html => {
  assert.doesNotMatch(html, /<iframe\b|<video\b|<audio\b/iu);
  assert.doesNotMatch(html, /<(?:img|script|link)\b[^>]*(?:src|href)="https:\/\/(?:www\.)?(?:youtube(?:-nocookie)?\.com|i\.ytimg\.com|googlevideo\.com)/iu);
};

test("existing Reath releases and official videos survive empty local Hub publication data", {
  skip: !hasPostgres || !hasPostgrest,
  timeout: 180000,
}, async t => {
  const fixture = await communityHttpFixture(t);
  assert.equal(Number((await fixture.db.admin.query("select count(*)::int as count from public.eggs_works")).rows[0].count), 0);
  const app = await startConsumerApp({ ...fixture.env, EGGS_LORE_ENABLED: "true" });
  t.after(() => stopConsumerApp(app));
  const read = async route => {
    const response = await fetch(app.base + route, { redirect: "manual" });
    return { response, html: await response.text() };
  };
  const releases = existingReathReleases(), videos = publicChannelVideos();

  await t.test("anonymous reading shelf contains real releases, search topics and only the three Reath videos", async () => {
    const { response, html } = await read("/reath-digest");
    assert.equal(response.status, 200);
    for (const release of releases) assert.ok(html.includes('href="' + release.href + '"'), release.title);
    assert.match(html, /Infatimer|Infinitimer/u);
    assert.match(html, /Miro Bloom/u);
    assert.doesNotMatch(html, /The shelves are ready for their first releases|Publications are temporarily unavailable/u);
    for (const video of videos) {
      const linked = html.includes('href="' + video.href + '"');
      assert.equal(linked, ["reath", "reath-funnies"].includes(video.scope), video.title);
    }
    assert.ok(html.includes('href="https://reath-digest.carrd.co/"'));
    withoutAutomaticMedia(html);
    assert.doesNotMatch(html, /drive\.google|docs\.google|service-role-key-never-public/u);
  });

  await t.test("all four readers expose exact source galleries, credit and valid query-selected pages", async () => {
    for (const release of releases) {
      for (let page = 1; page <= release.gallery.length; page++) {
        const { response, html } = await read(release.href + "?page=" + page);
        assert.equal(response.status, 200, release.href);
        assert.ok(html.includes('src="' + escaped(release.gallery[page - 1].url) + '"'), release.slug + " selected image page " + page);
        assert.ok(html.includes('href="' + escaped(release.source_url) + '"'), "Original release retained");
        assert.match(html, /Eternal Galaxy Gaming Studio/u);
        assert.match(html, /fictional and satirical/u);
        for (const image of release.gallery) assert.ok(html.includes(image.url), "Public gallery retained in reader data");
        if (release.published_at) assert.ok(html.includes(release.published_at));
        else assert.ok(html.includes("January 2026"), "Archive month retained without an invented day");
        withoutAutomaticMedia(html);
      }
    }
  });

  await t.test("invalid reading page values reset safely and caller remote URLs never enter HTML or embedded data", async () => {
    for (const value of ["0", "-1", "999", "NaN", "1.5"]) {
      const { response, html } = await read("/reath-digest/a-natural-choice?page=" + value + "&image_url=https%3A%2F%2Fcaller-media.invalid%2Fprivate.jpg");
      assert.equal(response.status, 200);
      assert.ok(html.includes('src="' + releases[0].gallery[0].url + '"'));
      // Next may serialize the requested location itself. That harmless text
      // must never become a rendered/preloaded media resource or navigation.
      assert.doesNotMatch(html, /<(?:img|iframe|video|audio|source|link|a)\b[^>]*(?:src|href)="[^"]*caller-media\.invalid/iu);
    }
  });

  await t.test("video room lists all eleven actual watch routes and each player waits for visitor choice", async () => {
    const { response, html } = await read("/watch");
    assert.equal(response.status, 200);
    for (const route of ["/lore", "/community", "/people"]) {
      assert.ok(html.includes('href="' + route + '"'), "Watch navigation honors enabled runtime feature " + route);
    }
    for (const video of videos) {
      assert.ok(html.includes('href="' + video.href + '"'), video.title);
      const detail = await read(video.href);
      assert.equal(detail.response.status, 200, video.href);
      assert.ok(detail.html.includes('href="' + video.source_url + '"'), "Exact canonical watch link");
      assert.match(detail.html, /Play video here/u);
      assert.match(detail.html, /No YouTube media loads until you choose to play/u);
      if (video.ai_disclosure) assert.match(detail.html, /Made with AI/u);
      withoutAutomaticMedia(detail.html);
    }
    assert.ok(html.includes('href="https://www.youtube.com/@EternalGalaxyGamingStudio"'));
    withoutAutomaticMedia(html);
  });

  await t.test("reader and watch detail omit Lore links when that runtime feature is disabled", async () => {
    const withoutLore = await startConsumerApp({ ...fixture.env, EGGS_LORE_ENABLED: "false" });
    t.after(() => stopConsumerApp(withoutLore));
    for (const route of ["/reath-digest/moon-bars", "/watch/eDV18i6RMBg"]) {
      const response = await fetch(withoutLore.base + route);
      const html = await response.text();
      assert.equal(response.status, 200, route);
      assert.doesNotMatch(html, /href="\/lore(?:[/?#"])/u, "Disabled Lore must not leave a visitor-facing dead link");
      assert.ok(html.includes('href="/community"'), "Unrelated enabled community remains available");
      assert.ok(html.includes('href="/people"'), "Unrelated enabled people remains available");
      withoutAutomaticMedia(html);
    }
  });

  await t.test("unknown publications and non-catalog video IDs remain unavailable", async () => {
    for (const route of ["/reath-digest/not-a-publication", "/reath-digest/thirteenth-inkgredient", "/watch/aaaaaaaaaaa", "/watch/invalid-id"]) {
      const { response, html } = await read(route);
      assert.equal(response.status, 404, route);
      withoutAutomaticMedia(html);
    }
  });
});
