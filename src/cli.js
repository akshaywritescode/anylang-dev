import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_CONFIG, loadConfig } from "./config.js";
import { extractProjectStrings } from "./extract.js";
import { runPipeline } from "./pipeline.js";

const help = `anylang

Commands:
  init              Create anylang.config.json
  extract           Print discovered $tr(...) strings
  scan              Scan source files and prepare locale JSON files
  translate         Scan source files, translate missing entries, and update JSON files
  run               Alias for translate

Options:
  --config <path>   Config path (default: anylang.config.json)
  --dry-run         Do not call a translation provider
`;

export async function runCli(argv) {
  const { command, options } = parseArgs(argv);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(help);
    return;
  }

  if (command === "init") {
    await initConfig(options.config);
    return;
  }

  if (command === "extract") {
    const config = await loadConfig(options.config);
    const result = await extractProjectStrings(config);
    for (const item of result.items) {
      console.log(`${item.value}\t${path.relative(process.cwd(), item.file)}:${item.line}:${item.column}`);
    }
    console.log(`Found ${result.items.length} translatable string${result.items.length === 1 ? "" : "s"}.`);
    return;
  }

  if (command === "scan") {
    const config = await loadConfig(options.config);
    const summary = await runPipeline(config, { dryRun: true });
    console.log(`Scanned ${summary.sourceCount} source string${summary.sourceCount === 1 ? "" : "s"}.`);
    console.log(`Updated ${summary.localeCount} locale file${summary.localeCount === 1 ? "" : "s"} in ${summary.outDir}.`);
    console.log("No provider calls were made.");
    return;
  }

  if (command === "run" || command === "translate") {
    const config = await loadConfig(options.config);
    const summary = await runPipeline(config, { dryRun: options.dryRun });
    console.log(`Extracted ${summary.sourceCount} source string${summary.sourceCount === 1 ? "" : "s"}.`);
    console.log(`Updated ${summary.localeCount} locale file${summary.localeCount === 1 ? "" : "s"} in ${summary.outDir}.`);
    if (summary.translatedCount > 0) {
      console.log(`Translated ${summary.translatedCount} new/changed entr${summary.translatedCount === 1 ? "y" : "ies"}.`);
    }
    if (summary.skippedTranslationCount > 0) {
      console.log(`Skipped ${summary.skippedTranslationCount} entr${summary.skippedTranslationCount === 1 ? "y" : "ies"} without provider calls.`);
    }
    return;
  }

  throw new Error(`Unknown command: ${command}\n\n${help}`);
}

function parseArgs(argv) {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    return { command: argv[0], options: { config: "anylang.config.json", dryRun: false } };
  }

  const options = {
    config: "anylang.config.json",
    dryRun: false
  };
  let command;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!command && !arg.startsWith("--")) {
      command = arg;
      continue;
    }
    if (arg === "--config") {
      options.config = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return { command, options };
}

async function initConfig(configPath = "anylang.config.json") {
  const resolved = path.resolve(configPath);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, { flag: "wx" });
  console.log(`Created ${path.relative(process.cwd(), resolved)}`);
}
