import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { OVERRIDE_SCOPES } from "@/lib/newsroom/dataOverridesConstants";

const OVERRIDES_PATH = path.join(process.cwd(), "newsroom-library", "settings", "data-overrides.json");

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function parseValue(value) {
  const raw = cleanText(value);
  if (!raw) return "";
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function normalizeOverride(row = {}) {
  const scope = cleanText(row.scope);
  const now = new Date().toISOString();
  return {
    id: cleanText(row.id, `override-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    scope: OVERRIDE_SCOPES.includes(scope) ? scope : "session",
    source_id: cleanText(row.source_id),
    field_path: cleanText(row.field_path),
    value: typeof row.value === "string" ? parseValue(row.value) : row.value ?? "",
    reason: cleanText(row.reason),
    status: cleanText(row.status, "active"),
    created_by: cleanText(row.created_by, "admin"),
    created_at: row.created_at || now,
    updated_at: row.updated_at || now,
  };
}

function sortOverrides(rows = []) {
  return [...rows].sort((left, right) => new Date(right.updated_at || 0) - new Date(left.updated_at || 0));
}

export async function readDataOverrides() {
  try {
    const raw = await readFile(OVERRIDES_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed?.overrides) ? parsed.overrides : Array.isArray(parsed) ? parsed : [];
    return sortOverrides(rows.map(normalizeOverride));
  } catch {
    return [];
  }
}

async function writeDataOverrides(rows) {
  await mkdir(path.dirname(OVERRIDES_PATH), { recursive: true });
  await writeFile(OVERRIDES_PATH, `${JSON.stringify({ overrides: sortOverrides(rows) }, null, 2)}\n`, "utf8");
  return sortOverrides(rows);
}

export async function createDataOverride(payload = {}) {
  const existing = await readDataOverrides();
  const next = normalizeOverride(payload);
  const replaced = existing.filter((row) => {
    if (row.scope !== next.scope) return true;
    if (row.source_id !== next.source_id) return true;
    return row.field_path !== next.field_path;
  });
  return writeDataOverrides([next, ...replaced]);
}

export async function deleteDataOverride(id) {
  const existing = await readDataOverrides();
  const next = existing.filter((row) => row.id !== id);
  await writeDataOverrides(next);
  return { deleted: existing.length !== next.length, overrides: next };
}
