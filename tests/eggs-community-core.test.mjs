import test from "node:test";
import assert from "node:assert/strict";
import {
  communityEnabled,
  communityCommand,
  feedOptions,
  peopleOptions,
} from "../src/lib/community/core.mjs";
import { workCommand } from "../src/lib/rooms/core.mjs";
import {
  readerProject,
  projectBrand,
  projectLanding,
} from "../src/lib/hub/destinations.mjs";
import { bootstrapProjects } from "../src/lib/hub/catalog.mjs";
const id = "d0000000-0000-4000-8000-000000000001";
test("community is separately gated; cursor and people inputs are bounded", () => {
  assert.equal(
    communityEnabled({ EGGS_ROOMS_ENABLED: "true", EGGS_HUB_ENABLED: "true" }),
    false,
  );
  assert.equal(communityEnabled({ EGGS_COMMUNITY_ENABLED: "true" }), true);
  assert.deepEqual(feedOptions(new URLSearchParams()), {
    p_before: null,
    p_before_id: null,
    p_author: null,
    p_limit: 20,
  });
  assert.deepEqual(peopleOptions(new URLSearchParams({ q: " Alice " })), {
    p_query: "Alice",
    p_after: null,
    p_limit: 24,
  });
  assert.equal(
    peopleOptions(new URLSearchParams({ q: "@alice" })).p_query,
    "alice",
  );
  for (const p of [
    { before: "2026-10-20T10:00:00Z" },
    { before: "bad", before_id: id },
    { limit: "51" },
    { author: "Alice" },
    { profile_id: id },
  ])
    assert.throws(
      () => feedOptions(new URLSearchParams(p)),
      (e) => e.status === 400,
    );
  for (const p of [
    { q: "x".repeat(81) },
    { limit: "49" },
    { after: "../private" },
  ])
    assert.throws(
      () => peopleOptions(new URLSearchParams(p)),
      (e) => e.status === 400,
    );
});
test("feed commands reject owner forgery and action-specific unexpected fields", () => {
  assert.equal(
    communityCommand({ action: "create", body: "Hello EGGS" }).p_body,
    "Hello EGGS",
  );
  assert.equal(
    communityCommand({ action: "edit", id, body: "Edited", revision: 1 })
      .p_revision,
    1,
  );
  for (const input of [
    { action: "create", body: "hi", profile_id: id },
    { action: "create", body: "hi", id },
    { action: "create", body: "x".repeat(1001) },
    { action: "create", body: " " },
    { action: "edit", id, body: "edit" },
    { action: "edit", id, body: "edit", revision: 0 },
    { action: "like", id, body: "extra" },
    { action: "unlike", id, revision: 1 },
    { action: "hide", id, body: "x".repeat(241) },
    { action: "restore", id, body: "" },
    { action: "delete", id, parent: id },
    { action: "publish", id },
  ])
    assert.throws(
      () => communityCommand(input),
      (e) => e.status === 400,
    );
});
test("publication formats preserve legacy drafts and only accept canonical video links", () => {
  const content = {
    title: "A work",
    summary: "A summary",
    description: "Original work",
    asset_id: "signal-grid",
    project_id: null,
  };
  const command = (c) =>
    workCommand({
      action: "save",
      slug: "original-work",
      version: 0,
      content: c,
    });
  assert.deepEqual(command(content).p_content, content);
  assert.equal(
    command({ ...content, format: "funnies" }).p_content.format,
    "funnies",
  );
  assert.equal(
    command({
      ...content,
      format: "video",
      media_url: "https://www.youtube.com/watch?v=abcdefghijk",
    }).p_content.format,
    "video",
  );
  for (const c of [
    { format: "private" },
    { format: "video" },
    { format: "video", media_url: "" },
    { media_url: "https://vimeo.com/123" },
    { format: "video", media_url: "https://drive.google.com/file/d/private" },
    { format: "video", media_url: "https://vimeo.com/0" },
    {
      format: "video",
      media_url: "https://www.youtube.com/watch?v=abcdefghijk&x=1",
    },
    { format: "article", media_url: "https://vimeo.com/123" },
    { permission: "approved" },
  ])
    assert.throws(
      () => command({ ...content, ...c }),
      (e) => e.status === 400,
    );
});
test("Reath reader routing is bound to the real project identity; logos stay in scope", () => {
  const reath = bootstrapProjects.find((p) => p.slug === "reath-digest"),
    gauntlet = bootstrapProjects.find((p) => p.slug === "gauntlet-online");
  assert.equal(readerProject(reath).content.destination, "/reath-digest");
  assert.equal(projectLanding(reath), "/reath-digest");
  assert.equal(projectBrand(reath).src, "/brand/reath-digest.png");
  assert.equal(projectBrand(gauntlet).src, "/brand/gauntlet.png");
  assert.equal(
    readerProject(bootstrapProjects.find((p) => p.slug === "eggs-poker"))
      .content.status,
    "playtest",
  );
  assert.equal(projectBrand({ ...gauntlet, id }), null);
  assert.equal(
    readerProject({ ...reath, id }).content.destination,
    reath.content.destination,
  );
});
