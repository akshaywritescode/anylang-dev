import test from "node:test";
import assert from "node:assert/strict";
import anylang from "../src/next.js";

test("next plugin injects anylang loader", () => {
  const withAnyLang = anylang({ runtimeImport: "@/anylang" });
  const config = withAnyLang({});
  const webpackConfig = config.webpack({ module: { rules: [] } }, {});

  assert.equal(webpackConfig.module.rules.length, 1);
  assert.equal(webpackConfig.module.rules[0].enforce, "pre");
  assert.match(webpackConfig.module.rules[0].use.loader, /next-loader\.cjs$/);
  assert.equal(webpackConfig.module.rules[0].use.options.runtimeImport, "@/anylang");
});

test("next plugin preserves user webpack config", () => {
  const withAnyLang = anylang();
  const config = withAnyLang({
    webpack(existing) {
      existing.userTouched = true;
      return existing;
    }
  });
  const webpackConfig = config.webpack({ module: { rules: [] } }, {});

  assert.equal(webpackConfig.userTouched, true);
  assert.equal(webpackConfig.module.rules.length, 1);
});
