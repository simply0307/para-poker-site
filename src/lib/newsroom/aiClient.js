import { buildNewsroomSystemPrompt } from "./voiceRules";

function getProviderConfig() {
  const provider = (process.env.AI_WRITING_PROVIDER || "gemini").toLowerCase();

  if (provider === "gemini" || provider === "google") {
    return {
      provider: "gemini",
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
      fallbackModels: parseModelList(process.env.GEMINI_FALLBACK_MODELS),
    };
  }

  if (provider === "anthropic" || provider === "claude") {
    return {
      provider: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929",
    };
  }

  return {
    provider: "openai",
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-5.1",
  };
}

function parseModelList(value) {
  return String(value || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
}

function uniqueModels(models) {
  return [...new Set(models.filter(Boolean))];
}

export function getNewsroomAiDiagnostics() {
  const provider = (process.env.AI_WRITING_PROVIDER || "gemini").toLowerCase();
  const selectedProvider = provider === "anthropic" || provider === "claude"
    ? "anthropic"
    : provider === "openai"
      ? "openai"
      : "gemini";

  return {
    aiWritingProvider: process.env.AI_WRITING_PROVIDER || "(unset)",
    selectedProvider,
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
    hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
    expectedKeyName: selectedProvider === "anthropic"
      ? "ANTHROPIC_API_KEY"
      : selectedProvider === "openai"
        ? "OPENAI_API_KEY"
        : "GEMINI_API_KEY",
  };
}

function parseJsonFromText(value) {
  if (!value) throw new Error("AI provider returned an empty response.");
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/u);
    if (match) return JSON.parse(match[0]);
    throw new Error("AI provider did not return parseable JSON.");
  }
}

function toGeminiSchema(value) {
  if (Array.isArray(value)) return value.map(toGeminiSchema);
  if (!value || typeof value !== "object") return value;

  const nextValue = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (key === "additionalProperties" || key === "strict") continue;
    if (key === "type" && Array.isArray(nestedValue)) {
      nextValue.anyOf = nestedValue.map((type) => ({ type }));
      continue;
    }
    nextValue[key] = toGeminiSchema(nestedValue);
  }
  return nextValue;
}

function providerLimitMessage(provider) {
  if (provider === "gemini") {
    return "Gemini API quota/rate limit hit. Check your Gemini API quota, billing, or retry after the limit window resets.";
  }
  if (provider === "openai") {
    return "OpenAI API quota/rate limit hit. Check your OpenAI account quota, billing, or retry after the limit window resets.";
  }
  return "Anthropic API quota/rate limit hit. Check your Anthropic account quota, billing, or retry after the limit window resets.";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withProviderError(message, details = {}) {
  const error = new Error(message);
  Object.assign(error, details);
  return error;
}

function isGeminiRetryableFailure(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || "");
  const modelUnavailable = /model .*not found|models\/.* not found|not found for api version|model .*unavailable|model .*not available|not supported|unsupported model/i.test(message);

  if (status === 429 || status >= 500) return true;
  if (/quota|rate limit|resource exhausted|temporarily unavailable|server error|backend error/i.test(message)) return true;
  if ((status === 400 || status === 404) && modelUnavailable) return true;
  return false;
}

export async function callNewsroomAiJson({ scope, schema, packet }) {
  const config = getProviderConfig();
  const diagnostics = getNewsroomAiDiagnostics();

  console.info("[newsroom-ai] provider diagnostics", diagnostics);

  if (!config.apiKey) {
    throw new Error(
      `Missing ${diagnostics.expectedKeyName} for server-side newsroom generation. AI_WRITING_PROVIDER=${diagnostics.aiWritingProvider}; selectedProvider=${diagnostics.selectedProvider}; hasGeminiKey=${diagnostics.hasGeminiKey}; hasOpenAiKey=${diagnostics.hasOpenAiKey}; hasAnthropicKey=${diagnostics.hasAnthropicKey}.`
    );
  }

  if (config.provider === "gemini") {
    return callGeminiJson({ config, scope, schema, packet });
  }

  if (config.provider === "anthropic") {
    return callAnthropicJson({ config, scope, schema, packet });
  }

  return callOpenAiJson({ config, scope, schema, packet });
}

async function callGeminiJson({ config, scope, schema, packet }) {
  const models = uniqueModels([config.model, ...(config.fallbackModels || [])]);
  const fallbackTrace = [];

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    try {
      const result = await callGeminiModelJson({ config: { ...config, model }, scope, schema, packet });
      return {
        ...result,
        model,
        fallbackTrace: [
          ...fallbackTrace,
          {
            model,
            status: "success",
            message: index === 0 ? "Primary model generated the draft." : "Fallback model generated the draft.",
          },
        ],
      };
    } catch (error) {
      const retryable = isGeminiRetryableFailure(error);
      fallbackTrace.push({
        model,
        status: "failed",
        retryable,
        httpStatus: error?.status || null,
        message: error instanceof Error ? error.message : "Gemini model failed.",
      });

      if (!retryable || index === models.length - 1) {
        const finalMessage = retryable
          ? `Gemini generation failed across all configured models. Last error: ${error instanceof Error ? error.message : "Unknown Gemini error."}`
          : error instanceof Error
            ? error.message
            : "Gemini generation failed.";
        throw withProviderError(finalMessage, { fallbackTrace, status: error?.status });
      }

      await delay(Math.min(400 * (index + 1), 1600));
    }
  }

  throw withProviderError("Gemini generation failed before any model was attempted.", { fallbackTrace });
}

async function callGeminiModelJson({ config, scope, schema, packet }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: buildNewsroomSystemPrompt(scope) }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: JSON.stringify(packet) }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: toGeminiSchema(schema.schema),
      },
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || `Gemini request failed with ${response.status}.`;
    if (response.status === 429 || /quota|rate limit|resource exhausted/i.test(message)) {
      throw withProviderError(providerLimitMessage("gemini"), { status: response.status, payload });
    }
    throw withProviderError(`Gemini API request failed: ${message}`, { status: response.status, payload });
  }

  const outputText = (payload?.candidates?.[0]?.content?.parts || [])
    .map((part) => part.text || "")
    .join("\n")
    .trim();

  try {
    return {
      draft: parseJsonFromText(outputText),
      provider: config.provider,
      model: config.model,
      raw: payload,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON.";
    throw withProviderError(`Gemini returned invalid JSON for the newsroom schema: ${message}`, { status: 422 });
  }
}

async function callOpenAiJson({ config, scope, schema, packet }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: buildNewsroomSystemPrompt(scope) }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: JSON.stringify(packet) }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: schema.name,
          schema: schema.schema,
          strict: schema.strict,
        },
      },
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || `OpenAI request failed with ${response.status}.`;
    if (response.status === 429 || /quota|rate limit/i.test(message)) {
      throw new Error(providerLimitMessage("openai"));
    }
    throw new Error(message);
  }

  const outputText =
    payload?.output_text ||
    payload?.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text;

  return {
    draft: typeof outputText === "string" ? parseJsonFromText(outputText) : payload,
    provider: config.provider,
    model: config.model,
    raw: payload,
  };
}

async function callAnthropicJson({ config, scope, schema, packet }) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 2400,
      system: `${buildNewsroomSystemPrompt(scope)}\nSchema name: ${schema.name}\nSchema: ${JSON.stringify(schema.schema)}`,
      messages: [
        {
          role: "user",
          content: `Return JSON only for this packet:\n${JSON.stringify(packet)}`,
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || `Anthropic request failed with ${response.status}.`;
    if (response.status === 429 || /quota|rate limit/i.test(message)) {
      throw new Error(providerLimitMessage("anthropic"));
    }
    throw new Error(message);
  }

  const outputText = (payload?.content || []).map((item) => item.text || "").join("\n").trim();
  return {
    draft: parseJsonFromText(outputText),
    provider: config.provider,
    model: config.model,
    raw: payload,
  };
}
