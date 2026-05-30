import type { NextConfig } from "next";

export type AnyLangNextOptions = {
  keyPrefix?: string;
  runtimeImport?: string;
};

export default function anylang(options?: AnyLangNextOptions): (nextConfig?: NextConfig) => NextConfig;
