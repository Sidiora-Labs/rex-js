import {
  DEFAULT_BUDGETS,
  DEFAULT_OPTIONS,
  type RexConfigExport,
  type ResolvedBudgets,
} from "../core/config.ts";
import { join } from "node:path";
import { build } from "vite";
import type { ChunkBudgets } from "./split.ts";

export const EDGE_BUDGET_KB = 40;

export const REACT_EXTERNALS = ["react", "react-dom"] as const;

export const SCHEMA_EXTERNALS = ["zod"] as const;

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
    {
      entry: "core",
      source: "src/index.ts",
      budget: budgets.core,
      externals: [...REACT_EXTERNALS, ...SCHEMA_EXTERNALS],
    },
    {
      entry: "client",
      source: "src/client/index.ts",
      budget: budgets.client,
      externals: [...CLIENT_EXTERNALS, ...SCHEMA_EXTERNALS],
    },
    {
      entry: "edge",
      source: "src/server/adapters/edge.ts",
      budget: EDGE_BUDGET_KB,
      externals: [...CLIENT_EXTERNALS, ...SCHEMA_EXTERNALS],
    },
  ];
}

export function withinBudget(gzipBytes: number, budgetKb: number): boolean {
  return gzipBytes <= budgetKb * 1024;
}

export const BUDGET_BUILD_MODE = "production";

export interface BundledChunk {
  readonly code: string;
  readonly imports: readonly string[];
  readonly moduleIds: readonly string[];
}

export async function bundleBudgetEntry(
  packageRoot: string,
  target: EntryBudget,
): Promise<readonly BundledChunk[]> {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = BUDGET_BUILD_MODE;
  try {
    const result = await build({
      root: packageRoot,
      configFile: false,
      logLevel: "silent",
      mode: BUDGET_BUILD_MODE,
      define: { "process.env.NODE_ENV": JSON.stringify(BUDGET_BUILD_MODE) },
      build: {
        write: false,
        minify: true,
        lib: { entry: join(packageRoot, target.source), formats: ["es"], fileName: "entry" },
        rolldownOptions: { external: (id: string) => isBudgetExternal(id, target.externals) },
      },
    });
    const outputs = Array.isArray(result) ? result : [result];
    return outputs
      .flatMap((output) => ("output" in output ? output.output : []))
      .flatMap((item) =>
        item.type === "chunk"
          ? [
              {
                code: item.code,
                imports: [...item.imports, ...item.dynamicImports],
                moduleIds: [...item.moduleIds],
              },
            ]
          : [],
      );
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
}
