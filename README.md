# anylang-dev

`anylang-dev` is a bring-your-own-key website translation CLI with Vite and Next.js support. It scans your source code, writes JSON locale files, and can automatically translate static JSX text.

![gif](https://raw.githubusercontent.com/akshaywritescode/anylang-dev/refs/heads/main/anylang.gif)

```tsx
<h1>Translate your website with anylang</h1>
<p tr="false">This text stays as it is</p>
```

For dynamic text, use the generated `useTr` hook:

```tsx
export function Hero() {
  const $tr = useTr();

  return (
    <section>
      <h1>Welcome back</h1>
      <button>{$tr("actions.save", "Save")}</button>
      <p tr="false">BrandName</p>
    </section>
  );
}
```

By default, `anylang` scans `.js`, `.jsx`, `.ts`, `.tsx`, `.vue`, and `.html` files under `src`.

## Language selector

`anylang` does not require a built-in selector. Build any selector UI you want and pass the selected locale to `setLanguage`.

```tsx
const { language, languages, setLanguage } = useLanguage();

return (
  <select
    value={language}
    onChange={(event) => setLanguage(event.target.value as LanguageCode)}
  >
    {languages.map((language) => (
      <option key={language.code} value={language.code}>
        {language.nativeLabel}
      </option>
    ))}
  </select>
);
```

Use `$tr("key", "source text")` anywhere in the same render tree:

```tsx
<h1>{$tr("hero.title", "Translate your website with anylang")}</h1>
```

## Quick start

```bash
npm link
anylang init
anylang scan
```

Add the Vite plugin:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import anylang from "anylang-dev/vite";

export default defineConfig({
  plugins: [anylang(), react()],
});
```

For Next.js, use the config wrapper in `next.config.mjs`:

```js
import anylang from "anylang-dev/next";

const nextConfig = {};

export default anylang({
  runtimeImport: "@/anylang",
})(nextConfig);
```

If you use `tr="false"`, add the JSX type augmentation once in `src/vite-env.d.ts`:

```ts
import "anylang-dev/jsx-runtime";
```

That makes this TypeScript-safe:

```tsx
<p tr="false">BrandName</p>
```

In a Next.js app, you can put the same import in any global declaration file, such as `src/anylang-env.d.ts`.

`anylang scan` creates locale files without calling a translation provider. To translate for real with Gemini, add your own API key to `.env` in the project where you run `anylang`:

```env
GEMINI_API_KEY=your-provider-key
```

Then run:

```bash
anylang translate
```

## Config

`anylang init` creates:

```json
{
  "sourceLocale": "en",
  "targetLocales": ["hi"],
  "include": ["src/**/*.{js,jsx,ts,tsx,vue,html}"],
  "exclude": ["node_modules", ".git", "dist", "build", ".next"],
  "outDir": "locales",
  "runtime": {
    "output": "src/anylang.ts",
    "importFrom": "anylang-dev/runtime"
  },
  "functionName": "$tr",
  "autoTranslate": {
    "jsx": true,
    "keyPrefix": "auto"
  },
  "provider": {
    "name": "gemini",
    "model": "gemini-2.5-flash"
  }
}
```

The provider is intentionally BYOK. `anylang` does not include a platform key, proxy requests, track usage, or store billing data. It automatically loads `.env` from the current project before calling the provider.

## Providers

Choose a provider by setting `provider.name`. Each provider reads its standard API key from `.env`.

| Provider | `provider.name` | `.env` key |
| --- | --- | --- |
| Gemini | `gemini` | `GEMINI_API_KEY` |
| OpenAI | `openai` | `OPENAI_API_KEY` |
| Anthropic | `anthropic` | `ANTHROPIC_API_KEY` |
| Cohere | `cohere` | `COHERE_API_KEY` |
| Mistral | `mistral` | `MISTRAL_API_KEY` |
| DeepSeek | `deepseek` | `DEEPSEEK_API_KEY` |
| Groq | `groq` | `GROQ_API_KEY` |
| OpenRouter | `openrouter` | `OPENROUTER_API_KEY` |
| Perplexity | `perplexity` | `PERPLEXITY_API_KEY` |
| xAI | `xai` | `XAI_API_KEY` |
| Together AI | `together` | `TOGETHER_API_KEY` |
| Fireworks AI | `fireworks` | `FIREWORKS_API_KEY` |
| Custom OpenAI-compatible | `openai-compatible` | `ANYLANG_API_KEY` |

Example:

```json
{
  "provider": {
    "name": "anthropic",
    "model": "claude-3-5-haiku-latest"
  }
}
```

For custom OpenAI-compatible gateways, provide `baseUrl` and `model`:

```json
{
  "provider": {
    "name": "openai-compatible",
    "baseUrl": "https://your-gateway.example.com/v1",
    "model": "your-model"
  }
}
```

## Output

Scanning or translating creates:

```text
locales/
  en.json
  hi.json
  anylang.lock.json
src/
  anylang.ts
```

The lock file stores SHA-256 fingerprints so unchanged strings are skipped on later runs.

## Workflow

1. Write normal static JSX text:

```tsx
<h1>Translate your website with anylang</h1>
<p tr="false">Do not translate this text</p>
```

Use `$tr("key", "source text")` only for dynamic or special cases.

2. Scan the project:

```bash
anylang scan
```

This writes keyed source entries to `locales/en.json` and creates placeholder entries in each target locale.
It also generates `src/anylang.ts`, which imports all locale JSON files and exports runtime helpers.

3. Translate with Gemini:

```env
GEMINI_API_KEY=your-gemini-api-key
```

```bash
anylang translate
```

This scans again, sends missing or changed target entries to Gemini, and writes the translated text into files like `locales/hi.json`.

Source locale output:

```json
{
  "auto.src_app.translate_your_website_with_anylang_a1b2c3d4": {
    "text": "Translate your website with anylang",
    "variables": []
  }
}
```

Target locale output:

```json
{
  "auto.src_app.translate_your_website_with_anylang_a1b2c3d4": {
    "source": "Translate your website with anylang",
    "text": "anylang से अपनी वेबसाइट का अनुवाद करें",
    "variables": []
  }
}
```

On later runs, `anylang translate` compares `targetEntry.source` against the current source text. If they differ, it retranslates that key. If they match, it keeps the existing translation and skips the AI call.

## Runtime

Import the generated runtime file in your app:

```tsx
import {
  AnyLangProvider,
  useLanguage,
  useTr,
  type LanguageCode
} from "@/anylang";
```

You do not manually import `en.json`, `hi.json`, `ja.json`, etc. The generated file does that for you based on `sourceLocale` and `targetLocales`.

Wrap your app once:

```tsx
root.render(
  <AnyLangProvider>
    <App />
  </AnyLangProvider>
);
```

For the Next.js App Router, create a client provider:

```tsx
// app/providers.tsx
"use client";

import { AnyLangProvider } from "@/anylang";

export function Providers({ children }: { children: React.ReactNode }) {
  return <AnyLangProvider>{children}</AnyLangProvider>;
}
```

Then wrap your layout:

```tsx
// app/layout.tsx
import { Providers } from "./providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

Then use translations in any component:

```tsx
function Hero() {
  return <h1>Translate your website with anylang</h1>;
}
```

For dynamic text:

```tsx
function SaveButton() {
  const $tr = useTr();
  return <button>{$tr("actions.save", "Save")}</button>;
}
```

And build any selector with `useLanguage`:

```tsx
function LanguageSelector() {
  const { language, languages, setLanguage } = useLanguage();

  return (
    <select
      value={language}
      onChange={(event) => setLanguage(event.target.value as LanguageCode)}
    >
      {languages.map((language) => (
        <option key={language.code} value={language.code}>
          {language.nativeLabel}
        </option>
      ))}
    </select>
  );
}
```
