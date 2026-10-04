import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..");
const repositoryRoot = join(packageRoot, "..", "..");
const PACK_TEST_TIMEOUT_MS = 300_000;

type ExportTarget = string | { readonly types?: string; readonly import?: string };

interface PackageManifest {
  readonly license: string;
  readonly sideEffects: readonly string[];
  readonly files: readonly string[];
  readonly bin: Readonly<Record<string, string>>;
  readonly exports: Readonly<Record<string, string>>;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly peerDependencies: Readonly<Record<string, string>>;
  readonly peerDependenciesMeta: Readonly<Record<string, { readonly optional?: boolean }>>;
  readonly publishConfig: {
    readonly provenance: boolean;
    readonly exports: Readonly<Record<string, ExportTarget>>;
  };
}

interface PackResult {
  readonly name: string;
  readonly files: readonly { readonly path: string }[];
}

const manifest = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8"),
) as PackageManifest;

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

  it("publishes every export with its types condition first", () => {
    const entries = Object.entries(manifest.publishConfig.exports);
    for (const subpath of ["./config", "./server/node", "./store/drizzle"]) {
      expect(Object.keys(manifest.publishConfig.exports)).toContain(subpath);
      expect(Object.keys(manifest.exports)).toContain(subpath);
    }
    expect(Object.keys(manifest.exports).sort()).toEqual(
      Object.keys(manifest.publishConfig.exports).sort(),
    );
    for (const [subpath, target] of entries) {
      if (typeof target === "string") {
        expect(files.has(relativePath(target)), subpath).toBe(true);
        continue;
      }
      expect(Object.keys(target)[0], subpath).toBe("types");
      expect(files.has(relativePath(target.types ?? "")), `${subpath} types`).toBe(true);
      expect(files.has(relativePath(target.import ?? "")), `${subpath} import`).toBe(true);
    }
    for (const bin of Object.values(manifest.bin)) {
      expect(files.has(relativePath(bin))).toBe(true);
    }
    for (const asset of ["dist/client/tokens.css", "dist/client/agent/density.css", "dist/vite/rex-app.d.ts"]) {
      expect(files.has(asset), asset).toBe(true);
    }
  });

  it("ships the build only: no sources, tests, fixtures or test helpers", () => {
    expect(files.size).toBeGreaterThan(0);
    for (const file of files) {
      expect(file === "package.json" || file.startsWith("dist/") || /^(README|LICENSE)/.test(file), file).toBe(true);
      expect(file, file).not.toMatch(/\.test\.|\/fixtures\/|\.conformance\./);
      expect(file.startsWith("src/"), file).toBe(false);
    }
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
    for (const peer of ["react", "react-dom", "@tanstack/react-query", "vite", "zod", "typescript"]) {
      expect(manifest.peerDependencies[peer], peer).toBeDefined();
      expect(manifest.peerDependenciesMeta[peer]?.optional ?? false, peer).toBe(false);
    }
    for (const peer of [
      "drizzle-orm",
      "@libsql/client",
      "@hono/node-server",
      "cmdk",
      "wouter",
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
