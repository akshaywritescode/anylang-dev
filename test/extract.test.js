import test from "node:test";
import assert from "node:assert/strict";
import { extractFromSource } from "../src/extract.js";

test("extracts explicit translation calls", () => {
  const source = `
    const one = $tr("Hello world");
    const two = $tr('Save changes');
    const three = $tr(\`Plain template\`);
  `;

  assert.deepEqual(extractFromSource(source).map((item) => item.value), [
    "Hello world",
    "Save changes",
    "Plain template"
  ]);
});

test("extracts keyed translation calls", () => {
  const source = `
    const title = $tr("home.title", "Welcome");
    const count = $tr("cart.count", "You have {count} items", language);
  `;

  assert.deepEqual(extractFromSource(source).map((item) => ({
    key: item.key,
    value: item.value,
    variables: item.variables
  })), [
    { key: "home.title", value: "Welcome", variables: [] },
    { key: "cart.count", value: "You have {count} items", variables: ["count"] }
  ]);
});

test("ignores ordinary strings and comments", () => {
  const source = `
    const ignored = "Hello world";
    // $tr("Nope")
    /* $tr("Also nope") */
    const picked = $tr("Yes");
  `;

  assert.deepEqual(extractFromSource(source).map((item) => item.value), ["Yes"]);
});

test("rejects dynamic template literals", () => {
  const source = "const bad = $tr(`Hello ${name}`); const good = $tr('Hello');";
  assert.deepEqual(extractFromSource(source).map((item) => item.value), ["Hello"]);
});

test("extracts strings from JSX and TSX expressions", () => {
  const source = `
    export function Header({ count }: { count: number }) {
      return (
        <main>
          <h1>{$tr("Welcome back")}</h1>
          <button aria-label={$tr('Save changes')}>{$tr("Save")}</button>
          <p>This plain JSX text stays untouched.</p>
        </main>
      );
    }
  `;

  assert.deepEqual(extractFromSource(source).map((item) => item.value), [
    "Welcome back",
    "Save changes",
    "Save"
  ]);
});

test("extracts the source literal when $tr receives runtime args", () => {
  const source = `
    <h1>{$tr("Welcome back", language)}</h1>
    <p>{$tr('Nested args still work', getLocale({ fallback: true }))}</p>
  `;

  assert.deepEqual(extractFromSource(source).map((item) => item.value), [
    "Welcome back",
    "Nested args still work"
  ]);
});
