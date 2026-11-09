import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { build, type Plugin } from "vite";
import { describe, expect, it } from "vitest";
import { loadAppBundle, withModuleLoader } from "../../cli/load.ts";
import { rex } from "../../vite/plugin.ts";
import { copyFixture, fixtureSource, withFixture } from "./fixture.ts";

const here = dirname(fileURLToPath(import.meta.url));
const sourceRoot = join(here, "..", "..");
const packageModules = join(sourceRoot, "..", "node_modules");
const coreEntry = join(sourceRoot, "index.ts");
const schemaEntry = join(sourceRoot, "schema", "index.ts");
const APP_FIXTURE = "vite/fixtures/app";
const ROUND_TRIP_TIMEOUT_MS = 120_000;

const aliasPlugin: Plugin = {
  name: "fixture-test-alias",
  config: () => ({
    resolve: {
      alias: [
        { find: /^@sidioralabs\/rex$/, replacement: coreEntry },
        { find: /^@sidioralabs\/rex\/schema$/, replacement: schemaEntry },
      ],
    },
  }),
};

function sourceTreeStatus(): string {
  return execFileSync(
    "git",
    ["status", "--porcelain", "--ignored", "--untracked-files=all", "--", "."],
    { cwd: sourceRoot, encoding: "utf8" },
  );
}

function filesUnder(dir: string, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) found.push(...filesUnder(dir, path));
    else if (entry.isFile()) found.push(path);
  }
  return found.sort();
}

describe("copyFixture and withFixture", () => {
  it("copies a named fixture to a fresh temporary directory outside src with the package modules linked", () => {
    const first = copyFixture(APP_FIXTURE);
    const second = copyFixture(APP_FIXTURE);
    try {
      expect(first.dir).not.toBe(second.dir);
      expect(first.dir.startsWith(realpathSync(tmpdir()))).toBe(true);
      expect(relative(sourceRoot, first.dir).startsWith("..")).toBe(true);
      expect(filesUnder(first.dir)).toEqual(filesUnder(fixtureSource(APP_FIXTURE)));
      const react = join(first.dir, "node_modules", "react");
      expect(lstatSync(react).isSymbolicLink()).toBe(true);
      expect(realpathSync(react)).toBe(realpathSync(join(packageModules, "react")));
      expect(realpathSync(join(first.dir, "node_modules", "@sidioralabs", "rex"))).toBe(
        realpathSync(join(sourceRoot, "..")),
      );
      expect(lstatSync(join(first.dir, "node_modules")).isSymbolicLink()).toBe(false);
      writeFileSync(join(first.dir, "index.html"), "<!doctype html>\n");
      expect(readFileSync(join(fixtureSource(APP_FIXTURE), "index.html"), "utf8")).not.toBe(
        "<!doctype html>\n",
      );
    } finally {
      first.remove();
      second.remove();
    }
    expect(existsSync(first.dir)).toBe(false);
    expect(existsSync(second.dir)).toBe(false);
  });

  it("names the missing fixture when none exists under src", () => {
    expect(() => copyFixture("vite/fixtures/missing")).toThrow(
      "No fixture named vite/fixtures/missing under src",
    );
  });

  it("removes the copy after the run, also when the run fails", async () => {
    let copied = "";
    await expect(
      withFixture(APP_FIXTURE, async (dir) => {
        copied = dir;
        expect(existsSync(join(dir, "app"))).toBe(true);
        throw new Error("the run failed");
      }),
    ).rejects.toThrow("the run failed");
    expect(copied).not.toBe("");
    expect(existsSync(copied)).toBe(false);
  });

  it(
    "leaves git status of src unchanged after a build and a module loader round trip",
    async () => {
      const before = sourceTreeStatus();
      let copied = "";
      await withFixture(APP_FIXTURE, async (dir) => {
        copied = dir;
        await build({
          root: dir,
          configFile: false,
          logLevel: "silent",
          plugins: [aliasPlugin, ...rex({ name: "fixture", compiler: false })],
          build: {
            outDir: join(dir, "dist"),
            emptyOutDir: true,
            manifest: true,
            rolldownOptions: { external: [/^react(\/.*)?$/, /^react-dom(\/.*)?$/] },
          },
        });
        expect(existsSync(join(dir, "dist", "index.html"))).toBe(true);
        const name = await withModuleLoader(
          dir,
          async (loader) => (await loadAppBundle(loader)).name,
          { plugins: [aliasPlugin], rex: { name: "fixture", compiler: false } },
        );
        expect(name).toBe("fixture");
        expect(existsSync(join(dir, "node_modules", ".cache", "rex", "loader"))).toBe(true);
      });
      expect(existsSync(copied)).toBe(false);
      const after = sourceTreeStatus();
      expect(after).toBe(before);
      expect(after.split("\n").filter((line) => line.includes("node_modules"))).toEqual([]);
    },
    ROUND_TRIP_TIMEOUT_MS,
  );
});
