import { readDataOverrides } from "@/lib/newsroom/dataOverrides";

function text(value) {
  return value === null || value === undefined ? "" : String(value);
}

function keySet(values = []) {
  return new Set(values.map((value) => text(value).trim()).filter(Boolean));
}

function sourceKeys(scope, entity = {}) {
  if (scope === "session") {
    return keySet([entity.id, entity.session_code, entity.code]);
  }
  if (scope === "player") {
    return keySet([entity.id, entity.player_id, entity.slug, entity.display_name, entity.pokernow_name, entity.player_name, entity.name]);
  }
  if (scope === "hand" || scope === "moment") {
    return keySet([entity.id, entity.hand_id, entity.notable_hand_id, entity.hand_no, entity.hand_number, entity.source_id]);
  }
  if (scope === "standings") {
    return keySet([entity.id, entity.player_id, entity.season_code, entity.player_name, entity.name]);
  }
  if (scope === "article") {
    return keySet([entity.id, entity.slug, entity.article_id, entity.title, entity.headline]);
  }
  return keySet([entity.id, entity.source_id]);
}

function matchesOverride(override, scope, entity) {
  if (!override || override.status === "deleted") return false;
  if (override.scope !== scope) return false;
  return sourceKeys(scope, entity).has(text(override.source_id).trim());
}

function setPath(target, path, value) {
  const parts = text(path).split(".").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return target;
  const clone = Array.isArray(target) ? [...target] : { ...target };
  let cursor = clone;

  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    const existing = cursor[part];
    cursor[part] = existing && typeof existing === "object" && !Array.isArray(existing) ? { ...existing } : {};
    cursor = cursor[part];
  }

  cursor[parts[parts.length - 1]] = value;
  return clone;
}

export function applyOverridesToEntity(entity, scope, overrides = []) {
  const applied = overrides.filter((override) => matchesOverride(override, scope, entity));
  const value = applied.reduce((current, override) => setPath(current, override.field_path, override.value), entity);
  return {
    value,
    appliedOverrides: applied.map((override) => ({
      id: override.id,
      scope: override.scope,
      source_id: override.source_id,
      field_path: override.field_path,
      reason: override.reason,
      updated_at: override.updated_at,
    })),
  };
}

export function applyOverridesToList(rows = [], scope, overrides = []) {
  const applied = [];
  const value = rows.map((row) => {
    const result = applyOverridesToEntity(row, scope, overrides);
    applied.push(...result.appliedOverrides);
    return result.value;
  });
  return { value, appliedOverrides: applied };
}

export async function readActiveDataOverrides() {
  const overrides = await readDataOverrides();
  return overrides.filter((override) => override.status !== "deleted");
}
