import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { baseAppPlan } from "./cli/commands/new.ts";
import { REX_VERSION as CORE_VERSION } from "./index.ts";
import { REX_VERSION } from "./version.ts";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
  readonly name: string;
  readonly version: string;
};

function parts(version: string): readonly [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (match === null) throw new Error(`${version} is not a plain release version`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compare(left: readonly number[], right: readonly number[]): number {
  for (let index = 0; index < 3; index += 1) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function admits(range: string, version: string): boolean {
  if (!range.startsWith("^")) return range === version;
  const floor = parts(range.slice(1));
  const candidate = parts(version);
  const pivot = floor.findIndex((part, index) => part !== 0 || index === 2);
  const ceiling = floor.map((part, index) =>
    index < pivot ? part : index === pivot ? part + 1 : 0,
  );
  return compare(candidate, floor) >= 0 && compare(candidate, ceiling) < 0;
}

describe("REX_VERSION", () => {
  it("equals the version of the package manifest", () => {
    expect(REX_VERSION).toBe(manifest.version);
    expect(CORE_VERSION).toBe(REX_VERSION);
  });

  it("is the file the build step writes from the manifest", () => {
    const result = spawnSync(
      process.execPath,
      [join(packageRoot, "scripts", "write-version.mjs"), "--check"],
      { cwd: packageRoot, encoding: "utf8" },
    );
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("is admitted by the range a scaffolded app depends on", () => {
    const entry = baseAppPlan("version-app").find(
      (planned) => planned.kind === "file" && planned.path === "package.json",
    );
    if (entry?.kind !== "file") throw new Error("rex new plans no package.json");
    const scaffold = JSON.parse(entry.content) as {
      readonly dependencies: Readonly<Record<string, string>>;
    };
    const range = scaffold.dependencies[manifest.name];
    if (range === undefined) throw new Error(`rex new does not depend on ${manifest.name}`);
    expect(admits(range, manifest.version)).toBe(true);
    expect(admits(range, REX_VERSION)).toBe(true);
  });

  it("checks ranges the way the registry resolves them", () => {
    expect(admits("^0.3.0", "0.3.4")).toBe(true);
    expect(admits("^0.2.0", "0.3.0")).toBe(false);
    expect(admits("^1.2.0", "1.9.0")).toBe(true);
    expect(admits("^1.2.0", "2.0.0")).toBe(false);
    expect(admits("^0.0.3", "0.0.4")).toBe(false);
    expect(admits("0.3.0", "0.3.0")).toBe(true);
  });
});
