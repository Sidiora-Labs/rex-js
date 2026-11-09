import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { REX_VERSION } from "../index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");
const repositoryRoot = join(packageRoot, "..", "..");
const PACK_TEST_TIMEOUT_MS = 300_000;

type ExportTarget =
  string | { readonly "rex-source"?: string; readonly types?: string; readonly default?: string };

interface PackageManifest {
  readonly version: string;
  readonly license: string;
  readonly sideEffects: readonly string[];
  readonly files: readonly string[];
  readonly bin: Readonly<Record<string, string>>;
  readonly exports: Readonly<Record<string, ExportTarget>>;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly peerDependencies: Readonly<Record<string, string>>;
  readonly peerDependenciesMeta: Readonly<Record<string, { readonly optional?: boolean }>>;
  readonly publishConfig: { readonly provenance: boolean };
}

interface PackResult {
  readonly name: string;
  readonly files: readonly { readonly path: string }[];
}

const manifest = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8"),
) as PackageManifest;

const REQUIRED_SUBPATHS = [
  "./config",
  "./testing",
  "./server/node",
  "./server/bun",
  "./server/deno",
  "./server/edge",
  "./store/drizzle",
  "./devtools",
  "./eslint",
];

function relativePath(target: string): string {
  return target.replace(/^\.\//, "");
}

describe("the packed @sidioralabs/rex tarball", { timeout: PACK_TEST_TIMEOUT_MS }, () => {
  let files: Set<string>;

  beforeAll(() => {
    execFileSync("pnpm", ["run", "build"], { cwd: packageRoot, stdio: "pipe" });
    const output = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
      cwd: packageRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const [packed] = JSON.parse(output) as PackResult[];
    expect(packed?.name).toBe("@sidioralabs/rex");
    files = new Set((packed?.files ?? []).map((file) => file.path));
  }, PACK_TEST_TIMEOUT_MS);

  it("resolves every export to dist with types before default and source only under rex-source", () => {
    expect(manifest.publishConfig).not.toHaveProperty("exports");
    for (const subpath of REQUIRED_SUBPATHS) {
      expect(Object.keys(manifest.exports)).toContain(subpath);
    }
    for (const [subpath, target] of Object.entries(manifest.exports)) {
      if (typeof target === "string") {
        expect(files.has(relativePath(target)), subpath).toBe(true);
        continue;
      }
      expect(Object.keys(target), subpath).toEqual(["rex-source", "types", "default"]);
      expect(target["rex-source"], subpath).toMatch(/^\.\/src\/.+\.ts$/);
      expect(existsSync(join(packageRoot, target["rex-source"] ?? "")), subpath).toBe(true);
      expect(files.has(relativePath(target.types ?? "")), `${subpath} types`).toBe(true);
      expect(files.has(relativePath(target.default ?? "")), `${subpath} default`).toBe(true);
    }
    for (const bin of Object.values(manifest.bin)) {
      expect(files.has(relativePath(bin))).toBe(true);
    }
    for (const asset of [
      "dist/client/tokens.css",
      "dist/client/agent/density.css",
      "dist/vite/rex-app.d.ts",
    ]) {
      expect(files.has(asset), asset).toBe(true);
    }
  });

  it("ships the build only: no sources, tests, fixtures or test helpers", () => {
    expect(files.size).toBeGreaterThan(0);
    for (const file of files) {
      expect(
        file === "package.json" || file.startsWith("dist/") || /^(README|LICENSE)/.test(file),
        file,
      ).toBe(true);
      expect(file, file).not.toMatch(/\.test\.|\/fixtures\/|\.conformance\./);
      expect(file.startsWith("src/"), file).toBe(false);
    }
  });

  it("releases a semantic version that REX_VERSION in the core entry reports", () => {
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
    expect(REX_VERSION).toBe(manifest.version);
  });

  it("declares MIT, CSS-only side effects, provenance and honest dependencies", () => {
    expect(manifest.license).toBe("MIT");
    expect(existsSync(join(repositoryRoot, "LICENSE"))).toBe(true);
    expect(readFileSync(join(repositoryRoot, "LICENSE"), "utf8")).toContain("MIT License");
    expect(manifest.sideEffects).toEqual(["**/*.css"]);
    expect(manifest.files[0]).toBe("dist");
    expect(manifest.publishConfig.provenance).toBe(true);
    expect(Object.keys(manifest.dependencies).sort()).toEqual([
      "@orpc/client",
      "@orpc/server",
      "@orpc/tanstack-query",
      "hono",
    ]);
    for (const peer of [
      "react",
      "react-dom",
      "@tanstack/react-query",
      "zod",
      "wouter",
      "cmdk",
      "@hono/node-server",
    ]) {
      expect(manifest.peerDependencies[peer], peer).toBeDefined();
      expect(manifest.peerDependenciesMeta[peer]?.optional ?? false, peer).toBe(false);
    }
    for (const peer of [
      "vite",
      "typescript",
      "drizzle-orm",
      "@libsql/client",
      "@opentelemetry/api",
      "@vitejs/plugin-react",
      "babel-plugin-react-compiler",
      "@tailwindcss/vite",
    ]) {
      expect(manifest.peerDependencies[peer], peer).toBeDefined();
      expect(manifest.peerDependenciesMeta[peer]?.optional, peer).toBe(true);
    }
  });
});
