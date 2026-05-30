import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default function anylang(options = {}) {
  return function withAnyLang(nextConfig = {}) {
    return {
      ...nextConfig,
      webpack(config, context) {
        if (typeof nextConfig.webpack === "function") {
          config = nextConfig.webpack(config, context);
        }

        config.module.rules.unshift({
          test: /\.[jt]sx$/,
          exclude: /node_modules/,
          enforce: "pre",
          use: {
            loader: path.join(dirname, "next-loader.cjs"),
            options: {
              keyPrefix: options.keyPrefix,
              runtimeImport: options.runtimeImport || "@/anylang"
            }
          }
        });

        return config;
      }
    };
  };
}
