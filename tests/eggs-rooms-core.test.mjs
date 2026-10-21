import test from "node:test";
import assert from "node:assert/strict";
import {
  roomCommand,
  editableRoom,
  workCommand,
  roomsEnabled,
} from "../src/lib/rooms/core.mjs";
import {
  themes,
  wallpapers,
  covers,
  avatars,
  stamps,
  defaultAppearance,
  defaultOrder,
  defaultVisibility,
} from "../src/lib/rooms/registry.mjs";
const value = () => ({
  profile: { display_name: "Alice", bio: "Bio", visibility: "private" },
  expression: {
    favorite_project_ids: [],
    affiliation: "",
    pinned_project_id: null,
    featured_note: "",
    accent: "sage",
  },
  appearance: structuredClone(defaultAppearance),
  module_order: [...defaultOrder],
  module_visibility: { ...defaultVisibility },
  showcase: [],
});
test("room registries have the exact approved option counts and a separate default gate", () => {
  assert.equal(Object.keys(themes).length, 2);
  assert.equal(Object.keys(wallpapers).length, 6);
  assert.equal(Object.keys(covers).length, 4);
  assert.equal(Object.keys(stamps).length, 12);
  assert.equal(Object.keys(avatars).length, 4);
  assert.equal(
    roomsEnabled({ EGGS_HUB_ENABLED: "true", EGGS_CONSUMER_ENABLED: "true" }),
    false,
  );
});
test("room input rejects incomplete, forged, unsafe and duplicate data before SQL", () => {
  for (const body of [
    null,
    {},
    { revision: 0, value: [] },
    { revision: 0, value: { ...value(), profile: null } },
    {
      revision: 0,
      value: {
        ...value(),
        appearance: { ...defaultAppearance, theme: "<script>" },
      },
    },
    {
      revision: 0,
      value: { ...value(), module_order: ["bio", "bio", "bio", "bio", "bio"] },
    },
    {
      revision: 0,
      value: {
        ...value(),
        profile: { ...value().profile, auth_user_id: "forged" },
      },
    },
    {
      revision: 0,
      value: {
        ...value(),
        showcase: Array(9).fill({
          type: "project",
          id: "a0000000-0000-4000-8000-000000000001",
        }),
      },
    },
  ])
    assert.throws(
      () => roomCommand(body),
      (e) => e.status === 400,
    );
  const valid = value();
  assert.deepEqual(roomCommand({ revision: 0, value: valid }), {
    p_revision: 0,
    p_value: valid,
  });
  const original = {
    profile: { id: "private-owner-id", handle: "alice", display_name: "Alice" },
    visibility: "private",
    revision: 4,
    appearance: defaultAppearance,
    module_order: defaultOrder,
    module_visibility: defaultVisibility,
    modules: {
      bio: "Bio",
      favorite_project_ids: [],
      affiliation: "",
      featured_note: "",
      accent: "sage",
      showcase: [],
    },
  };
  assert.equal(Object.hasOwn(editableRoom(original), "profile_id"), false);
  assert.equal(Object.hasOwn(editableRoom(original).profile, "id"), false);
});
test("works require known assets and cannot inject saved content into publish", () => {
  const c = {
    title: "Work",
    summary: "Summary",
    description: "Description",
    asset_id: "signal-grid",
    project_id: null,
  };
  assert.equal(
    workCommand({ slug: "a-work", version: 0, action: "save", content: c })
      .p_content.asset_id,
    "signal-grid",
  );
  for (const content of [
    null,
    { ...c, asset_id: "https://example.com/x.svg" },
    { ...c, permitted_use: "approved" },
    { ...c, project_id: "fabricated" },
  ])
    assert.throws(
      () =>
        workCommand({ slug: "a-work", version: 0, action: "save", content }),
      (e) => e.status === 400,
    );
  assert.throws(
    () =>
      workCommand({
        id: "a0000000-0000-4000-8000-000000000001",
        slug: "a-work",
        version: 1,
        action: "publish",
        content: c,
      }),
    (e) => e.status === 400,
  );
});
test("theme foreground/background pairs meet normal-text WCAG AA contrast", () => {
  const luminance = (hex) => {
    const c = hex
      .match(/\w\w/gu)
      .map((x) => parseInt(x, 16) / 255)
      .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  };
  const pairs = [
    ["153f31", "f5f0df"],
    ["48574b", "fffdf5"],
    ["fffdf4", "244dc6"],
    ["173e30", "f8d953"],
    ["ecebd2", "18121f"],
    ["d0c5d8", "251c30"],
    ["ff95d5", "18121f"],
    ["d8f35d", "251c30"],
    ["fffdf5", "28624a"],
    ["fffdf5", "805400"],
    ["fffdf5", "234fac"],
    ["fffdf5", "8e3156"],
    ["f0edcd", "333b9b"],
    ["223c31", "fafbf7"],
  ];
  for (const [fg, bg] of pairs) {
    const values = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
    assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 4.5, fg + "/" + bg);
  }
});
