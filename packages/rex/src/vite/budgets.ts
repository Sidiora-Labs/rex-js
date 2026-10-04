import {
  DEFAULT_BUDGETS,
  DEFAULT_OPTIONS,
  type RexConfigExport,
  type ResolvedBudgets,
} from "../core/config.ts";
import type { ChunkBudgets } from "./split.ts";

export const EDGE_BUDGET_KB = 40;

export interface EntryBudget {
  readonly entry: "core" | "client" | "edge";
  readonly source: string;
  readonly budget: number;
}

export function resolveBudgets(read: RexConfigExport | null): ResolvedBudgets {
  return read === null ? DEFAULT_OPTIONS.budgets : read.options.budgets;
}

export function chunkBudgets(budgets: ResolvedBudgets = DEFAULT_BUDGETS): ChunkBudgets {
  return { page: budgets.page };
}

export function entryBudgets(budgets: ResolvedBudgets = DEFAULT_BUDGETS): readonly EntryBudget[] {
  return [
    { entry: "core", source: "src/index.ts", budget: budgets.core },
    { entry: "client", source: "src/client/index.ts", budget: budgets.client },
    { entry: "edge", source: "src/server/index.ts", budget: EDGE_BUDGET_KB },
  ];
}

export function withinBudget(gzipBytes: number, budgetKb: number): boolean {
  return gzipBytes <= budgetKb * 1024;
}
