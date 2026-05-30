import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".vue", ".html", ".svelte", ".astro"]);

export async function extractProjectStrings(config) {
  const files = await listCandidateFiles(process.cwd(), config);
  const items = [];
  const seen = new Set();

  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const match of extractFromSource(source, config.functionName)) {
      const key = `${match.value}\0${file}\0${match.index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        ...match,
        file,
        ...lineColumnForIndex(source, match.index)
      });
    }
  }

  return { files, items };
}

export function extractFromSource(source, functionName = "$tr") {
  const matches = [];
  let index = 0;
  let state = "code";
  let quote = "";

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (state === "lineComment") {
      if (char === "\n") state = "code";
      index += 1;
      continue;
    }
    if (state === "blockComment") {
      if (char === "*" && next === "/") {
        index += 2;
        state = "code";
      } else {
        index += 1;
      }
      continue;
    }
    if (state === "string") {
      if (char === "\\") {
        index += 2;
      } else if (char === quote) {
        index += 1;
        state = "code";
      } else {
        index += 1;
      }
      continue;
    }
    if (state === "template") {
      if (char === "\\") {
        index += 2;
      } else if (char === "`") {
        index += 1;
        state = "code";
      } else {
        index += 1;
      }
      continue;
    }

    if (char === "/" && next === "/") {
      state = "lineComment";
      index += 2;
      continue;
    }
    if (char === "/" && next === "*") {
      state = "blockComment";
      index += 2;
      continue;
    }
    if (char === "'" || char === "\"") {
      quote = char;
      state = "string";
      index += 1;
      continue;
    }
    if (char === "`") {
      state = "template";
      index += 1;
      continue;
    }

    if (source.startsWith(functionName, index) && hasIdentifierBoundary(source, index, functionName)) {
      const call = parseTranslationCall(source, index + functionName.length);
      if (call) {
        matches.push({ key: call.key, value: call.value, variables: call.variables, index, raw: source.slice(index, call.endIndex) });
        index = call.endIndex;
        continue;
      }
    }

    index += 1;
  }

  return matches;
}

async function listCandidateFiles(root, config) {
  const allFiles = [];
  const excluded = new Set(config.exclude || []);
  const allowedExtensions = extensionsFromInclude(config.include);
  const roots = includeRoots(root, config.include);

  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      if (error && error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (excluded.has(entry.name) || hasExcludedSegment(path.join(dir, entry.name), excluded)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && allowedExtensions.has(path.extname(entry.name))) {
        allFiles.push(fullPath);
      }
    }
  }

  for (const includeRoot of roots) {
    await walk(includeRoot);
  }
  return allFiles.sort();
}

function includeRoots(root, include) {
  const roots = new Set();
  for (const pattern of include) {
    const firstGlobIndex = pattern.search(/[*{?]/);
    const staticPart = firstGlobIndex === -1 ? pattern : pattern.slice(0, firstGlobIndex);
    const normalized = staticPart.replace(/[/\\][^/\\]*$/, "");
    roots.add(path.resolve(root, normalized || "."));
  }
  return roots.size > 0 ? Array.from(roots) : [root];
}

function hasExcludedSegment(filePath, excluded) {
  return filePath.split(path.sep).some((segment) => excluded.has(segment));
}

function extensionsFromInclude(include) {
  const extensions = new Set();
  for (const pattern of include) {
    const braceMatch = pattern.match(/\.\{([^}]+)\}/);
    if (braceMatch) {
      for (const ext of braceMatch[1].split(",")) extensions.add(`.${ext.trim()}`);
      continue;
    }
    const ext = path.extname(pattern.replace(/\*/g, "x"));
    if (ext) extensions.add(ext);
  }
  return extensions.size > 0 ? extensions : DEFAULT_EXTENSIONS;
}

function hasIdentifierBoundary(source, start, functionName) {
  const before = source[start - 1];
  const after = source[start + functionName.length];
  return !isIdentifierChar(before) && !isIdentifierChar(after);
}

function isIdentifierChar(char) {
  return Boolean(char && /[A-Za-z0-9_$]/.test(char));
}

function parseTranslationCall(source, offset) {
  let index = skipWhitespace(source, offset);
  if (source[index] !== "(") return null;
  index = skipWhitespace(source, index + 1);
  const keyLiteral = parseLiteral(source, index);
  if (!keyLiteral) return null;
  index = skipWhitespace(source, keyLiteral.endIndex);

  let text = keyLiteral.value;
  if (source[index] === ",") {
    const secondArgIndex = skipWhitespace(source, index + 1);
    const textLiteral = parseLiteral(source, secondArgIndex);
    if (textLiteral) {
      text = textLiteral.value;
      index = skipWhitespace(source, textLiteral.endIndex);
    }
  }

  const endIndex = findCallEnd(source, index);
  if (endIndex === -1) return null;
  return {
    key: keyLiteral.value,
    value: text,
    variables: extractVariables(text),
    endIndex: endIndex + 1
  };
}

function findCallEnd(source, index) {
  let cursor = index;
  let depth = 0;
  let state = "code";
  let quote = "";

  while (cursor < source.length) {
    const char = source[cursor];
    const next = source[cursor + 1];

    if (state === "lineComment") {
      if (char === "\n") state = "code";
      cursor += 1;
      continue;
    }
    if (state === "blockComment") {
      if (char === "*" && next === "/") {
        cursor += 2;
        state = "code";
      } else {
        cursor += 1;
      }
      continue;
    }
    if (state === "string" || state === "template") {
      if (char === "\\") {
        cursor += 2;
      } else if (char === quote) {
        cursor += 1;
        state = "code";
      } else {
        cursor += 1;
      }
      continue;
    }

    if (char === "/" && next === "/") {
      state = "lineComment";
      cursor += 2;
      continue;
    }
    if (char === "/" && next === "*") {
      state = "blockComment";
      cursor += 2;
      continue;
    }
    if (char === "'" || char === "\"" || char === "`") {
      quote = char;
      state = char === "`" ? "template" : "string";
      cursor += 1;
      continue;
    }
    if (char === "(" || char === "[" || char === "{") {
      depth += 1;
      cursor += 1;
      continue;
    }
    if (char === ")" && depth === 0) return cursor;
    if (char === ")" || char === "]" || char === "}") {
      depth -= 1;
      cursor += 1;
      continue;
    }

    cursor += 1;
  }

  return -1;
}

function parseLiteral(source, index) {
  const quote = source[index];
  if (quote !== "'" && quote !== "\"" && quote !== "`") return null;

  let cursor = index + 1;
  let value = "";
  while (cursor < source.length) {
    const char = source[cursor];
    if (char === "\\") {
      const escape = source[cursor + 1];
      value += decodeEscape(escape);
      cursor += 2;
      continue;
    }
    if (quote === "`" && char === "$" && source[cursor + 1] === "{") {
      return null;
    }
    if (char === quote) {
      return { value, endIndex: cursor + 1 };
    }
    value += char;
    cursor += 1;
  }
  return null;
}

function decodeEscape(char) {
  switch (char) {
    case "n":
      return "\n";
    case "r":
      return "\r";
    case "t":
      return "\t";
    case "\\":
      return "\\";
    case "\"":
      return "\"";
    case "'":
      return "'";
    case "`":
      return "`";
    default:
      return char || "";
  }
}

function skipWhitespace(source, index) {
  let cursor = index;
  while (/\s/.test(source[cursor] || "")) cursor += 1;
  return cursor;
}

function lineColumnForIndex(source, index) {
  const before = source.slice(0, index);
  const lines = before.split("\n");
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

function extractVariables(text) {
  const variables = new Set();
  for (const match of text.matchAll(/\{([A-Za-z_$][A-Za-z0-9_$]*)\}/g)) {
    variables.add(match[1]);
  }
  return Array.from(variables).sort();
}
