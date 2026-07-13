import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const constants = read("src/lib/newsroom/homepageSettingsConstants.js");
const normalizer = read("src/lib/newsroom/homepageSettings.js");
const viewModel = read("src/lib/newsroom/viewModels/home.js");
const form = read("src/components/admin-newsroom/HomepageSettingsForm.jsx");
const modules = read("src/components/newsroom/HomepageModules.jsx");
const shell = read("src/components/newsroom/NewsroomShell.jsx");
const publicNav = read("src/components/newsroom/PublicNav.jsx");
const currentSettings = JSON.parse(read("newsroom-library/settings/homepage.json"));

for (const type of ["hero_board", "stat_strip", "latest_session", "upcoming_events", "current_standings", "featured_players", "featured_moments", "latest_articles"]) {
  assert.match(constants, new RegExp(`type: "${type}"`), `${type} must be defined in homepage module registry.`);
}

for (const variant of [
  "editorial_lead",
  "session_result",
  "league_board",
  "event_cards",
  "schedule_strip",
  "compact_board",
  "identity_rail",
  "archive_clippings",
  "headline_list",
]) {
  assert.match(constants, new RegExp(`"${variant}"`), `${variant} must be an approved variant.`);
}

assert.match(normalizer, /normalizeHomepageModule/, "Homepage settings must normalize each module.");
assert.match(normalizer, /definition\.allowedVariants\?\.includes/, "Invalid variants must fall back through the definition.");
assert.match(normalizer, /clampNumber/, "Item limits must be clamped.");
assert.match(normalizer, /normalizeSelectedIds/, "Selected IDs must be sanitized.");

assert.match(viewModel, /resolveModuleContent/, "Home view model must resolve module content.");
assert.match(viewModel, /selectedItems/, "Home view model must support manual selected content.");
assert.match(viewModel, /fallback safely|Selected .* unavailable|showing/, "Missing selections should fall back with warnings.");

assert.match(form, /Presentation variant/, "Admin form must expose presentation variant controls.");
assert.match(form, /Source mode/, "Admin form must expose source mode controls.");
assert.match(form, /Manual content/, "Admin form must expose safe manual selectors.");
assert.match(form, /Developer config preview/, "JSON preview must be secondary.");
assert.doesNotMatch(form, /color picker|Tailwind|CSS class|custom HTML/i, "Admin form must not expose raw styling controls.");

assert.match(modules, /module\.variant/, "Homepage renderer must use module variants.");
assert.match(modules, /module\.resolvedContent/, "Homepage renderer must use resolved safe content.");
assert.match(modules, /UpcomingEventsModule/, "Homepage renderer must support future event modules.");
assert.match(publicNav, /usePathname/, "Public navigation must provide active states.");
assert.doesNotMatch(shell, /adminLinks|\/admin"/, "Public shell must not link to admin routes.");

assert.equal(Array.isArray(currentSettings.modules), true, "Current homepage settings must contain modules.");
for (const homepageModule of currentSettings.modules) {
  assert.equal(typeof homepageModule.type, "string", "Older homepage module entries with type remain valid.");
  assert.equal(typeof homepageModule.enabled, "boolean", "Older homepage module entries with enabled remain valid.");
}

console.log("Homepage settings validation passed.");
