"use client";

import { useMemo, useState } from "react";
import {
  AUDIENCE_OPTIONS,
  COVERAGE_FOCUS_OPTIONS,
  DRAFT_TYPES,
  FORMAT_OPTIONS,
  INTENSITY_LEVELS,
  LENGTH_OPTIONS,
  VOICE_MODES,
  getPromptPreset,
  getPromptPresetOptions,
  normalizePromptConfig,
} from "@/lib/newsroom/promptConfigs";

const defaultSources = {
  sessionId: "S0-001",
  playerId: "para-poker-at-mt1ejg0x7",
  seasonCode: "S0",
  momentId: "",
  articleTopic: "",
};

function toggle(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function listText(value) {
  return Array.isArray(value) ? value.join(", ") : String(value || "");
}

function payloadFor(draftType, promptConfig, sources) {
  const variation = "";
  if (draftType === "session_recap") return { sessionId: sources.sessionId, variation, promptConfig };
  if (draftType === "player_profile") return { playerId: sources.playerId, variation, editorialNotes: "", promptConfig };
  if (draftType === "player_session_recap") {
    return { playerId: sources.playerId, sessionId: sources.sessionId, variation, editorialNotes: "", promptConfig };
  }
  if (draftType === "standings_summary") return { seasonCode: sources.seasonCode, variation, editorialNotes: "", promptConfig };
  if (draftType === "moment_blurb") return { momentId: sources.momentId, variation, editorialNotes: "", promptConfig };
  if (draftType === "league_article") {
    return {
      variation: "beat_report",
      promptConfig,
      articleRequest: {
        topic: sources.articleTopic,
        seasonCode: sources.seasonCode,
        seasonPhase: "preseason",
        seasonStatus: "in_progress",
        lifecycleNote: "Season 0 is ongoing. Do not write as if the season, preseason, standings race, or player stories are complete.",
        articleType: "beat_report",
        promptConfig,
      },
    };
  }
  return { promptConfig };
}

function endpointFor(draftType) {
  return DRAFT_TYPES.find((type) => type.key === draftType)?.endpoint || "Future endpoint";
}

export function PromptStudioForm() {
  const [presetKey, setPresetKey] = useState("official_session_recap");
  const [draftType, setDraftType] = useState("session_recap");
  const [voiceMode, setVoiceMode] = useState("Official Recap");
  const [intensity, setIntensity] = useState("Punchy");
  const [length, setLength] = useState("medium");
  const [format, setFormat] = useState("recap_article");
  const [audience, setAudience] = useState("public_league");
  const [coverageFocus, setCoverageFocus] = useState(["winner", "biggest pot", "notable moments"]);
  const [mustMention, setMustMention] = useState("rank, points, sessions");
  const [avoid, setAvoid] = useState("generic sports filler, unsupported rivalries, fake emotions");
  const [customInstruction, setCustomInstruction] = useState("Make this feel like a shareable Para League object, not a database summary.");
  const [sources, setSources] = useState(defaultSources);
  const [copied, setCopied] = useState("");
  const presetOptions = useMemo(() => getPromptPresetOptions().map((preset) => ({ value: preset.key, label: preset.label })), []);

  const promptConfig = useMemo(
    () =>
      normalizePromptConfig(
        {
          draftType,
          voiceMode,
          intensity,
          coverageFocus,
          mustMention,
          avoid,
          length,
          format,
          audience,
          customInstruction,
        },
        draftType
      ),
    [audience, avoid, coverageFocus, customInstruction, draftType, format, intensity, length, mustMention, voiceMode]
  );

  const endpoint = endpointFor(draftType);
  const payload = payloadFor(draftType, promptConfig, sources);
  const payloadText = JSON.stringify(payload, null, 2);

  function applyPreset(nextKey) {
    const preset = getPromptPreset(nextKey);
    setPresetKey(nextKey);
    setDraftType(preset.draftType);
    setVoiceMode(preset.voiceMode);
    setIntensity(preset.intensity);
    setCoverageFocus(preset.coverageFocus);
    setMustMention(listText(preset.mustMention));
    setAvoid(listText(preset.avoid));
    setLength(preset.length);
    setFormat(preset.format);
    setAudience(preset.audience);
    setCustomInstruction(preset.customInstruction);
    setCopied("");
  }

  async function copyText(label, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
    } catch {
      setCopied("");
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_430px]">
      <div className="space-y-5">
        <Panel title="Preset">
          <Field label="Prompt preset" value={presetKey} onChange={applyPreset} options={presetOptions} />
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Generation pages now use these controls directly. Copy JSON is only for advanced/manual workflows.
          </p>
        </Panel>

        <Panel title="Draft Type">
          <div className="grid gap-2 md:grid-cols-2">
            {DRAFT_TYPES.map((type) => (
              <button
                key={type.key}
                type="button"
                onClick={() => setDraftType(type.key)}
                className={`rounded-md border p-3 text-left text-sm font-black ${
                  draftType === type.key ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-300 bg-white text-zinc-800"
                }`}
              >
                {type.label}
                <span className="mt-1 block text-xs font-medium opacity-70">{type.requiredSource}</span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Voice Controls">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Voice mode" value={voiceMode} onChange={setVoiceMode} options={VOICE_MODES} />
            <Field label="Intensity" value={intensity} onChange={setIntensity} options={INTENSITY_LEVELS} />
            <Field label="Length" value={length} onChange={setLength} options={LENGTH_OPTIONS} />
            <Field label="Format" value={format} onChange={setFormat} options={FORMAT_OPTIONS} />
            <Field label="Audience" value={audience} onChange={setAudience} options={AUDIENCE_OPTIONS} />
          </div>
        </Panel>

        <Panel title="Coverage Focus">
          <div className="flex flex-wrap gap-2">
            {COVERAGE_FOCUS_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setCoverageFocus((current) => toggle(current, option))}
                className={`rounded-full border px-3 py-2 text-sm font-bold ${
                  coverageFocus.includes(option) ? "border-amber-600 bg-amber-100 text-amber-900" : "border-zinc-300 bg-white text-zinc-700"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Instructions">
          <div className="grid gap-4">
            <TextArea label="Required facts" value={mustMention} onChange={setMustMention} />
            <TextArea label="Avoided topics" value={avoid} onChange={setAvoid} />
            <TextArea label="Custom instruction" value={customInstruction} onChange={setCustomInstruction} rows={4} />
          </div>
        </Panel>

        <Panel title="Source Selector">
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(sources).map(([key, value]) => (
              <label key={key} className="grid gap-2 text-sm font-bold">
                {key}
                <input
                  className="rounded-md border border-zinc-300 p-3 font-mono text-sm"
                  value={value}
                  onChange={(event) => setSources((current) => ({ ...current, [key]: event.target.value }))}
                />
              </label>
            ))}
          </div>
        </Panel>
      </div>

      <aside className="space-y-5">
        <Panel title="Endpoint">
          <p className="font-mono text-sm text-zinc-700">{endpoint}</p>
        </Panel>
        <Panel title="Prompt Config">
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-zinc-950 p-4 text-xs text-zinc-100">
            {JSON.stringify(promptConfig, null, 2)}
          </pre>
          <button type="button" onClick={() => copyText("config", JSON.stringify(promptConfig, null, 2))} className="mt-3 rounded-md bg-zinc-900 px-3 py-2 text-sm font-black text-white">
            {copied === "config" ? "Copied Config" : "Copy Config JSON"}
          </button>
        </Panel>
        <Panel title="Generation Payload">
          <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md bg-zinc-950 p-4 text-xs text-zinc-100">
            {payloadText}
          </pre>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Generation pages now send promptConfig directly from embedded controls. Use this payload only for endpoint tests or advanced manual workflows.
          </p>
          <button type="button" onClick={() => copyText("payload", payloadText)} className="mt-3 rounded-md bg-zinc-900 px-3 py-2 text-sm font-black text-white">
            {copied === "payload" ? "Copied Payload" : "Copy Payload JSON"}
          </button>
        </Panel>
      </aside>
    </section>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, options }) {
  const normalizedOptions = options.map((option) => (typeof option === "string" ? { value: option, label: option } : option));
  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      <select className="rounded-md border border-zinc-300 bg-white p-3" value={value} onChange={(event) => onChange(event.target.value)}>
        {normalizedOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({ label, value, onChange, rows = 3 }) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      <textarea className="rounded-md border border-zinc-300 p-3 text-sm leading-6" rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
