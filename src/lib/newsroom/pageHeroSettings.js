import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_PAGE_HERO_SETTINGS, PAGE_HERO_DEFINITIONS } from "@/lib/newsroom/pageHeroSettingsConstants";

const SETTINGS_PATH = path.join(process.cwd(), "newsroom-library", "settings", "page-heroes.json");

export { DEFAULT_PAGE_HERO_SETTINGS, PAGE_HERO_DEFINITIONS };

function cleanHero(hero = {}, fallback = {}) {
  return {
    eyebrow: String(hero.eyebrow || fallback.eyebrow || ""),
    title: String(hero.title || fallback.title || ""),
    dek: String(hero.dek || fallback.dek || ""),
  };
}

export function normalizePageHeroSettings(settings = {}) {
  const pages = {};
  for (const definition of PAGE_HERO_DEFINITIONS) {
    pages[definition.key] = cleanHero(settings[definition.key], DEFAULT_PAGE_HERO_SETTINGS[definition.key]);
  }
  return {
    pages,
    updatedAt: settings.updatedAt || null,
  };
}

export async function readPageHeroSettings() {
  try {
    const raw = await readFile(SETTINGS_PATH, "utf8");
    return normalizePageHeroSettings(JSON.parse(raw));
  } catch {
    return normalizePageHeroSettings(DEFAULT_PAGE_HERO_SETTINGS);
  }
}

export async function writePageHeroSettings(settings = {}) {
  const source = settings.pages || settings;
  const next = normalizePageHeroSettings({
    ...source,
    updatedAt: new Date().toISOString(),
  });
  await mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await writeFile(SETTINGS_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

export async function getPageHero(key) {
  const settings = await readPageHeroSettings();
  return settings.pages[key] || DEFAULT_PAGE_HERO_SETTINGS[key] || { eyebrow: "", title: "", dek: "" };
}
