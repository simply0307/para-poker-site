import {
  ConsumerError,
  onlyFields,
  profileInput,
  uuid,
} from "../eggs/consumerCore.mjs";
import { expressionInput } from "../hub/core.mjs";
import {
  themes,
  wallpapers,
  covers,
  avatars,
  stamps,
  modules,
  workAssets,
} from "./registry.mjs";
import { accents } from "../hub/catalog.mjs";
export const roomsEnabled = (env = process.env) =>
  env.EGGS_ROOMS_ENABLED === "true";
const invalid = (message) => {
  throw new ConsumerError(400, message);
};
function record(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid("Check the submitted fields.");
  onlyFields(value, keys);
  if (keys.some((k) => !Object.hasOwn(value, k)))
    invalid("Include every room field.");
}
export function roomCommand(value) {
  record(value, ["revision", "value"]);
  if (!Number.isSafeInteger(value.revision) || value.revision < 0)
    invalid("Reload your room before saving.");
  const v = value.value;
  record(v, [
    "profile",
    "expression",
    "appearance",
    "module_visibility",
    "module_order",
    "showcase",
  ]);
  record(v.profile, ["display_name", "bio", "visibility"]);
  record(v.expression, [
    "favorite_project_ids",
    "affiliation",
    "pinned_project_id",
    "featured_note",
    "accent",
  ]);
  profileInput(v.profile);
  expressionInput(v.expression);
  const a = v.appearance;
  record(a, ["theme", "wallpaper", "cover", "avatar", "accent", "stamps"]);
  for (const [key, registry] of Object.entries({
    theme: themes,
    wallpaper: wallpapers,
    cover: covers,
    avatar: avatars,
    accent: accents,
  }))
    if (!Object.hasOwn(registry, a[key]))
      invalid("Choose a listed appearance.");
  if (
    !Array.isArray(a.stamps) ||
    a.stamps.length > 12 ||
    new Set(a.stamps).size !== a.stamps.length ||
    a.stamps.some((s) => !Object.hasOwn(stamps, s))
  )
    invalid("Choose listed stamps once each.");
  record(v.module_visibility, Object.keys(modules));
  if (
    Object.keys(modules).some(
      (k) => typeof v.module_visibility[k] !== "boolean",
    )
  )
    invalid("Choose module visibility.");
  if (
    !Array.isArray(v.module_order) ||
    v.module_order.length !== 5 ||
    new Set(v.module_order).size !== 5 ||
    v.module_order.some((k) => !Object.hasOwn(modules, k))
  )
    invalid("Include each module once.");
  if (!Array.isArray(v.showcase) || v.showcase.length > 8)
    invalid("Choose up to eight items.");
  const seen = new Set();
  for (const item of v.showcase) {
    record(item, ["type", "id"]);
    if (!["project", "work"].includes(item.type))
      invalid("Choose a project or work.");
    uuid(item.id);
    const key = item.type + ":" + item.id.toLowerCase();
    if (seen.has(key)) invalid("Choose each item once.");
    seen.add(key);
  }
  return { p_revision: value.revision, p_value: v };
}
export function workCommand(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid("Check the work fields.");
  onlyFields(value, ["id", "slug", "version", "action", "content"]);
  if (
    !["save", "publish", "archive"].includes(value.action) ||
    !Number.isSafeInteger(value.version) ||
    value.version < 0
  )
    invalid("Choose a work action and revision.");
  if (
    typeof value.slug !== "string" ||
    value.slug.length < 3 ||
    value.slug.length > 64 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value.slug)
  )
    invalid("Use a stable lowercase work slug.");
  if (!value.id && (value.action !== "save" || value.version !== 0))
    invalid("Create a draft first.");
  if (value.action !== "save" && value.content != null)
    invalid("Save and preview this revision first.");
  const command = {
    p_id: value.id ? uuid(value.id) : null,
    p_slug: value.slug,
    p_version: value.version,
    p_action: value.action,
    p_content: null,
  };
  if (value.action === "save") {
    const c = value.content;
    record(c, ["title", "summary", "description", "asset_id", "project_id"]);
    for (const [k, max] of [
      ["title", 80],
      ["summary", 240],
      ["description", 3000],
    ])
      if (typeof c[k] !== "string" || !c[k].trim() || c[k].length > max)
        invalid("Check the " + k + ".");
    if (!Object.hasOwn(workAssets, c.asset_id))
      invalid("Choose an approved asset.");
    if (c.project_id !== null) uuid(c.project_id);
    command.p_content = c;
  }
  return command;
}
export function editableRoom(room) {
  const m = room.modules;
  return {
    profile: {
      display_name: room.profile.display_name,
      bio: m.bio || "",
      visibility: room.visibility,
    },
    expression: {
      favorite_project_ids: m.favorite_project_ids || [],
      affiliation: m.affiliation || "",
      pinned_project_id: m.pinned_project_id || null,
      featured_note: m.featured_note || "",
      accent: m.accent || "sage",
    },
    appearance: room.appearance,
    module_visibility: room.module_visibility,
    module_order: room.module_order,
    showcase: (m.showcase || []).map(({ type, id }) => ({ type, id })),
  };
}
