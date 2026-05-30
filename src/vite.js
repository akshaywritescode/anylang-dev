import { transformAutoJsx } from "./jsx.js";

const JSX_EXTENSIONS = /\.(jsx|tsx)$/;

export default function anylang(options = {}) {
  return {
    name: "anylang-dev",
    enforce: "pre",
    transform(code, id) {
      if (!JSX_EXTENSIONS.test(id)) return null;
      if (id.includes("node_modules")) return null;

      const result = transformAutoJsx(code, id, {
        keyPrefix: options.keyPrefix,
        runtimeImport: options.runtimeImport || "@/anylang"
      });

      if (!result.changed) return null;
      return {
        code: result.code,
        map: null
      };
    }
  };
}
