import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { getFileInfo, resolveConfig, resolveConfigFile } from "prettier";
import { describe, expect, it } from "vitest";
import { lintRules } from "./eslint/index.ts";
import { rexPrettierConfig } from "./prettier.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const INDEX = path.join(root, "packages/rex/src/index.ts");
const DEMO_VIEW = path.join(root, "examples/demo/app/pages/portfolio/view.tsx");
const LOAD_TIMEOUT = 60_000;

const eslint = new ESLint({ cwd: root });

describe("root eslint.config.js", () => {
  it(
    "is the config ESLint finds from the repository root",
    async () => {
      expect(await eslint.findConfigFile()).toBe(path.join(root, "eslint.config.js"));
    },
    LOAD_TIMEOUT,
  );

  it(
    "applies the rex preset to the demo app and typescript-eslint to the package, the demo e2e and the tools",
    async () => {
      const view = await eslint.calculateConfigForFile(DEMO_VIEW);
      expect(Object.keys(view.plugins)).toEqual(["@", "rex", "jsx-a11y"]);
      for (const rule of lintRules()) expect(view.rules[`rex/${rule.id}`]).toEqual([2]);
      expect(view.rules["jsx-a11y/alt-text"]).toEqual([2]);
      expect(view.languageOptions.parser.meta.name).toBe("typescript-eslint/parser");
      expect(view.languageOptions.parserOptions).toEqual({ ecmaFeatures: { jsx: true } });
      for (const file of [
        INDEX,
        path.join(root, "examples/demo/e2e/walk.ts"),
        path.join(root, "tools/freshness.mjs"),
      ]) {
        const config = await eslint.calculateConfigForFile(file);
        expect(Object.keys(config.plugins)).toEqual(["@", "@typescript-eslint"]);
        expect(config.rules["@typescript-eslint/no-unused-vars"]).toEqual([
          2,
          expect.objectContaining({ varsIgnorePattern: "^_", argsIgnorePattern: "^_" }),
        ]);
        expect(config.rules["rex/page-folder"]).toBeUndefined();
        expect(config.rules["jsx-a11y/alt-text"]).toBeUndefined();
      }
    },
    LOAD_TIMEOUT,
  );

  it(
    "reports zero errors on packages/rex/src/index.ts",
    async () => {
      const results = await eslint.lintFiles(["packages/rex/src/index.ts"]);
      expect(results.map((result) => result.filePath)).toEqual([INDEX]);
      const [result] = results;
      expect(result?.fatalErrorCount).toBe(0);
      expect(result?.errorCount).toBe(0);
      expect(result?.messages).toEqual([]);
    },
    LOAD_TIMEOUT,
  );

  it(
    "ignores built, vendored, fixture and generated paths",
    async () => {
      const ignored = [
        "packages/rex/dist/eslint/index.js",
        "packages/rex/node_modules/eslint/lib/api.js",
        "coverage/lcov-report/block-navigation.js",
        "packages/rex/src/eslint/fixtures/lint/app/pages/profile/page.ts",
        "examples/demo/.rex/manifest.ts",
        "examples/demo/e2e/report/index.js",
        "examples/demo/test-results/report.js",
        "examples/demo/playwright-report/index.js",
        ".codegraph/worktrees/lab/packages/rex/src/index.ts",
      ];
      for (const file of ignored) {
        expect(await eslint.isPathIgnored(path.join(root, file)), file).toBe(true);
      }
      const linted = [INDEX, DEMO_VIEW, path.join(root, "examples/demo/server.ts")];
      for (const file of linted) expect(await eslint.isPathIgnored(file), file).toBe(false);
    },
    LOAD_TIMEOUT,
  );
});

describe("root .prettierrc and .prettierignore", () => {
  it("resolves to the rex preset for files under packages/rex and the tools", async () => {
    const configFile = path.join(root, ".prettierrc");
    const shared = JSON.parse(readFileSync(configFile, "utf8")) as unknown;
    expect(typeof shared).toBe("string");
    for (const file of [INDEX, path.join(root, "tools/freshness.mjs")]) {
      expect(await resolveConfigFile(file)).toBe(configFile);
      expect(await resolveConfig(file)).toEqual(rexPrettierConfig);
    }
  });

  it("ignores the generated and vendored paths plus the lockfile and the API docs", async () => {
    const ignorePath = path.join(root, ".prettierignore");
    const ignored = [
      "pnpm-lock.yaml",
      "docs/api/README.md",
      "packages/rex/dist/index.js",
      "packages/rex/node_modules/prettier/index.mjs",
      "coverage/lcov-report/index.html",
      "packages/rex/src/eslint/fixtures/lint/app/pages/profile/page.ts",
      "examples/demo/.rex/manifest.json",
      "examples/demo/AGENTS.md",
      "AGENTS.md",
      "CLAUDE.md",
      "examples/demo/e2e/report/index.html",
      "examples/demo/test-results/results.json",
      "examples/demo/playwright-report/index.html",
      ".codegraph/worktrees/lab/README.md",
    ];
    for (const file of ignored) {
      const info = await getFileInfo(path.join(root, file), { ignorePath });
      expect(info.ignored, file).toBe(true);
    }
    const formatted = [
      "packages/rex/src/index.ts",
      "examples/demo/server.ts",
      "tools/freshness.mjs",
      "README.md",
      "docs/cli.md",
    ];
    for (const file of formatted) {
      const info = await getFileInfo(path.join(root, file), { ignorePath });
      expect(info.ignored, file).toBe(false);
    }
  });
});
