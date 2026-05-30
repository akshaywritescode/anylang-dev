import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractProjectStrings } from "./extract.js";
import { createTranslator } from "./providers.js";

export async function runPipeline(config, options = {}) {
  const outDir = path.resolve(config.outDir);
  await mkdir(outDir, { recursive: true });

  const extraction = await extractProjectStrings(config);
  const sourceEntries = sourceEntriesFromItems(extraction.items);
  const sourceCatalog = sortObject(Object.fromEntries(sourceEntries.map((entry) => [
    entry.key,
    {
      text: entry.text,
      variables: entry.variables
    }
  ])));
  await writeJson(path.join(outDir, `${config.sourceLocale}.json`), sourceCatalog);

  const lockPath = path.join(outDir, "anylang.lock.json");
  const lock = await readJson(lockPath, { version: 1, entries: {} });
  const translator = options.translator || (options.dryRun ? null : createTranslator(config.provider));
  let translatedCount = 0;
  let skippedTranslationCount = 0;

  for (const locale of config.targetLocales) {
    if (locale === config.sourceLocale) continue;
    const localePath = path.join(outDir, `${locale}.json`);
    const catalog = await readJson(localePath, {});

    for (const entry of sourceEntries) {
      const existing = normalizeTargetEntry(catalog[entry.key]);
      const fingerprint = hashString(entry.text);
      const lockKey = `${locale}:${entry.key}`;
      const isFresh = existing && existing.source === entry.text && existing.text;
      if (isFresh) continue;

      if (options.dryRun || !translator) {
        if (!existing) {
          catalog[entry.key] = {
            source: entry.text,
            text: "",
            variables: entry.variables
          };
        }
        skippedTranslationCount += 1;
      } else {
        catalog[entry.key] = {
          source: entry.text,
          text: await translator.translate({ text: entry.text, sourceLocale: config.sourceLocale, targetLocale: locale }),
          variables: entry.variables
        };
        translatedCount += 1;
      }

      lock.entries[lockKey] = {
        fingerprint,
        updatedAt: new Date().toISOString()
      };
    }

    for (const key of Object.keys(catalog)) {
      if (!sourceCatalog[key]) delete catalog[key];
    }
    await writeJson(localePath, sortObject(catalog));
  }

  await writeJson(lockPath, lock);
  await writeGeneratedRuntime(config);

  return {
    sourceCount: sourceEntries.length,
    localeCount: 1 + config.targetLocales.filter((locale) => locale !== config.sourceLocale).length,
    translatedCount,
    skippedTranslationCount,
    outDir: path.relative(process.cwd(), outDir) || "."
  };
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function hashString(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sortObject(object) {
  return Object.fromEntries(Object.entries(object).sort(([left], [right]) => left.localeCompare(right)));
}

function sourceEntriesFromItems(items) {
  const entries = new Map();
  for (const item of items) {
    const existing = entries.get(item.key);
    if (existing && existing.text !== item.value) {
      throw new Error(`Translation key "${item.key}" has multiple source texts: "${existing.text}" and "${item.value}".`);
    }
    entries.set(item.key, {
      key: item.key,
      text: item.value,
      variables: item.variables || []
    });
  }
  return Array.from(entries.values()).sort((left, right) => left.key.localeCompare(right.key));
}

function normalizeTargetEntry(entry) {
  if (!entry) return null;
  if (typeof entry === "string") {
    return { source: undefined, text: entry, variables: [] };
  }
  return {
    source: entry.source,
    text: typeof entry.text === "string" ? entry.text : "",
    variables: Array.isArray(entry.variables) ? entry.variables : []
  };
}

async function writeGeneratedRuntime(config) {
  if (config.runtime === false) return;

  const output = path.resolve(config.runtime?.output || "anylang.ts");
  const outDir = path.resolve(config.outDir);
  const locales = [config.sourceLocale, ...config.targetLocales.filter((locale) => locale !== config.sourceLocale)];
  const importFrom = config.runtime?.importFrom || "anylang-dev/runtime";
  const runtimeDir = path.dirname(output);
  const localeImports = locales.map((locale) => ({
    locale,
    identifier: localeIdentifier(locale),
    importPath: toImportPath(path.relative(runtimeDir, path.join(outDir, `${locale}.json`)))
  }));

  await mkdir(runtimeDir, { recursive: true });
  await writeFile(output, `${generatedRuntimeSource({ importFrom, localeImports, sourceLocale: config.sourceLocale })}\n`);
}

function generatedRuntimeSource({ importFrom, localeImports, sourceLocale }) {
  const imports = localeImports
    .map((item) => `import ${item.identifier} from '${item.importPath}'`)
    .join("\n");
  const languageUnion = localeImports.map((item) => `'${item.locale}'`).join(" | ");
  const languageItems = localeImports
    .map((item) => `  { code: '${item.locale}' as const, label: '${languageLabel(item.locale)}', nativeLabel: '${nativeLanguageLabel(item.locale)}' }`)
    .join(",\n");
  const catalogItems = localeImports
    .map((item) => `  '${item.locale}': ${item.identifier}`)
    .join(",\n");

  return `/* This file is generated by anylang. Do not edit by hand. */
import { createContext, createElement, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { $tr as translate, configureAnyLang, setAnyLangLocale } from '${importFrom}'
${imports}

export type LanguageCode = ${languageUnion}

export const languages = [
${languageItems}
]

configureAnyLang({
  locale: '${sourceLocale}',
  catalogs: {
${catalogItems}
  },
})

export function useAnyLang(locale: LanguageCode) {
  return useCallback((key: string, source?: string) => {
    return translate(key, source, locale)
  }, [locale])
}

export function setLanguage(locale: LanguageCode) {
  setAnyLangLocale(locale)
}

type AnyLangContextValue = {
  language: LanguageCode
  languages: typeof languages
  setLanguage: (locale: LanguageCode) => void
  $tr: (key: string, source?: string) => string
}

const AnyLangContext = createContext<AnyLangContextValue | null>(null)

export function AnyLangProvider({
  children,
  defaultLanguage = '${sourceLocale}' as LanguageCode,
}: {
  children: ReactNode
  defaultLanguage?: LanguageCode
}) {
  const [language, setSelectedLanguage] = useState<LanguageCode>(defaultLanguage)
  const $tr = useAnyLang(language)

  const value = useMemo(() => ({
    language,
    languages,
    setLanguage(nextLanguage: LanguageCode) {
      setAnyLangLocale(nextLanguage)
      setSelectedLanguage(nextLanguage)
    },
    $tr,
  }), [language, $tr])

  return createElement(AnyLangContext.Provider, { value }, children)
}

export function useLanguage() {
  const context = useContext(AnyLangContext)
  if (!context) throw new Error('useLanguage must be used inside AnyLangProvider')
  return {
    language: context.language,
    languages: context.languages,
    setLanguage: context.setLanguage,
  }
}

export function useTr() {
  const context = useContext(AnyLangContext)
  if (!context) throw new Error('useTr must be used inside AnyLangProvider')
  return context.$tr
}
`;
}

function localeIdentifier(locale) {
  return `catalog_${locale.replace(/[^A-Za-z0-9_$]/g, "_")}`;
}

function toImportPath(relativePath) {
  const normalized = relativePath.split(path.sep).join("/");
  return normalized.startsWith(".") ? normalized : `./${normalized}`;
}

function languageLabel(locale) {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(locale) || locale;
  } catch {
    return locale;
  }
}

function nativeLanguageLabel(locale) {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(locale) || languageLabel(locale);
  } catch {
    return languageLabel(locale);
  }
}
