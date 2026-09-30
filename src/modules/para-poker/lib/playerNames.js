export function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

export function stripPlayerHandle(value, fallback = "Unknown Player") {
  return stripPlayerHandlesFromText(value, fallback);
}

export function stripPlayerHandlesFromText(value, fallback = "") {
  return text(value, fallback)
    .replace(/\s*@\s*[a-z0-9_-]{3,}\b/giu, "")
    .replace(/\s{2,}/gu, " ")
    .trim();
}

export function normalizePlayerNameForMatch(value) {
  return stripPlayerHandle(value, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
