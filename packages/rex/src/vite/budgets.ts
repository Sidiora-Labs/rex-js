import {
  DEFAULT_BUDGETS,
  DEFAULT_OPTIONS,
  type RexConfigExport,
  type ResolvedBudgets,
} from "../core/config.ts";
import type { ChunkBudgets } from "./split.ts";

export const EDGE_BUDGET_KB = 40;

export const REACT_EXTERNALS = ["react", "react-dom"] as const;

export const CLIENT_EXTERNALS = [
  ...REACT_EXTERNALS,
  "@tanstack/react-query",
  "cmdk",
  "wouter",
  "@orpc/client",
] as const;

export interface EntryBudget {
  readonly entry: "core" | "client" | "edge";
  readonly source: string;
  readonly budget: number;
  readonly externals: readonly string[];
}

export function isBudgetExternal(id: string, externals: readonly string[]): boolean {
  return externals.some((name) => id === name || id.startsWith(`${name}/`));
}

export function resolveBudgets(read: RexConfigExport | null): ResolvedBudgets {
  return read === null ? DEFAULT_OPTIONS.budgets : read.options.budgets;
}

export function chunkBudgets(budgets: ResolvedBudgets = DEFAULT_BUDGETS): ChunkBudgets {
  return { page: budgets.page };
}

export function entryBudgets(budgets: ResolvedBudgets = DEFAULT_BUDGETS): readonly EntryBudget[] {
  return [
    { entry: "core", source: "src/index.ts", budget: budgets.core, externals: REACT_EXTERNALS },
    {
      entry: "client",
      source: "src/client/index.ts",
      budget: budgets.client,
      externals: CLIENT_EXTERNALS,
    },
    {
      entry: "edge",
      source: "src/server/adapters/edge.ts",
      budget: EDGE_BUDGET_KB,
      externals: CLIENT_EXTERNALS,
    },
  ];
}

export function withinBudget(gzipBytes: number, budgetKb: number): boolean {
  return gzipBytes <= budgetKb * 1024;
}
