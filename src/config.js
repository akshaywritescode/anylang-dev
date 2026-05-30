import { readFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CONFIG = {
  sourceLocale: "en",
  targetLocales: ["hi"],
  include: ["src/**/*.{js,jsx,ts,tsx,vue,html}"],
  exclude: ["node_modules", ".git", "dist", "build", ".next"],
  outDir: "locales",
  runtime: {
    output: "src/anylang.ts",
    importFrom: "anylang-dev/runtime"
  },
  functionName: "$tr",
  provider: {
    name: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash"
  }
};

export async function loadConfig(configPath = "anylang.config.json") {
  const resolved = path.resolve(configPath);
  let raw;
  try {
    raw = await readFile(resolved, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new Error(`Missing config file: ${configPath}. Run "anylang init" first.`);
    }
    throw error;
  }

  const parsed = JSON.parse(raw);
  const config = {
    ...DEFAULT_CONFIG,
    ...parsed,
    provider: {
      ...DEFAULT_CONFIG.provider,
      ...(parsed.provider || {})
    }
  };

  if (!config.sourceLocale) throw new Error("Config must include sourceLocale.");
  if (!Array.isArray(config.targetLocales)) throw new Error("Config targetLocales must be an array.");
  if (!Array.isArray(config.include)) throw new Error("Config include must be an array.");
  if (!config.outDir) throw new Error("Config must include outDir.");
  if (!config.functionName) throw new Error("Config must include functionName.");

  return config;
}
