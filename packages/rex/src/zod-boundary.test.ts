import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bundleBudgetEntry, entryBudgets, type EntryBudget } from "./vite/budgets.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..");
const ZOD_BOUNDARY_TIMEOUT_MS = 120_000;

const ZOD_FREE_ENTRIES: readonly EntryBudget["entry"][] = ["core"];

const ZOD_MODULE = /(^|\/)zod\/|zod\/mini/;
const ZOD_IMPORT = /^zod(\/|$)/;

function zodModules(paths: readonly string[]): readonly string[] {
  return paths.filter((path) => ZOD_MODULE.test(path.replaceAll("\\", "/")));
}

function zodImports(specifiers: readonly string[]): readonly string[] {
  return specifiers.filter((specifier) => ZOD_IMPORT.test(specifier));
}

describe("zod boundary", { timeout: ZOD_BOUNDARY_TIMEOUT_MS }, () => {
  it("recognises zod module paths and imports and nothing else", () => {
    expect(
      zodModules([
        "/repo/node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/mini/schemas.js",
        "C:\\repo\\node_modules\\zod\\v4\\core\\core.js",
        "zod/mini",
        "/repo/packages/rex/src/core/schema.ts",
        "/repo/node_modules/zodiac/index.js",
      ]),
    ).toEqual([
      "/repo/node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/mini/schemas.js",
      "C:\\repo\\node_modules\\zod\\v4\\core\\core.js",
      "zod/mini",
    ]);
    expect(zodImports(["zod", "zod/mini", "zod/v4/core", "react", "zodiac"])).toEqual([
      "zod",
      "zod/mini",
      "zod/v4/core",
    ]);
  });

  it.each(entryBudgets().filter((target) => ZOD_FREE_ENTRIES.includes(target.entry)))(
    "keeps zod and zod/mini out of the $entry entry",
    async (target) => {
      expect(target.externals).toContain("zod");
      const chunks = await bundleBudgetEntry(packageRoot, target);
      expect(chunks.length).toBeGreaterThan(0);
      const modules = chunks.flatMap((chunk) => chunk.moduleIds);
      expect(modules.some((id) => id.replaceAll("\\", "/").endsWith("/src/index.ts"))).toBe(true);
      expect(zodModules(modules)).toEqual([]);
      expect(zodImports(chunks.flatMap((chunk) => chunk.imports))).toEqual([]);
      expect(chunks.some((chunk) => /from\s*["']zod/.test(chunk.code))).toBe(false);
    },
  );
});
