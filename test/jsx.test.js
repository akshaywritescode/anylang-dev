import test from "node:test";
import assert from "node:assert/strict";
import { extractAutoJsxStrings, transformAutoJsx } from "../src/jsx.js";

test("extractAutoJsxStrings extracts static JSX text and skips tr=false", () => {
  const source = `
    export function App() {
      return (
        <main>
          <h1>Hello world</h1>
          <p tr="false">BrandName should stay</p>
          <button>Get started</button>
        </main>
      );
    }
  `;

  const items = extractAutoJsxStrings(source, "/project/src/App.tsx");

  assert.deepEqual(items.map((item) => item.value), [
    "Hello world",
    "Get started"
  ]);
  assert.ok(items[0].key.startsWith("auto."));
});

test("transformAutoJsx wraps static JSX text with AnyLangText", () => {
  const source = `
    export function App() {
      return (
        <main>
          <h1>Hello world</h1>
          <p tr={false}>Skip me</p>
        </main>
      );
    }
  `;

  const result = transformAutoJsx(source, "/project/src/App.tsx", {
    runtimeImport: "@/anylang"
  });

  assert.equal(result.changed, true);
  assert.match(result.code, /import \{ AnyLangText \} from "@\/anylang"/);
  assert.match(result.code, /<AnyLangText k="auto\./);
  assert.match(result.code, /source="Hello world"/);
  assert.match(result.code, /<p>Skip me<\/p>/);
});
