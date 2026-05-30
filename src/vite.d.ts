import type { Plugin } from "vite";

export type AnyLangViteOptions = {
  keyPrefix?: string;
  runtimeImport?: string;
};

export default function anylang(options?: AnyLangViteOptions): Plugin;
