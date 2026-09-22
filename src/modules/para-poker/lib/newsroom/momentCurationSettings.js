import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SETTINGS_PATH = path.join(process.cwd(), "newsroom-library", "settings", "moments.json");

export const DEFAULT_MOMENT_CURATION_SETTINGS = {
  featuredMomentId: "",
  majorMomentIds: [],
  updatedAt: null,
};

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function cleanIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => text(item).trim()).filter(Boolean))].slice(0, 24);
}

export function normalizeMomentCurationSettings(settings = {}) {
  return {
    featuredMomentId: text(settings.featuredMomentId).trim(),
    majorMomentIds: cleanIds(settings.majorMomentIds),
    updatedAt: settings.updatedAt || null,
  };
}

export async function readMomentCurationSettings() {
  try {
    const raw = await readFile(SETTINGS_PATH, "utf8");
    return normalizeMomentCurationSettings(JSON.parse(raw));
  } catch {
    return normalizeMomentCurationSettings(DEFAULT_MOMENT_CURATION_SETTINGS);
  }
}

export async function writeMomentCurationSettings(settings = {}) {
  const next = normalizeMomentCurationSettings({
    ...settings,
    updatedAt: new Date().toISOString(),
  });
  await mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await writeFile(SETTINGS_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}
