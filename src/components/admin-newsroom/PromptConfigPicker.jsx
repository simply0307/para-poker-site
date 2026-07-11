"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AUDIENCE_OPTIONS,
  COVERAGE_FOCUS_OPTIONS,
  FORMAT_OPTIONS,
  INTENSITY_LEVELS,
  LENGTH_OPTIONS,
  VOICE_MODES,
  getPromptPreset,
  getPromptPresetOptions,
  normalizePromptConfig,
} from "@/lib/newsroom/promptConfigs";

function listText(value) {
  return Array.isArray(value) ? value.join(", ") : String(value || "");
}

function toggle(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function PromptConfigPicker({ defaultPreset = "official_session_recap", onChange, className = "" }) {
  const [presetKey, setPresetKey] = useState(defaultPreset);
  const [config, setConfig] = useState(() => normalizePromptConfig(getPromptPreset(defaultPreset)));
  const [copied, setCopied] = useState(false);
  const [savedSettings, setSavedSettings] = useState({ presets: [], defaults: {} });
  const presets = useMemo(() => {
    const builtIns = getPromptPresetOptions().map((preset) => ({ ...preset, value: preset.key, label: preset.label }));
    const saved = (savedSettings.presets || []).map((preset) => ({
      key: `saved:${preset.id}`,
      value: `saved:${preset.id}`,
      label: `${preset.name}${savedSettings.defaults?.[preset.draftType] === preset.id ? " (Default)" : ""}`,
      draftType: preset.draftType,
      voiceMode: preset.config?.voiceMode,
    }));
    return [...builtIns, ...saved];
  }, [savedSettings]);
  const preview = JSON.stringify(config, null, 2);

  useEffect(() => {
    let active = true;
    async function loadSavedPresets() {
      const response = await fetch("/api/admin/prompt-presets");
      if (!response.ok) return;
      const payload = await response.json();
      if (!active) return;
      setSavedSettings(payload);
      const defaultDraftType = normalizePromptConfig(getPromptPreset(defaultPreset)).draftType;
      const savedDefaultId = payload.defaults?.[defaultDraftType];
      const savedDefault = payload.presets?.find((preset) => preset.id === savedDefaultId);
      if (savedDefault) {
        setPresetKey(`saved:${savedDefault.id}`);
        setConfig(normalizePromptConfig(savedDefault.config, savedDefault.draftType));
      }
    }
    loadSavedPresets();
    return () => {
      active = false;
    };
  }, [defaultPreset]);

  useEffect(() => {
    onChange?.(config);
  }, [config, onChange]);

  function applyPreset(nextKey) {
    const savedId = nextKey.startsWith("saved:") ? nextKey.slice(6) : "";
    const savedPreset = savedId ? savedSettings.presets.find((preset) => preset.id === savedId) : null;
    setPresetKey(nextKey);
    setConfig(normalizePromptConfig(savedPreset?.config || getPromptPreset(nextKey), savedPreset?.draftType));
    setCopied(false);
  }

  function update(field, value) {
    setConfig((current) => normalizePromptConfig({ ...current, [field]: value }, current.draftType));
    setCopied(false);
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(preview);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className={`rounded-lg border border-zinc-300 bg-white p-4 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Prompt config</p>
          <h2 className="mt-1 text-xl font-black">Creative controls</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600">Sent automatically with generation. Copy JSON is only an escape hatch.</p>
        </div>
        <button type="button" onClick={() => applyPreset(defaultPreset)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-black">
          Reset to default
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Select label="Preset" value={presetKey} onChange={applyPreset} options={presets.map((preset) => ({ value: preset.key, label: preset.label }))} />
        <Select label="Voice mode" value={config.voiceMode} onChange={(value) => update("voiceMode", value)} options={VOICE_MODES} />
        <Select label="Intensity" value={config.intensity} onChange={(value) => update("intensity", value)} options={INTENSITY_LEVELS} />
        <Select label="Length" value={config.length} onChange={(value) => update("length", value)} options={LENGTH_OPTIONS} />
        <Select label="Format" value={config.format} onChange={(value) => update("format", value)} options={FORMAT_OPTIONS} />
        <Select label="Audience" value={config.audience} onChange={(value) => update("audience", value)} options={AUDIENCE_OPTIONS} />
      </div>

      <div className="mt-4">
        <p className="text-sm font-black">Coverage focus</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {COVERAGE_FOCUS_OPTIONS.map((option) => (
            <label
              key={option}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold ${
                config.coverageFocus.includes(option) ? "border-amber-600 bg-amber-100 text-amber-900" : "border-zinc-300 bg-white text-zinc-700"
              }`}
            >
              <input
                type="checkbox"
                checked={config.coverageFocus.includes(option)}
                onChange={() => update("coverageFocus", toggle(config.coverageFocus, option))}
              />
              {option}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <TextArea label="Must mention" value={listText(config.mustMention)} onChange={(value) => update("mustMention", value)} />
        <TextArea label="Avoid" value={listText(config.avoid)} onChange={(value) => update("avoid", value)} />
        <TextArea className="md:col-span-2" label="Custom instruction" rows={3} value={config.customInstruction} onChange={(value) => update("customInstruction", value)} />
      </div>

      <details className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
        <summary className="cursor-pointer text-sm font-black">JSON preview</summary>
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-zinc-950 p-3 text-xs text-zinc-100">{preview}</pre>
        <button type="button" onClick={copyJson} className="mt-3 rounded-md bg-zinc-900 px-3 py-2 text-sm font-black text-white">
          {copied ? "Copied" : "Copy JSON"}
        </button>
      </details>
    </section>
  );
}

function Select({ label, value, onChange, options }) {
  const normalizedOptions = options.map((option) => (typeof option === "string" ? { value: option, label: option } : option));

  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      <select className="rounded-md border border-zinc-300 bg-white p-2.5" value={value} onChange={(event) => onChange(event.target.value)}>
        {normalizedOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({ label, value, onChange, rows = 2, className = "" }) {
  return (
    <label className={`grid gap-2 text-sm font-bold ${className}`}>
      {label}
      <textarea className="rounded-md border border-zinc-300 p-2.5 text-sm leading-6" rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
