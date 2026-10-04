import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { DEFAULT_BUDGETS, defineConfig, readConfigExport } from "../core/config.ts";
import { resetDeprecations } from "../core/deprecated.ts";
import { createRegistry } from "../core/registry.ts";
import {
  EDGE_BUDGET_KB,
  chunkBudgets,
  entryBudgets,
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
      { entry: "core", source: "src/index.ts", budget: 15 },
      { entry: "client", source: "src/client/index.ts", budget: 30 },
      { entry: "edge", source: "src/server/index.ts", budget: EDGE_BUDGET_KB },
    ]);
    expect(chunkBudgets()).toEqual({ page: DEFAULT_BUDGETS.page });
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
    const big = "export const data = " + JSON.stringify(Array.from({ length: 4000 }, (_, i) => `${i}-${Math.sin(i)}`)) + ";";
    const rows = chunkTable([chunk("page-home", big), chunk("index", big)], chunkBudgets({ ...DEFAULT_BUDGETS, page: 1 }));
    expect(rows.map((row) => [row.name, row.budget, row.over])).toEqual([
      ["index", null, false],
      ["page-home", 1, true],
    ]);
    expect(withinBudget(1024, 1)).toBe(true);
    expect(withinBudget(1025, 1)).toBe(false);
  });
});
