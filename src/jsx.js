import { createHash } from "node:crypto";
import path from "node:path";
import { parse } from "@babel/parser";
import generate from "@babel/generator";
import traverseModule from "@babel/traverse";
import * as t from "@babel/types";

const traverse = traverseModule.default || traverseModule;
export function extractAutoJsxStrings(source, filePath, options = {}) {
  const ast = parseJsx(source, filePath);
  const items = [];

  traverse(ast, {
    JSXElement(pathRef) {
      if (isTranslationDisabled(pathRef.node.openingElement)) {
        pathRef.skip();
      }
    },
    JSXText(pathRef) {
      if (hasDisabledAncestor(pathRef)) return;
      const text = normalizeJsxText(pathRef.node.value);
      if (!isTranslatableText(text)) return;

      items.push(autoItem({
        text,
        filePath,
        index: pathRef.node.start || 0,
        prefix: options.keyPrefix
      }));
    }
  });

  return items;
}

export function transformAutoJsx(source, filePath, options = {}) {
  const ast = parseJsx(source, filePath);
  let changed = false;

  traverse(ast, {
    JSXElement(pathRef) {
      if (isTranslationDisabled(pathRef.node.openingElement)) {
        removeTrFalseAttribute(pathRef.node.openingElement);
        pathRef.skip();
      }
    },
    JSXText(pathRef) {
      if (hasDisabledAncestor(pathRef)) return;
      const text = normalizeJsxText(pathRef.node.value);
      if (!isTranslatableText(text)) return;

      pathRef.replaceWith(t.jsxExpressionContainer(anyLangTextElement({
        key: autoKey(text, filePath, options.keyPrefix),
        text
      })));
      changed = true;
    }
  });

  if (!changed) return { code: source, changed: false };
  ensureAnyLangTextImport(ast, options.runtimeImport || "/src/anylang.ts");

  return {
    code: generate.default(ast, { retainLines: true }, source).code,
    changed: true
  };
}

function parseJsx(source, filePath) {
  return parse(source, {
    sourceType: "module",
    sourceFilename: filePath,
    plugins: ["jsx", "typescript"]
  });
}

function autoItem({ text, filePath, index, prefix }) {
  return {
    key: autoKey(text, filePath, prefix),
    value: text,
    variables: [],
    index,
    raw: text,
    auto: true
  };
}

function autoKey(text, filePath, prefix = "auto") {
  const relative = path.relative(process.cwd(), filePath).split(path.sep).join("/");
  const fileSlug = slug(relative.replace(/\.[^.]+$/, ""));
  const textSlug = slug(text).slice(0, 36) || "text";
  const hash = createHash("sha1").update(`${relative}\0${text}`).digest("hex").slice(0, 8);
  return `${prefix}.${fileSlug}.${textSlug}_${hash}`;
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeJsxText(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ");
}

function isTranslatableText(text) {
  if (!text) return false;
  if (!/[A-Za-z0-9]/.test(text)) return false;
  return true;
}

function isTranslationDisabled(openingElement) {
  return openingElement.attributes.some((attribute) => {
    if (!t.isJSXAttribute(attribute) || !t.isJSXIdentifier(attribute.name) || attribute.name.name !== "tr") {
      return false;
    }
    if (!attribute.value) return true;
    if (t.isStringLiteral(attribute.value)) return attribute.value.value === "false";
    return (
      t.isJSXExpressionContainer(attribute.value) &&
      t.isBooleanLiteral(attribute.value.expression) &&
      attribute.value.expression.value === false
    );
  });
}

function removeTrFalseAttribute(openingElement) {
  openingElement.attributes = openingElement.attributes.filter((attribute) => {
    return !(t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name) && attribute.name.name === "tr");
  });
}

function hasDisabledAncestor(pathRef) {
  return Boolean(pathRef.findParent((parent) => {
    return parent.isJSXElement() && isTranslationDisabled(parent.node.openingElement);
  }));
}

function anyLangTextElement({ key, text }) {
  return t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier("AnyLangText"), [
      t.jsxAttribute(t.jsxIdentifier("k"), t.stringLiteral(key)),
      t.jsxAttribute(t.jsxIdentifier("source"), t.stringLiteral(text))
    ], true),
    null,
    [],
    true
  );
}

function ensureAnyLangTextImport(ast, runtimeImport) {
  const body = ast.program.body;
  const existing = body.find((node) => {
    return t.isImportDeclaration(node) && node.source.value === runtimeImport;
  });

  if (existing) {
    ensureSpecifier(existing, "AnyLangText");
    return;
  }

  body.unshift(t.importDeclaration([
    t.importSpecifier(t.identifier("AnyLangText"), t.identifier("AnyLangText"))
  ], t.stringLiteral(runtimeImport)));
}

function ensureSpecifier(importDeclaration, name) {
  const hasSpecifier = importDeclaration.specifiers.some((specifier) => {
    return t.isImportSpecifier(specifier) && specifier.imported.name === name;
  });
  if (!hasSpecifier) {
    importDeclaration.specifiers.push(t.importSpecifier(t.identifier(name), t.identifier(name)));
  }
}
