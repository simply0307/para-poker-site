export function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

export function stripPlayerHandle(value, fallback = "Unknown Player") {
  return text(value, fallback)
    .replace(/\s*@\s*[a-z0-9_-]{3,}\s*$/iu, "")
    .trim();
}

export function normalizePlayerNameForMatch(value) {
  return stripPlayerHandle(value, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
