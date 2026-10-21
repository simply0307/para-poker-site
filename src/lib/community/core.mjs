import { ConsumerError, onlyFields, uuid } from "../eggs/consumerCore.mjs";

export const communityEnabled = (env = process.env) =>
  env.EGGS_COMMUNITY_ENABLED === "true";
export const communityActions = [
  "create",
  "edit",
  "delete",
  "like",
  "unlike",
  "hide",
  "restore",
];
const invalid = (message) => {
  throw new ConsumerError(400, message);
};
export function feedOptions(params) {
  const allowed = ["before", "before_id", "limit", "author"];
  for (const key of params.keys())
    if (!allowed.includes(key)) invalid("Check the feed filters.");
  const before = params.get("before"),
    beforeId = params.get("before_id");
  if (
    Boolean(before) !== Boolean(beforeId) ||
    (before &&
      (!/^\d{4}-\d\d-\d\dT/u.test(before) ||
        !Number.isFinite(Date.parse(before))))
  )
    invalid("Check the page cursor.");
  if (beforeId) uuid(beforeId);
  const author = params.get("author");
  if (author && !/^[a-z0-9_]{3,30}$/u.test(author))
    invalid("Check the profile handle.");
  const limit = Number(params.get("limit") || 20);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    invalid("Choose a valid page size.");
  return {
    p_before: before || null,
    p_before_id: beforeId || null,
    p_limit: limit,
    p_author: author || null,
  };
}
export function peopleOptions(params) {
  for (const key of params.keys())
    if (!["q", "after", "limit"].includes(key))
      invalid("Check the people filters.");
  const query = params.get("q") || "",
    after = params.get("after");
  if (query.length > 80 || /[\u0000-\u001f]/u.test(query))
    invalid("Keep your search under 80 characters.");
  if (after && !/^[a-z0-9_]{3,30}$/u.test(after))
    invalid("Check the page cursor.");
  const limit = Number(params.get("limit") || 24);
  if (!Number.isInteger(limit) || limit < 1 || limit > 48)
    invalid("Choose a valid page size.");
  return {
    p_query: query.trim().replace(/^@/u, ""),
    p_after: after || null,
    p_limit: limit,
  };
}
export function communityCommand(value) {
  onlyFields(value, ["action", "id", "body", "parent", "revision"]);
  if (!communityActions.includes(value.action))
    invalid("Choose a community action.");
  const command = {
    p_action: value.action,
    p_id: value.id == null ? null : uuid(value.id),
    p_body: value.body ?? null,
    p_parent: value.parent == null ? null : uuid(value.parent),
    p_revision: value.revision ?? null,
  };
  const textAction = ["create", "edit", "hide", "restore"].includes(
    value.action,
  );
  if (
    textAction &&
    (typeof command.p_body !== "string" ||
      !command.p_body.trim() ||
      command.p_body.length >
        (["hide", "restore"].includes(value.action) ? 240 : 1000) ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(command.p_body))
  )
    invalid("Write a short message within the character limit.");
  if (!textAction && command.p_body !== null)
    invalid("This action does not accept message text.");
  if (value.action === "create") {
    if (command.p_id !== null || command.p_revision !== null)
      invalid("New posts use a new identity.");
  } else {
    if (!command.p_id || command.p_parent !== null) invalid("Choose a post.");
    if (value.action === "edit") {
      if (!Number.isSafeInteger(command.p_revision) || command.p_revision < 1)
        invalid("Reload this revision before editing.");
    } else if (command.p_revision !== null)
      invalid("This action does not accept a revision.");
  }
  return command;
}
