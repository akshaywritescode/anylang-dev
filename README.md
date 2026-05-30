# anylang-dev

`anylang-dev` is a small bring-your-own-key website translation CLI. It scans your source code for explicit translation calls and writes JSON locale files.

```js
const title = $tr("home.title", "This would get translated");
const untouched = "This stays as it is";
```

It works in JSX and TSX when the text is wrapped in a JavaScript expression:

```tsx
export function Hero() {
  const $tr = useTr();

  return (
    <section>
      <h1>{$tr("home.title", "Welcome back")}</h1>
      <button aria-label={$tr("actions.saveChanges", "Save changes")}>
        {$tr("actions.save", "Save")}
      </button>
      <p>This plain JSX text stays as it is.</p>
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
    "output": "anylang.ts",
    "importFrom": "anylang-dev/runtime"
  },
  "functionName": "$tr",
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
anylang.ts
```

The lock file stores SHA-256 fingerprints so unchanged strings are skipped on later runs.

## Workflow

1. Wrap source text in your app:

```tsx
<h1>{$tr("hero.title", "Translate your website with anylang")}</h1>
```

2. Scan the project:

```bash
anylang scan
```

This writes keyed source entries to `locales/en.json` and creates placeholder entries in each target locale.
It also generates `anylang.ts`, which imports all locale JSON files and exports runtime helpers.

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
  "hero.title": {
    "text": "Translate your website with anylang",
    "variables": []
  }
}
```

Target locale output:

```json
{
  "hero.title": {
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
} from "./anylang";
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

Then use translations in any component:

```tsx
function Hero() {
  const $tr = useTr();
  return <h1>{$tr("hero.title", "Translate your website with anylang")}</h1>;
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
