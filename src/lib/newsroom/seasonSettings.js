import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_SEASON_SETTINGS } from "@/lib/newsroom/seasonSettingsConstants";

const SETTINGS_PATH = path.join(process.cwd(), "newsroom-library", "settings", "season.json");

export { DEFAULT_SEASON_SETTINGS };

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function normalizeSeasonEntry(entry = {}) {
  const code = text(entry.code, "S0").trim() || "S0";
  return {
    code,
    label: text(entry.label, code),
    phase: text(entry.phase, "preseason"),
    status: text(entry.status, "in_progress"),
  };
}

export function normalizeSeasonSettings(settings = {}) {
  const availableSeasons = Array.isArray(settings.availableSeasons) && settings.availableSeasons.length
    ? settings.availableSeasons.map(normalizeSeasonEntry)
    : DEFAULT_SEASON_SETTINGS.availableSeasons;
  const activeSeasonCode = text(settings.activeSeasonCode, availableSeasons[0]?.code || "S0").trim() || "S0";
  const activeSeason = availableSeasons.find((season) => season.code === activeSeasonCode) || availableSeasons[0] || normalizeSeasonEntry();

  return {
    activeSeasonCode: activeSeason.code,
    seasonPhase: text(settings.seasonPhase, activeSeason.phase || "preseason"),
    seasonStatus: text(settings.seasonStatus, activeSeason.status || "in_progress"),
    lifecycleNote: text(settings.lifecycleNote, DEFAULT_SEASON_SETTINGS.lifecycleNote),
    availableSeasons,
    updatedAt: settings.updatedAt || null,
  };
}

export async function readSeasonSettings() {
  try {
    const raw = await readFile(SETTINGS_PATH, "utf8");
    return normalizeSeasonSettings(JSON.parse(raw));
  } catch {
    return normalizeSeasonSettings(DEFAULT_SEASON_SETTINGS);
  }
}

export async function writeSeasonSettings(settings = {}) {
  const next = normalizeSeasonSettings({
    ...settings,
    updatedAt: new Date().toISOString(),
  });
  await mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await writeFile(SETTINGS_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

export async function getActiveSeasonCode() {
  const settings = await readSeasonSettings();
  return settings.activeSeasonCode || "S0";
}
