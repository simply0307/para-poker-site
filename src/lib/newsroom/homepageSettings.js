import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_HOME_SETTINGS, HOMEPAGE_MODULE_DEFINITIONS } from "@/lib/newsroom/homepageSettingsConstants";

export { DEFAULT_HOME_SETTINGS, HOMEPAGE_MODULE_DEFINITIONS };

const SETTINGS_PATH = path.join(process.cwd(), "newsroom-library", "settings", "homepage.json");

function definitionsByType() {
  return new Map(HOMEPAGE_MODULE_DEFINITIONS.map((module) => [module.type, module]));
}

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  const nextValue = Number.isFinite(parsed) ? parsed : fallback;
  return Math.max(min, Math.min(max, Math.round(nextValue)));
}

function normalizeSelectedIds(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item).trim()).filter(Boolean).slice(0, 12);
}

export function normalizeHomepageModule(homepageModule = {}, definition) {
  const variant = definition.allowedVariants?.includes(homepageModule.variant)
    ? homepageModule.variant
    : definition.defaultVariant;
  const sourceMode = definition.allowedSourceModes?.includes(homepageModule.sourceMode)
    ? homepageModule.sourceMode
    : definition.allowedSourceModes?.[0] || "automatic";

  return {
    type: definition.type,
    enabled: homepageModule.enabled !== false,
    variant,
    sourceMode,
    selectedIds: normalizeSelectedIds(homepageModule.selectedIds),
    title: text(homepageModule.title, definition.defaultTitle || definition.label),
    dek: text(homepageModule.dek, definition.defaultDek || ""),
    itemLimit: clampNumber(
      homepageModule.itemLimit,
      definition.minItems ?? 0,
      definition.maxItems ?? 12,
      definition.defaultItemLimit ?? definition.maxItems ?? 3
    ),
    showSectionHeader: definition.allowSectionHeader ? homepageModule.showSectionHeader !== false : false,
  };
}

export function normalizeHomepageSettings(settings = {}) {
  const byType = definitionsByType();
  const seen = new Set();
  const suppliedModules = Array.isArray(settings.modules) ? settings.modules : [];
  const modules = [];

  for (const homepageModule of suppliedModules) {
    const type = String(homepageModule?.type || "");
    if (!byType.has(type) || seen.has(type)) continue;
    seen.add(type);
    modules.push(normalizeHomepageModule(homepageModule, byType.get(type)));
  }

  for (const definition of HOMEPAGE_MODULE_DEFINITIONS) {
    if (seen.has(definition.type)) continue;
    modules.push(normalizeHomepageModule({ type: definition.type, enabled: true }, definition));
  }

  return {
    hero: {
      eyebrow: text(settings.hero?.eyebrow, DEFAULT_HOME_SETTINGS.hero.eyebrow),
      title: text(settings.hero?.title, DEFAULT_HOME_SETTINGS.hero.title),
      dek: text(settings.hero?.dek, DEFAULT_HOME_SETTINGS.hero.dek),
    },
    modules,
    updatedAt: settings.updatedAt || null,
  };
}

export async function readHomepageSettings() {
  try {
    const raw = await readFile(SETTINGS_PATH, "utf8");
    return normalizeHomepageSettings(JSON.parse(raw));
  } catch {
    return normalizeHomepageSettings(DEFAULT_HOME_SETTINGS);
  }
}

export async function writeHomepageSettings(settings) {
  const nextSettings = normalizeHomepageSettings({
    ...settings,
    updatedAt: new Date().toISOString(),
  });
  await mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await writeFile(SETTINGS_PATH, `${JSON.stringify(nextSettings, null, 2)}\n`, "utf8");
  return nextSettings;
}

export function moduleDefinitionFor(type) {
  return definitionsByType().get(type) || { type, label: type, description: "" };
}
