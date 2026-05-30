import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chdir, cwd } from "node:process";
import { runPipeline } from "../src/pipeline.js";

test("runPipeline writes source, target, and lock files in dry-run mode", async () => {
  const originalCwd = cwd();
  const dir = await mkdtemp(path.join(tmpdir(), "anylang-"));

  try {
    await mkdir(path.join(dir, "src"));
    await writeFile(
      path.join(dir, "src", "app.js"),
      "const title = $tr('home.title', 'Hello world'); const ignored = 'No translate';"
    );

    chdir(dir);
    const summary = await runPipeline({
      sourceLocale: "en",
      targetLocales: ["hi"],
      include: ["src/**/*.js"],
      exclude: ["node_modules", ".git"],
      outDir: "locales",
      functionName: "$tr",
      provider: { name: "none" }
    }, { dryRun: true });

    const en = JSON.parse(await readFile(path.join(dir, "locales", "en.json"), "utf8"));
    const hi = JSON.parse(await readFile(path.join(dir, "locales", "hi.json"), "utf8"));
    const lock = JSON.parse(await readFile(path.join(dir, "locales", "anylang.lock.json"), "utf8"));
    const generated = await readFile(path.join(dir, "anylang.ts"), "utf8");

    assert.equal(summary.sourceCount, 1);
    assert.deepEqual(en, {
      "home.title": {
        text: "Hello world",
        variables: []
      }
    });
    assert.deepEqual(hi, {
      "home.title": {
        source: "Hello world",
        text: "",
        variables: []
      }
    });
    assert.ok(lock.entries["hi:home.title"].fingerprint);
    assert.match(generated, /export type LanguageCode = 'en' \| 'hi'/);
    assert.match(generated, /import catalog_hi from '.\/locales\/hi.json'/);
    assert.match(generated, /export function AnyLangProvider/);
    assert.match(generated, /export function useTr/);
    assert.match(generated, /export function useLanguage/);
  } finally {
    chdir(originalCwd);
  }
});

test("runPipeline scans jsx and tsx files from the default include extensions", async () => {
  const originalCwd = cwd();
  const dir = await mkdtemp(path.join(tmpdir(), "anylang-"));

  try {
    await mkdir(path.join(dir, "src"));
    await writeFile(path.join(dir, "src", "page.jsx"), "export default () => <h1>{$tr('page.title', 'From JSX')}</h1>;");
    await writeFile(path.join(dir, "src", "card.tsx"), "export const Card = () => <button>{$tr(\"card.cta\", \"From TSX\")}</button>;");

    chdir(dir);
    await runPipeline({
      sourceLocale: "en",
      targetLocales: ["hi"],
      include: ["src/**/*.{js,jsx,ts,tsx,vue,html}"],
      exclude: ["node_modules", ".git"],
      outDir: "locales",
      functionName: "$tr",
      provider: { name: "none" }
    }, { dryRun: true });

    const en = JSON.parse(await readFile(path.join(dir, "locales", "en.json"), "utf8"));

    assert.deepEqual(en, {
      "card.cta": {
        text: "From TSX",
        variables: []
      },
      "page.title": {
        text: "From JSX",
        variables: []
      }
    });
  } finally {
    chdir(originalCwd);
  }
});

test("runPipeline retranslates existing target entries when source text changes", async () => {
  const originalCwd = cwd();
  const dir = await mkdtemp(path.join(tmpdir(), "anylang-"));
  const calls = [];

  try {
    await mkdir(path.join(dir, "src"));
    await mkdir(path.join(dir, "locales"));
    await writeFile(path.join(dir, "src", "app.js"), "const title = $tr('home.title', 'Welcome back');");
    await writeFile(path.join(dir, "locales", "hi.json"), `${JSON.stringify({
      "home.title": {
        source: "Welcome",
        text: "स्वागत है",
        variables: []
      }
    }, null, 2)}\n`);

    chdir(dir);
    await runPipeline({
      sourceLocale: "en",
      targetLocales: ["hi"],
      include: ["src/**/*.js"],
      exclude: ["node_modules", ".git"],
      outDir: "locales",
      functionName: "$tr",
      provider: { name: "none" }
    }, {
      translator: {
        async translate({ text }) {
          calls.push(text);
          return "वापसी पर स्वागत है";
        }
      }
    });

    const hi = JSON.parse(await readFile(path.join(dir, "locales", "hi.json"), "utf8"));

    assert.deepEqual(calls, ["Welcome back"]);
    assert.deepEqual(hi, {
      "home.title": {
        source: "Welcome back",
        text: "वापसी पर स्वागत है",
        variables: []
      }
    });
  } finally {
    chdir(originalCwd);
  }
});

test("runPipeline skips existing target entries when source text is unchanged", async () => {
  const originalCwd = cwd();
  const dir = await mkdtemp(path.join(tmpdir(), "anylang-"));
  const calls = [];

  try {
    await mkdir(path.join(dir, "src"));
    await mkdir(path.join(dir, "locales"));
    await writeFile(path.join(dir, "src", "app.js"), "const title = $tr('home.title', 'Welcome');");
    await writeFile(path.join(dir, "locales", "hi.json"), `${JSON.stringify({
      "home.title": {
        source: "Welcome",
        text: "स्वागत है",
        variables: []
      }
    }, null, 2)}\n`);

    chdir(dir);
    await runPipeline({
      sourceLocale: "en",
      targetLocales: ["hi"],
      include: ["src/**/*.js"],
      exclude: ["node_modules", ".git"],
      outDir: "locales",
      functionName: "$tr",
      provider: { name: "none" }
    }, {
      translator: {
        async translate({ text }) {
          calls.push(text);
          return "SHOULD NOT BE USED";
        }
      }
    });

    const hi = JSON.parse(await readFile(path.join(dir, "locales", "hi.json"), "utf8"));

    assert.deepEqual(calls, []);
    assert.deepEqual(hi, {
      "home.title": {
        source: "Welcome",
        text: "स्वागत है",
        variables: []
      }
    });
  } finally {
    chdir(originalCwd);
  }
});

test("scan dry-run does not mark stale target entries as fresh", async () => {
  const originalCwd = cwd();
  const dir = await mkdtemp(path.join(tmpdir(), "anylang-"));

  try {
    await mkdir(path.join(dir, "src"));
    await mkdir(path.join(dir, "locales"));
    await writeFile(path.join(dir, "src", "app.js"), "const title = $tr('home.title', 'Welcome back');");
    await writeFile(path.join(dir, "locales", "hi.json"), `${JSON.stringify({
      "home.title": {
        source: "Welcome",
        text: "स्वागत है",
        variables: []
      }
    }, null, 2)}\n`);

    chdir(dir);
    await runPipeline({
      sourceLocale: "en",
      targetLocales: ["hi"],
      include: ["src/**/*.js"],
      exclude: ["node_modules", ".git"],
      outDir: "locales",
      functionName: "$tr",
      provider: { name: "none" }
    }, { dryRun: true });

    const hi = JSON.parse(await readFile(path.join(dir, "locales", "hi.json"), "utf8"));

    assert.deepEqual(hi, {
      "home.title": {
        source: "Welcome",
        text: "स्वागत है",
        variables: []
      }
    });
  } finally {
    chdir(originalCwd);
  }
});

test("runPipeline translates placeholder entries even when source matches", async () => {
  const originalCwd = cwd();
  const dir = await mkdtemp(path.join(tmpdir(), "anylang-"));
  const calls = [];

  try {
    await mkdir(path.join(dir, "src"));
    await mkdir(path.join(dir, "locales"));
    await writeFile(path.join(dir, "src", "app.js"), "const title = $tr('home.title', 'Welcome');");
    await writeFile(path.join(dir, "locales", "hi.json"), `${JSON.stringify({
      "home.title": {
        source: "Welcome",
        text: "",
        variables: []
      }
    }, null, 2)}\n`);

    chdir(dir);
    await runPipeline({
      sourceLocale: "en",
      targetLocales: ["hi"],
      include: ["src/**/*.js"],
      exclude: ["node_modules", ".git"],
      outDir: "locales",
      functionName: "$tr",
      provider: { name: "none" }
    }, {
      translator: {
        async translate({ text }) {
          calls.push(text);
          return "स्वागत है";
        }
      }
    });

    const hi = JSON.parse(await readFile(path.join(dir, "locales", "hi.json"), "utf8"));

    assert.deepEqual(calls, ["Welcome"]);
    assert.equal(hi["home.title"].text, "स्वागत है");
  } finally {
    chdir(originalCwd);
  }
});
