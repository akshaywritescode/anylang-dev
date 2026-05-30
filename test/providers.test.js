import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chdir, cwd } from "node:process";
import { createTranslator, supportedProviders } from "../src/providers.js";

test("exports popular provider names", () => {
  assert.deepEqual(supportedProviders, [
    "anthropic",
    "cohere",
    "deepseek",
    "fireworks",
    "gemini",
    "groq",
    "mistral",
    "openai",
    "openai-compatible",
    "openrouter",
    "perplexity",
    "together",
    "xai"
  ]);
});

test("gemini provider sends generateContent requests", async () => {
  const env = await withEnv({ GEMINI_API_KEY: "test-key" });
  const fetchMock = mockFetch({
    candidates: [
      {
        content: {
          parts: [{ text: "नमस्ते" }]
        }
      }
    ]
  });

  try {
    const translator = createTranslator({
      name: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-2.5-flash"
    });
    const result = await translator.translate({
      text: "Hello",
      sourceLocale: "en",
      targetLocale: "hi"
    });

    assert.equal(result, "नमस्ते");
    assert.equal(
      fetchMock.request.url,
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
    );
    assert.equal(fetchMock.request.options.headers["x-goog-api-key"], "test-key");
    assert.match(fetchMock.request.options.body, /Translate from en to hi/);
  } finally {
    fetchMock.restore();
    env.restore();
  }
});

test("openai-compatible presets use chat completions with provider env keys", async () => {
  const env = await withEnv({ GROQ_API_KEY: "groq-key" });
  const fetchMock = mockFetch({
    choices: [
      {
        message: {
          content: "Bonjour"
        }
      }
    ]
  });

  try {
    const translator = createTranslator({ name: "groq" });
    const result = await translator.translate({
      text: "Hello",
      sourceLocale: "en",
      targetLocale: "fr"
    });

    assert.equal(result, "Bonjour");
    assert.equal(fetchMock.request.url, "https://api.groq.com/openai/v1/chat/completions");
    assert.equal(fetchMock.request.options.headers.authorization, "Bearer groq-key");
    assert.match(fetchMock.request.options.body, /llama-3\.3-70b-versatile/);
  } finally {
    fetchMock.restore();
    env.restore();
  }
});

test("anthropic provider sends messages requests", async () => {
  const env = await withEnv({ ANTHROPIC_API_KEY: "anthropic-key" });
  const fetchMock = mockFetch({
    content: [{ type: "text", text: "Hallo" }]
  });

  try {
    const translator = createTranslator({ name: "anthropic" });
    const result = await translator.translate({
      text: "Hello",
      sourceLocale: "en",
      targetLocale: "de"
    });

    assert.equal(result, "Hallo");
    assert.equal(fetchMock.request.url, "https://api.anthropic.com/v1/messages");
    assert.equal(fetchMock.request.options.headers["x-api-key"], "anthropic-key");
    assert.equal(fetchMock.request.options.headers["anthropic-version"], "2023-06-01");
  } finally {
    fetchMock.restore();
    env.restore();
  }
});

test("cohere provider sends v2 chat requests", async () => {
  const env = await withEnv({ COHERE_API_KEY: "cohere-key" });
  const fetchMock = mockFetch({
    message: {
      content: [{ type: "text", text: "Hola" }]
    }
  });

  try {
    const translator = createTranslator({ name: "cohere" });
    const result = await translator.translate({
      text: "Hello",
      sourceLocale: "en",
      targetLocale: "es"
    });

    assert.equal(result, "Hola");
    assert.equal(fetchMock.request.url, "https://api.cohere.com/v2/chat");
    assert.equal(fetchMock.request.options.headers.authorization, "Bearer cohere-key");
  } finally {
    fetchMock.restore();
    env.restore();
  }
});

test("provider loads API key from project .env", async () => {
  const originalCwd = cwd();
  const dir = await mkdtemp(path.join(tmpdir(), "anylang-env-"));
  const env = await withEnv({ GEMINI_API_KEY: undefined });
  const fetchMock = mockFetch({
    candidates: [
      {
        content: {
          parts: [{ text: "Bonjour" }]
        }
      }
    ]
  });

  await writeFile(path.join(dir, ".env"), "GEMINI_API_KEY=env-file-key\n");
  chdir(dir);

  try {
    const translator = createTranslator({
      name: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-2.5-flash"
    });

    await translator.translate({
      text: "Hello",
      sourceLocale: "en",
      targetLocale: "fr"
    });

    assert.equal(fetchMock.request.options.headers["x-goog-api-key"], "env-file-key");
  } finally {
    chdir(originalCwd);
    fetchMock.restore();
    await rm(dir, { recursive: true, force: true });
    env.restore();
  }
});

function mockFetch(responseBody) {
  const originalFetch = globalThis.fetch;
  const state = {
    request: undefined
  };

  globalThis.fetch = async (url, options) => {
    state.request = { url, options };
    return new Response(JSON.stringify(responseBody), { status: 200 });
  };

  return {
    get request() {
      return state.request;
    },
    restore() {
      globalThis.fetch = originalFetch;
    }
  };
}

async function withEnv(values) {
  const original = {};
  for (const key of Object.keys(values)) {
    original[key] = process.env[key];
    if (values[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = values[key];
    }
  }

  return {
    restore() {
      for (const key of Object.keys(values)) {
        if (original[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = original[key];
        }
      }
    }
  };
}
