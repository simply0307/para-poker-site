import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_HOME_SETTINGS, HOMEPAGE_MODULE_DEFINITIONS } from "@/lib/newsroom/homepageSettingsConstants";

export { DEFAULT_HOME_SETTINGS, HOMEPAGE_MODULE_DEFINITIONS };

const SETTINGS_PATH = path.join(process.cwd(), "newsroom-library", "settings", "homepage.json");

function definitionsByType() {
  return new Map(HOMEPAGE_MODULE_DEFINITIONS.map((module) => [module.type, module]));
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
    modules.push({
      type,
      enabled: homepageModule.enabled !== false,
    });
  }

  for (const definition of HOMEPAGE_MODULE_DEFINITIONS) {
    if (seen.has(definition.type)) continue;
    modules.push({ type: definition.type, enabled: true });
  }

  return {
    hero: {
      eyebrow: String(settings.hero?.eyebrow || DEFAULT_HOME_SETTINGS.hero.eyebrow),
      title: String(settings.hero?.title || DEFAULT_HOME_SETTINGS.hero.title),
      dek: String(settings.hero?.dek || DEFAULT_HOME_SETTINGS.hero.dek),
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
