import { loadDotEnv } from "./env.js";

const OPENAI_COMPATIBLE_PRESETS = {
  openai: {
    apiKeyEnv: "OPENAI_API_KEY",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini"
  },
  "openai-compatible": {
    apiKeyEnv: "ANYLANG_API_KEY",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini"
  },
  mistral: {
    apiKeyEnv: "MISTRAL_API_KEY",
    baseUrl: "https://api.mistral.ai/v1",
    model: "mistral-large-latest"
  },
  deepseek: {
    apiKeyEnv: "DEEPSEEK_API_KEY",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat"
  },
  groq: {
    apiKeyEnv: "GROQ_API_KEY",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile"
  },
  openrouter: {
    apiKeyEnv: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4.1-mini"
  },
  perplexity: {
    apiKeyEnv: "PERPLEXITY_API_KEY",
    baseUrl: "https://api.perplexity.ai",
    model: "sonar"
  },
  xai: {
    apiKeyEnv: "XAI_API_KEY",
    baseUrl: "https://api.x.ai/v1",
    model: "grok-3-mini"
  },
  together: {
    apiKeyEnv: "TOGETHER_API_KEY",
    baseUrl: "https://api.together.xyz/v1",
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo"
  },
  fireworks: {
    apiKeyEnv: "FIREWORKS_API_KEY",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    model: "accounts/fireworks/models/llama-v3p3-70b-instruct"
  }
};

const NATIVE_PRESETS = {
  gemini: {
    apiKeyEnv: "GEMINI_API_KEY",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash"
  },
  anthropic: {
    apiKeyEnv: "ANTHROPIC_API_KEY",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-3-5-haiku-latest",
    version: "2023-06-01"
  },
  cohere: {
    apiKeyEnv: "COHERE_API_KEY",
    baseUrl: "https://api.cohere.com/v2",
    model: "command-a-03-2025"
  }
};

export const supportedProviders = [
  ...Object.keys(NATIVE_PRESETS),
  ...Object.keys(OPENAI_COMPATIBLE_PRESETS)
].sort();

export function createTranslator(providerConfig) {
  loadDotEnv();

  if (!providerConfig || providerConfig.name === "none") {
    return null;
  }

  const name = providerConfig.name;
  if (OPENAI_COMPATIBLE_PRESETS[name]) {
    return new OpenAICompatibleTranslator(resolvePreset(OPENAI_COMPATIBLE_PRESETS[name], providerConfig));
  }

  if (name === "gemini") {
    return new GeminiTranslator(resolvePreset(NATIVE_PRESETS.gemini, providerConfig));
  }

  if (name === "anthropic") {
    return new AnthropicTranslator(resolvePreset(NATIVE_PRESETS.anthropic, providerConfig));
  }

  if (name === "cohere") {
    return new CohereTranslator(resolvePreset(NATIVE_PRESETS.cohere, providerConfig));
  }

  throw new Error(`Unsupported provider: ${providerConfig.name}. Supported providers: ${supportedProviders.join(", ")}`);
}

function resolvePreset(preset, config) {
  return {
    ...preset,
    ...withoutName(config)
  };
}

function withoutName(config) {
  const { name, ...rest } = config || {};
  return rest;
}

function readApiKey(config) {
  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`Missing provider API key. Set ${config.apiKeyEnv} in .env or run with --dry-run.`);
  }
  return apiKey;
}

function translationSystemPrompt() {
  return [
    "You translate website UI copy.",
    "Return only the translated text.",
    "Preserve placeholders, variables, punctuation intent, and whitespace shape.",
    "Do not add explanations."
  ].join(" ");
}

function translationUserPrompt({ text, sourceLocale, targetLocale }) {
  return `Translate from ${sourceLocale} to ${targetLocale}:\n${text}`;
}

class OpenAICompatibleTranslator {
  constructor(config) {
    this.config = config;
    this.apiKey = readApiKey(config);
  }

  async translate({ text, sourceLocale, targetLocale }) {
    const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: translationSystemPrompt()
          },
          {
            role: "user",
            content: translationUserPrompt({ text, sourceLocale, targetLocale })
          }
        ]
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Translation provider failed (${response.status}): ${body}`);
    }

    const json = await response.json();
    const translated = json.choices?.[0]?.message?.content?.trim();
    if (!translated) throw new Error("Translation provider returned an empty response.");
    return translated;
  }
}

class GeminiTranslator {
  constructor(config) {
    this.config = config;
    this.apiKey = readApiKey(config);
  }

  async translate({ text, sourceLocale, targetLocale }) {
    const baseUrl = this.config.baseUrl.replace(/\/$/, "");
    const model = encodeURIComponent(this.config.model);
    const response = await fetch(`${baseUrl}/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": this.apiKey
      },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  translationSystemPrompt(),
                  "",
                  translationUserPrompt({ text, sourceLocale, targetLocale })
                ].join("\n")
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gemini provider failed (${response.status}): ${body}`);
    }

    const json = await response.json();
    const translated = json.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    if (!translated) throw new Error("Gemini provider returned an empty response.");
    return translated;
  }
}

class AnthropicTranslator {
  constructor(config) {
    this.config = config;
    this.apiKey = readApiKey(config);
  }

  async translate({ text, sourceLocale, targetLocale }) {
    const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": this.config.version
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: 2048,
        temperature: 0,
        system: translationSystemPrompt(),
        messages: [
          {
            role: "user",
            content: translationUserPrompt({ text, sourceLocale, targetLocale })
          }
        ]
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic provider failed (${response.status}): ${body}`);
    }

    const json = await response.json();
    const translated = json.content
      ?.map((part) => part.type === "text" ? part.text : "")
      .join("")
      .trim();

    if (!translated) throw new Error("Anthropic provider returned an empty response.");
    return translated;
  }
}

class CohereTranslator {
  constructor(config) {
    this.config = config;
    this.apiKey = readApiKey(config);
  }

  async translate({ text, sourceLocale, targetLocale }) {
    const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: translationSystemPrompt()
          },
          {
            role: "user",
            content: translationUserPrompt({ text, sourceLocale, targetLocale })
          }
        ]
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Cohere provider failed (${response.status}): ${body}`);
    }

    const json = await response.json();
    const translated = json.message?.content
      ?.map((part) => part.type === "text" ? part.text : "")
      .join("")
      .trim();

    if (!translated) throw new Error("Cohere provider returned an empty response.");
    return translated;
  }
}
