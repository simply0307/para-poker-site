import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizePromptConfig } from "@/lib/newsroom/promptConfigs";

const PRESETS_PATH = path.join(process.cwd(), "newsroom-library", "settings", "prompt-presets.json");

function slug(value) {
  return String(value || "prompt-preset")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "prompt-preset";
}

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizePreset(preset = {}) {
  const name = cleanText(preset.name || preset.label, "Saved prompt preset");
  const config = normalizePromptConfig(preset.config || preset.promptConfig || preset, preset.config?.draftType || preset.draftType || "session_recap");
  const now = new Date().toISOString();

  return {
    id: cleanText(preset.id, `${slug(name)}-${Date.now().toString(36)}`),
    name,
    label: name,
    draftType: config.draftType,
    config,
    createdAt: preset.createdAt || preset.created_at || now,
    updatedAt: preset.updatedAt || preset.updated_at || now,
  };
}

function normalizeSettings(settings = {}) {
  const presets = Array.isArray(settings.presets) ? settings.presets.map(normalizePreset) : [];
  const defaults = settings.defaults && typeof settings.defaults === "object" ? settings.defaults : {};
  const validIds = new Set(presets.map((preset) => preset.id));
  const cleanDefaults = Object.fromEntries(
    Object.entries(defaults).filter(([, presetId]) => validIds.has(presetId))
  );

  return { presets, defaults: cleanDefaults };
}

async function writePromptPresetSettings(settings) {
  const normalized = normalizeSettings(settings);
  await mkdir(path.dirname(PRESETS_PATH), { recursive: true });
  await writeFile(PRESETS_PATH, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

export async function readPromptPresetSettings() {
  try {
    const raw = await readFile(PRESETS_PATH, "utf8");
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return { presets: [], defaults: {} };
  }
}

export async function savePromptPreset({ name, config, makeDefault = false, id = "" } = {}) {
  const settings = await readPromptPresetSettings();
  const preset = normalizePreset({
    id: id || `${slug(name)}-${Date.now().toString(36)}`,
    name,
    config,
    updatedAt: new Date().toISOString(),
  });
  const presets = [preset, ...settings.presets.filter((row) => row.id !== preset.id)];
  const defaults = {
    ...settings.defaults,
    ...(makeDefault ? { [preset.draftType]: preset.id } : {}),
  };
  return writePromptPresetSettings({ presets, defaults });
}

export async function deletePromptPreset(id) {
  const settings = await readPromptPresetSettings();
  const presets = settings.presets.filter((preset) => preset.id !== id);
  const defaults = Object.fromEntries(
    Object.entries(settings.defaults).filter(([, presetId]) => presetId !== id)
  );
  const next = await writePromptPresetSettings({ presets, defaults });
  return { deleted: presets.length !== settings.presets.length, ...next };
}
