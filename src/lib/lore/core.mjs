import { ConsumerError, onlyFields, uuid } from "../eggs/consumerCore.mjs";

export const loreEnabled = (env = process.env) =>
  env.EGGS_LORE_ENABLED === "true";
export const loreKinds = Object.freeze({
  world: "World",
  factions: "Factions",
  people: "People",
  events: "Events",
  terms: "Terms",
  places: "Places",
});
export const loreContentFields = [
  "title",
  "summary",
  "body",
  "continuity_note",
  "attribution",
  "permission",
  "source_reviewed",
  "public_source",
  "internal_source",
  "project_id",
];
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const controls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u;
const publicVideo =
  /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/u;
const invalid = (message) => {
  throw new ConsumerError(400, message);
};
export function loreSlug(value) {
  return (
    typeof value === "string" &&
    value.length >= 3 &&
    value.length <= 64 &&
    slugPattern.test(value)
  );
}
export function publicLoreSource(value) {
  if (value === "") return true;
  if (typeof value !== "string" || value.length > 500 || /[\s%\\]/u.test(value))
    return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/iu.test(url.hostname) &&
      !/(?:^|\.)(?:drive\.google\.com|docs\.google\.com)$/iu.test(
        url.hostname,
      ) &&
      !/\.(?:local|localhost|internal|invalid|test)$/iu.test(url.hostname) &&
      (!value.includes("?") || publicVideo.test(value)) &&
      (!value.includes("#") || /^#[A-Za-z0-9_-]{1,80}$/u.test(url.hash)) &&
      /^https:\/\/[a-z0-9.-]+(?:[/?#][a-z0-9._~!$&()*+,;=:@/?#-]*)?$/iu.test(
        value,
      )
    );
  } catch {
    return false;
  }
}
export function loreCommand(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid("Check the dossier fields.");
  onlyFields(value, [
    "id",
    "world",
    "kind",
    "slug",
    "content",
    "version",
    "action",
  ]);
  if (
    !loreSlug(value.world) ||
    !loreSlug(value.slug) ||
    typeof value.kind !== "string" ||
    !Object.hasOwn(loreKinds, value.kind)
  )
    invalid("Choose a world, section and stable slug.");
  if (value.kind === "world" && value.slug !== value.world)
    invalid("A world uses its registered world slug.");
  if (
    !["save", "publish", "archive"].includes(value.action) ||
    !Number.isSafeInteger(value.version) ||
    value.version < 0 ||
    value.version > 2147483647
  )
    invalid("Choose a dossier action and revision.");
  if (!value.id && (value.action !== "save" || value.version !== 0))
    invalid("Save a draft first.");
  if (value.action !== "save" && value.content != null)
    invalid("Publish the saved preview without replacement content.");
  const command = {
    p_id: value.id ? uuid(value.id) : null,
    p_world: value.world,
    p_kind: value.kind,
    p_slug: value.slug,
    p_content: null,
    p_version: value.version,
    p_action: value.action,
  };
  if (value.action === "save") {
    const content = value.content;
    if (!content || typeof content !== "object" || Array.isArray(content))
      invalid("Include the complete dossier.");
    onlyFields(content, loreContentFields);
    if (loreContentFields.some((key) => !Object.hasOwn(content, key)))
      invalid("Include every dossier field.");
    for (const [key, max, required] of [
      ["title", 120, true],
      ["summary", 300, true],
      ["body", 20000, true],
      ["continuity_note", 160, false],
      ["attribution", 300, true],
      ["internal_source", 2000, false],
    ]) {
      if (
        typeof content[key] !== "string" ||
        content[key].length > max ||
        controls.test(content[key]) ||
        (required && !content[key].trim())
      )
        invalid("Check the " + key.replaceAll("_", " ") + ".");
    }
    if (
      !["unreviewed", "site-public"].includes(content.permission) ||
      typeof content.source_reviewed !== "boolean"
    )
      invalid("Record the source review and permission.");
    if (!publicLoreSource(content.public_source))
      invalid(
        "Use a public HTTPS source without credentials or private file links.",
      );
    if (content.project_id !== null) {
      uuid(content.project_id);
      if (value.kind !== "world")
        invalid("Project associations belong to world entries.");
    }
    command.p_content = content;
  }
  return command;
}
