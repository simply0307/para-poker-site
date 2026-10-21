import test from "node:test";
import assert from "node:assert/strict";
import {
  reathSource, eggsChannel, publicPageImage, existingReathReleases,
  publicChannelVideos, existingReathCatalog, mergeReathCatalog,
} from "../src/lib/reath/releases.mjs";
import { filterPublications, collectionCounts } from "../src/lib/reath/catalog.mjs";

const ids = ["Z-O7nCVcmtk", "mYIwd3oYa4Q", "l08RyKzGOdQ", "YDPbD-CD_JU", "cEttP93mDjo", "eDV18i6RMBg", "WfD4lCPag6o", "smU3UXIX0Uk", "o9MW6jRTJ6I", "mZJgOF8FLCI", "7qaa1lRM4X8"];

test("four existing public reading copies retain their exact sources, gallery order and credits", () => {
  const releases = existingReathReleases();
  assert.equal(releases.length, 4);
  assert.deepEqual(releases.map(item => item.slug), ["a-natural-choice", "moon-bars", "reath-in-review-edition-1", "reath-in-review-edition-2"]);
  assert.deepEqual(releases.map(item => item.gallery.length), [5, 6, 1, 1]);
  assert.equal(new Set(releases.map(item => item.id)).size, 4);
  for (const release of releases) {
    assert.equal(release.href, "/reath-digest/" + release.slug);
    assert.equal(release.id, "release:" + release.slug);
    assert.match(release.source_url, /^https:\/\/reath-digest\.carrd\.co\/#(?:funniesedition[12]|reathinreviewedition[12])$/u);
    assert.match(release.attribution, /Eternal Galaxy Gaming Studio/u);
    assert.equal(release.cover_url, release.gallery[0].url);
    assert.deepEqual(release.gallery.map(page => page.order), release.gallery.map((_, i) => i + 1));
    assert.ok(release.gallery.every(page => publicPageImage(page.url)));
  }
  assert.equal(reathSource.url, "https://reath-digest.carrd.co/");
  assert.match(reathSource.notice, /fictional and satirical/u);
  assert.doesNotMatch(JSON.stringify(releases), /drive\.google|docs\.google|service_role|auth_user_id|Thirteenth Inkgredient/u);
});

test("publication dates use observed precision rather than invented archive days", () => {
  const [choice, moon, first, second] = existingReathReleases();
  assert.equal(choice.published_at, "2026-07-23");
  assert.equal(moon.published_at, "2026-07-23");
  for (const issue of [first, second]) {
    assert.equal(issue.published_at, null);
    assert.equal(issue.created_label, "January 2026");
    assert.equal(issue.status, "public-archive");
  }
});

test("source topics resolve the user spelling Infatimer and the Miro Bloom subject", () => {
  const catalog = existingReathCatalog();
  assert.deepEqual(filterPublications(catalog, { query: "Infatimer" }).map(item => item.slug), ["a-natural-choice"]);
  assert.deepEqual(filterPublications(catalog, { query: "Commissioner Infinitimer" }).map(item => item.slug), ["a-natural-choice"]);
  const miro = filterPublications(catalog, { query: "Miro Bloom" });
  assert.ok(miro.some(item => item.slug === "moon-bars"));
  assert.deepEqual(filterPublications(catalog, { query: "Narrative Arbitrage" }).map(item => item.slug), ["reath-in-review-edition-2"]);
  assert.deepEqual(filterPublications(catalog, { query: "Thirteenth Inkgredient" }), []);
  assert.equal(collectionCounts(catalog).funnies, 2);
  assert.equal(collectionCounts(catalog).publications, 2);
  assert.equal(collectionCounts(catalog).videos, 3);
});

test("public page image allowlist rejects caller URLs, alternate schemes, lookalike hosts and extra query data", () => {
  const real = existingReathReleases()[0].gallery[0].url;
  assert.equal(publicPageImage(real), true);
  for (const value of [undefined, null, {}, "", "javascript:alert(1)", "//reath-digest.carrd.co/assets/images/image06.jpg?v=cc888db5", "http://reath-digest.carrd.co/assets/images/image06.jpg?v=cc888db5", "https://reath-digest.carrd.co.evil.test/assets/images/image06.jpg?v=cc888db5", "https://user:password@reath-digest.carrd.co/assets/images/image06.jpg?v=cc888db5", "https://reath-digest.carrd.co/assets/images/../../secret.jpg?v=cc888db5", "https://reath-digest.carrd.co/assets/images/image06.svg?v=cc888db5", real + "&source=https://evil.test", real + "#fragment", "https://evil.test/user.jpg"]) {
    assert.equal(publicPageImage(value), false, String(value));
  }
});

test("all eleven official watch entries retain verified IDs, dates and scope", () => {
  const videos = publicChannelVideos();
  assert.deepEqual(videos.map(video => video.id.slice(6)), ids);
  assert.equal(eggsChannel.id, "UCSaLwO8Mw9YmMuCzZDvvIcw");
  assert.equal(eggsChannel.public_upload_count, 11);
  for (const video of videos) {
    const id = video.id.slice(6);
    assert.equal(video.source_url, "https://www.youtube.com/watch?v=" + id);
    assert.equal(video.href, "/watch/" + id);
    assert.match(video.published_at, /^20[0-9]{2}-[0-9]{2}-[0-9]{2}T/u);
    assert.ok(Number.isFinite(Date.parse(video.published_at)));
    assert.match(video.duration, /^PT[0-9]+M[0-9]+S$/u);
    assert.ok(video.summary.length > 20);
    assert.equal(video.cover_url, null, "No unsolicited YouTube thumbnail request");
  }
  // The source timestamp can be serialized in another offset without inventing
  // a different instant; compare the observed instant, not display timezone.
  assert.equal(Date.parse(videos.find(video => video.id.endsWith("o9MW6jRTJ6I")).published_at), Date.parse("2025-09-17T15:36:10-07:00"));
  assert.equal(Date.parse(videos.find(video => video.id.endsWith("mZJgOF8FLCI")).published_at), Date.parse("2025-09-16T22:23:38-07:00"));
  assert.equal(Date.parse(videos.find(video => video.id.endsWith("7qaa1lRM4X8")).published_at), Date.parse("2025-09-16T22:18:33-07:00"));
  for (const id of ["cEttP93mDjo", "mZJgOF8FLCI", "7qaa1lRM4X8"]) {
    assert.equal(videos.find(video => video.id.endsWith(id)).published_at.slice(0, 10), "2025-09-16", "Preserve the source calendar day for late-night uploads");
  }
  assert.equal(videos.find(video => video.id.endsWith("mYIwd3oYa4Q")).scope, "gauntlet");
  assert.match(videos.find(video => video.id.endsWith("eDV18i6RMBg")).ai_disclosure, /Made with AI/u);
  assert.match(videos.find(video => video.id.endsWith("smU3UXIX0Uk")).ai_disclosure, /Made with AI/u);
});

test("empty Hub data never hides existing releases and unrelated channel videos do not become Reath publications", () => {
  const catalog = mergeReathCatalog([]);
  assert.equal(catalog.length, 7);
  assert.equal(catalog.filter(item => item.id.startsWith("release:")).length, 4);
  assert.deepEqual(catalog.filter(item => item.format === "video").map(item => item.id.slice(6)), ["eDV18i6RMBg", "WfD4lCPag6o", "smU3UXIX0Uk"]);
  const duplicate = { ...catalog[0], summary: "A replacement must not override a curated source" };
  const next = mergeReathCatalog([duplicate, { id: "published:fixture", slug: "fixture" }]);
  assert.equal(next.length, 8);
  assert.equal(next[0].summary, catalog[0].summary);
});
