# anylang-dev

![Anylang Gif](https://raw.githubusercontent.com/akshaywritescode/anylang-dev/refs/heads/main/anylang.gif)

A bring-your-own-key website translation CLI with Vite and Next.js support. It automatically scans your React components, extracts text, and translates them using your own AI provider keys (Gemini, OpenRouter, Anthropic, OpenAI, Mistral, and more).

[**📖 Read the full documentation at anylang.mintlify.app**](https://anylang.mintlify.app/)

---

## Installation

```bash
npm install --save-dev anylang-dev
npx anylang init
```

## Setup

**Vite:**
Add the plugin to `vite.config.ts`:
```ts
import anylang from "anylang-dev/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [anylang(), react()],
});
```

**Next.js:**
Wrap your config in `next.config.mjs`:
```js
import anylang from "anylang-dev/next";

export default anylang({ runtimeImport: "@/anylang" })({});
```

*(If you use TypeScript, add `import "anylang-dev/jsx-runtime";` to your global `d.ts` file).*

## How to use

### 1. Write standard JSX
Just write normal text. No need to wrap everything in translation functions. To explicitly skip translating a string, just add `tr="false"`.
```tsx
<h1>Translate your website with anylang</h1>
<p tr="false">This text stays exactly as it is</p>
```

### 2. Scan strings
Extracts strings and generates your locale JSON files and runtime helpers.
```bash
npx anylang scan
```

### 3. Translate
Add your AI provider key to `.env` (e.g., `GEMINI_API_KEY=your-key`) and run the translator.
```bash
npx anylang translate
```
*Note: `anylang` is BYOK. It securely loads your `.env` locally, directly calls the AI, and does not proxy requests or track usage.*

---

## Runtime Usage

Wrap your app in the provider and use the generated hooks for dynamic text or language selection.

```tsx
import { AnyLangProvider, useTr, useLanguage } from "@/anylang";

// 1. Wrap your app (Root layout or entry point)
<AnyLangProvider>
  <App />
</AnyLangProvider>

// 2. Translate dynamic text
function SaveButton() {
  const $tr = useTr();
  return <button>{$tr("actions.save", "Save")}</button>;
}

// 3. Build a language selector
function Selector() {
  const { language, setLanguage, languages } = useLanguage();
  return (
    <select value={language} onChange={(e) => setLanguage(e.target.value)}>
      {languages.map(l => <option key={l.code} value={l.code}>{l.nativeLabel}</option>)}
    </select>
  )
}
```

---

## Star History

[![Star History Chart](https://api.star-history.com/chart?repos=akshaywritescode/anylang-dev&type=date&legend=top-left&sealed_token=SNVwVxiar2GWHTCIWwbQrCuR-ifxQmzkgDz6nNpolmiUx7UrGrZ8Vs_N6GuPmz1WilDSpz0hYyeaw87g2Y6Yu0Mw6T_xaHLjnduU78ioayvvozR-nAhF_w6JHsLzieJ4TP7GQ9qh5mRWHl3Ol10xjFp8zyDKT5Hp0LtKyD0zP95gcJSj_9OfvoZxGi2o)](https://www.star-history.com/?repos=akshaywritescode%2Fanylang-dev&type=date&legend=top-left)
