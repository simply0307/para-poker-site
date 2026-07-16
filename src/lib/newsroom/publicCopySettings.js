import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_PUBLIC_COPY_SETTINGS } from "@/lib/newsroom/publicCopySettingsConstants";

const SETTINGS_PATH = path.join(process.cwd(), "newsroom-library", "settings", "public-copy.json");

export { DEFAULT_PUBLIC_COPY_SETTINGS };

function text(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function cleanCopy(value, fallback = "") {
  return text(value, fallback).trim();
}

function cleanEntry(entry = {}, fallback = {}) {
  return {
    playerCardDek: cleanCopy(entry.playerCardDek, fallback.playerCardDek),
    playerProfileDek: cleanCopy(entry.playerProfileDek, fallback.playerProfileDek),
    sessionTableLabel: cleanCopy(entry.sessionTableLabel, fallback.sessionTableLabel),
    sessionCardDek: cleanCopy(entry.sessionCardDek, fallback.sessionCardDek),
  };
}

export function normalizePublicCopySettings(settings = {}) {
  const defaults = cleanEntry(settings.defaults || {}, DEFAULT_PUBLIC_COPY_SETTINGS.defaults);
  const players = {};
  const sessions = {};

  for (const [key, entry] of Object.entries(settings.players || {})) {
    if (!key) continue;
    players[key] = cleanEntry(entry, {});
  }

  for (const [key, entry] of Object.entries(settings.sessions || {})) {
    if (!key) continue;
    sessions[key] = cleanEntry(entry, {});
  }

  return {
    defaults,
    players,
    sessions,
    updatedAt: settings.updatedAt || null,
  };
}

export async function readPublicCopySettings() {
  try {
    const raw = await readFile(SETTINGS_PATH, "utf8");
    return normalizePublicCopySettings(JSON.parse(raw));
  } catch {
    return normalizePublicCopySettings(DEFAULT_PUBLIC_COPY_SETTINGS);
  }
}

export async function writePublicCopySettings(settings = {}) {
  const next = normalizePublicCopySettings({
    ...settings,
    updatedAt: new Date().toISOString(),
  });
  await mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await writeFile(SETTINGS_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

function keysForEntity(entity = {}, fallback = "") {
  return [
    entity.slug,
    entity.session_code,
    entity.id,
    fallback,
  ].map((value) => cleanCopy(value)).filter(Boolean);
}

function mergedEntry(collection = {}, keys = [], defaults = {}) {
  const match = keys.map((key) => collection[key]).find(Boolean) || {};
  return {
    ...defaults,
    ...Object.fromEntries(Object.entries(match).filter(([, value]) => cleanCopy(value))),
  };
}

export function getPlayerPublicCopy(settings = {}, player = {}) {
  const normalized = normalizePublicCopySettings(settings);
  return mergedEntry(normalized.players, keysForEntity(player), normalized.defaults);
}

export function getSessionPublicCopy(settings = {}, session = {}) {
  const normalized = normalizePublicCopySettings(settings);
  return mergedEntry(normalized.sessions, keysForEntity(session), normalized.defaults);
}

export function displaySessionTableLabel(session = {}, copy = {}) {
  const value = cleanCopy(session.table_name || session.format);
  if (!value || value.toLowerCase() === "imported table") return cleanCopy(copy.sessionTableLabel, DEFAULT_PUBLIC_COPY_SETTINGS.defaults.sessionTableLabel);
  return value;
}
