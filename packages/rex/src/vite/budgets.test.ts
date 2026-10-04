import { Hono } from "hono";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { DEFAULT_BUDGETS, defineConfig, readConfigExport } from "../core/config.ts";
import { resetDeprecations } from "../core/deprecated.ts";
import { createRegistry } from "../core/registry.ts";
import {
  CLIENT_EXTERNALS,
  EDGE_BUDGET_KB,
  LAZY_CHUNK_BUDGET_KB,
  REACT_EXTERNALS,
  SCHEMA_EXTERNALS,
  chunkBudgets,
  isBudgetExternal,
  entryBudgets,
  measureBudgetChunks,
  resolveBudgets,
  withinBudget,
} from "./budgets.ts";
import { chunkTable, type OutputChunkLike } from "./split.ts";

const app = { name: "budget-app", registry: createRegistry().freeze() };

function chunk(name: string, code: string): OutputChunkLike {
  return { type: "chunk", name, fileName: `assets/${name}.js`, code, isEntry: false };
}

describe("budgets", () => {
  it("defaults to 15 KB core, 30 KB client and 50 KB per page, with 40 KB for the edge server", () => {
    expect(resolveBudgets(null)).toEqual({ core: 15, client: 30, page: 50 });
    expect(entryBudgets()).toEqual([
      {
        entry: "core",
        source: "src/index.ts",
        budget: 15,
        externals: ["react", "react-dom", "zod"],
      },
      {
        entry: "client",
        source: "src/client/index.ts",
        budget: 30,
        externals: [...CLIENT_EXTERNALS, ...SCHEMA_EXTERNALS],
      },
      {
        entry: "edge",
        source: "src/server/adapters/edge.ts",
        budget: EDGE_BUDGET_KB,
        externals: [...CLIENT_EXTERNALS, ...SCHEMA_EXTERNALS],
      },
    ]);
    expect(chunkBudgets()).toEqual({ page: DEFAULT_BUDGETS.page });
  });

  it("measures the core without React and zod and the client without its vendor peers", () => {
    expect(REACT_EXTERNALS).toEqual(["react", "react-dom"]);
    expect(SCHEMA_EXTERNALS).toEqual(["zod"]);
    expect(CLIENT_EXTERNALS).toEqual([
      "react",
      "react-dom",
      "@tanstack/react-query",
      "cmdk",
      "wouter",
      "@orpc/client",
    ]);
    const core = entryBudgets()[0]!.externals;
    for (const id of [
      "react",
      "react/jsx-runtime",
      "react-dom/client",
      "zod/mini",
      "zod/v4/core",
    ]) {
      expect(isBudgetExternal(id, core)).toBe(true);
    }
    for (const id of ["zodiac", "hono", "@orpc/client", "cmdk", "reactive"]) {
      expect(isBudgetExternal(id, core)).toBe(false);
    }
    expect(isBudgetExternal("@orpc/client/fetch", CLIENT_EXTERNALS)).toBe(true);
    expect(isBudgetExternal("@orpc/server", CLIENT_EXTERNALS)).toBe(false);
  });

  it("takes page and client budgets from rex.config", () => {
    const read = readConfigExport(defineConfig({ app, budgets: { client: 35, page: 12 } }));
    const budgets = resolveBudgets(read);
    expect(budgets).toEqual({ core: 15, client: 35, page: 12 });
    expect(chunkBudgets(budgets)).toEqual({ page: 12 });
    expect(entryBudgets(budgets).map((entry) => entry.budget)).toEqual([15, 35, EDGE_BUDGET_KB]);
  });

  it("keeps the defaults for a legacy Hono config", () => {
    resetDeprecations();
    const read = readConfigExport(new Hono(), () => undefined);
    expect(resolveBudgets(read)).toEqual(DEFAULT_BUDGETS);
  });

  it("flags page chunks over the configured page budget", () => {
    const big =
      "export const data = " +
      JSON.stringify(Array.from({ length: 4000 }, (_, i) => `${i}-${Math.sin(i)}`)) +
      ";";
    const rows = chunkTable(
      [chunk("page-home", big), chunk("index", big)],
      chunkBudgets({ ...DEFAULT_BUDGETS, page: 1 }),
    );
    expect(rows.map((row) => [row.name, row.budget, row.over])).toEqual([
      ["index", null, false],
      ["page-home", 1, true],
    ]);
    expect(withinBudget(1024, 1)).toBe(true);
    expect(withinBudget(1025, 1)).toBe(false);
  });

  it("measures the entry chunk alone and every lazy chunk on its own 10 KB budget", () => {
    const entryCode = "export const runtime = " + JSON.stringify("x".repeat(400)) + ";";
    const paletteCode = 'export const palette = "menu";';
    const devtoolsCode = 'export const devtools = "panels";';
    const measured = measureBudgetChunks([
      {
        fileName: "palette-menu-a1.js",
        isEntry: false,
        code: paletteCode,
        imports: [],
        moduleIds: [],
      },
      { fileName: "entry.js", isEntry: true, code: entryCode, imports: [], moduleIds: [] },
      {
        fileName: "devtools-b2.js",
        isEntry: false,
        code: devtoolsCode,
        imports: [],
        moduleIds: [],
      },
    ]);
    expect(LAZY_CHUNK_BUDGET_KB).toBe(10);
    expect(measured.entry).toEqual({
      fileName: "entry.js",
      raw: Buffer.byteLength(entryCode),
      gzip: gzipSync(entryCode).byteLength,
    });
    expect(measured.lazy).toEqual([
      {
        fileName: "devtools-b2.js",
        raw: Buffer.byteLength(devtoolsCode),
        gzip: gzipSync(devtoolsCode).byteLength,
      },
      {
        fileName: "palette-menu-a1.js",
        raw: Buffer.byteLength(paletteCode),
        gzip: gzipSync(paletteCode).byteLength,
      },
    ]);
    expect(() => measureBudgetChunks([])).toThrow(/expected one entry chunk, found 0/);
  });

  it("counts chunks the entry imports statically as first-paint code and the rest as lazy", () => {
    const entryCode = 'import "./shared-c3.js"; export const runtime = "core";';
    const sharedCode = "export const shared = " + JSON.stringify("y".repeat(200)) + ";";
    const confirmCode = 'import "./shared-c3.js"; export const dialog = "confirm";';
    const measured = measureBudgetChunks([
      {
        fileName: "entry.js",
        isEntry: true,
        code: entryCode,
        imports: ["shared-c3.js", "confirm-dialog-d4.js"],
        staticImports: ["shared-c3.js"],
        moduleIds: [],
      },
      {
        fileName: "shared-c3.js",
        isEntry: false,
        code: sharedCode,
        imports: [],
        staticImports: [],
        moduleIds: [],
      },
      {
        fileName: "confirm-dialog-d4.js",
        isEntry: false,
        code: confirmCode,
        imports: ["shared-c3.js"],
        staticImports: ["shared-c3.js"],
        moduleIds: [],
      },
    ]);
    expect(measured.entry).toEqual({
      fileName: "entry.js",
      raw: Buffer.byteLength(entryCode) + Buffer.byteLength(sharedCode),
      gzip: gzipSync(entryCode).byteLength + gzipSync(sharedCode).byteLength,
    });
    expect(measured.firstPaint.map((chunk) => chunk.fileName)).toEqual(["entry.js", "shared-c3.js"]);
    expect(measured.lazy).toEqual([
      {
        fileName: "confirm-dialog-d4.js",
        raw: Buffer.byteLength(confirmCode),
        gzip: gzipSync(confirmCode).byteLength,
      },
    ]);
  });
});
