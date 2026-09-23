import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const EVENTS_PATH = path.join(process.cwd(), "newsroom-library", "settings", "upcoming-events.json");

export const EVENT_STATUSES = ["draft", "scheduled", "live", "complete", "cancelled"];

export const DEFAULT_UPCOMING_EVENTS_SETTINGS = {
  events: [],
  updatedAt: null,
};

function text(value, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function normalizeStatus(value) {
  return EVENT_STATUSES.includes(value) ? value : "draft";
}

function normalizeEvent(event = {}, index = 0) {
  const id = text(event.id, `event-${index + 1}`);
  return {
    id,
    title: text(event.title, "Future table"),
    dek: text(event.dek, "This event is staged by the newsroom and will connect to the game site later."),
    displayDate: text(event.displayDate || event.display_date || event.startsAt || event.starts_at, ""),
    startsAt: text(event.startsAt || event.starts_at, ""),
    venue: text(event.venue || event.location || event.tableName || event.table_name, ""),
    status: normalizeStatus(event.status),
    enabled: event.enabled !== false,
    publicVisible: event.publicVisible !== false,
    ctaLabel: text(event.ctaLabel || event.cta_label, "Event details"),
    ctaHref: text(event.ctaHref || event.cta_href, ""),
    source: text(event.source, "admin_draft"),
    notes: text(event.notes, ""),
  };
}

export function normalizeUpcomingEventsSettings(settings = {}) {
  const events = Array.isArray(settings.events) ? settings.events : [];
  return {
    events: events.map(normalizeEvent),
    updatedAt: settings.updatedAt || null,
  };
}

export async function readUpcomingEventsSettings() {
  try {
    const raw = await readFile(EVENTS_PATH, "utf8");
    return normalizeUpcomingEventsSettings(JSON.parse(raw));
  } catch {
    return normalizeUpcomingEventsSettings(DEFAULT_UPCOMING_EVENTS_SETTINGS);
  }
}

export async function writeUpcomingEventsSettings(settings) {
  const nextSettings = normalizeUpcomingEventsSettings({
    ...settings,
    updatedAt: new Date().toISOString(),
  });
  await mkdir(path.dirname(EVENTS_PATH), { recursive: true });
  await writeFile(EVENTS_PATH, `${JSON.stringify(nextSettings, null, 2)}\n`, "utf8");
  return nextSettings;
}

export async function getPublicUpcomingEvents() {
  const settings = await readUpcomingEventsSettings();
  return settings.events.filter((event) => event.enabled && event.publicVisible && !["complete", "cancelled"].includes(event.status));
}
