import {
  DEFAULT_BUDGETS,
  DEFAULT_OPTIONS,
  type RexConfigExport,
  type ResolvedBudgets,
} from "../core/config.ts";
import { RexError } from "../core/errors.ts";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { build } from "vite";
import type { ChunkBudgets } from "./split.ts";

export const EDGE_BUDGET_KB = 40;

export const LAZY_CHUNK_BUDGET_KB = 10;

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
  readonly fileName: string;
  readonly isEntry: boolean;
  readonly code: string;
  readonly imports: readonly string[];
  readonly staticImports?: readonly string[];
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
        minify: false,
        lib: { entry: join(packageRoot, target.source), formats: ["es"], fileName: "entry" },
        rolldownOptions: {
          external: (id: string) => isBudgetExternal(id, target.externals),
          output: { minify: true, comments: false },
        },
      },
    });
    const outputs = Array.isArray(result) ? result : [result];
    return outputs
      .flatMap((output) => ("output" in output ? output.output : []))
      .flatMap((item) =>
        item.type === "chunk"
          ? [
              {
                fileName: item.fileName,
                isEntry: item.isEntry,
                code: item.code,
                imports: [...item.imports, ...item.dynamicImports],
                staticImports: [...item.imports],
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

export interface ChunkSize {
  readonly fileName: string;
  readonly raw: number;
  readonly gzip: number;
}

export interface BudgetMeasurement {
  readonly entry: ChunkSize;
  readonly firstPaint: readonly ChunkSize[];
  readonly lazy: readonly ChunkSize[];
}

function chunkSize(chunk: BundledChunk): ChunkSize {
  return {
    fileName: chunk.fileName,
    raw: Buffer.byteLength(chunk.code),
    gzip: gzipSync(chunk.code).byteLength,
  };
}

function firstPaintChunks(
  entry: BundledChunk,
  chunks: readonly BundledChunk[],
): ReadonlySet<BundledChunk> {
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const reached = new Set<BundledChunk>([entry]);
  const queue = [entry];
  for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
    for (const name of next.staticImports ?? []) {
      const imported = byName.get(name);
      if (imported === undefined || reached.has(imported)) continue;
      reached.add(imported);
      queue.push(imported);
    }
  }
  return reached;
}

export function measureBudgetChunks(chunks: readonly BundledChunk[]): BudgetMeasurement {
  const entries = chunks.filter((chunk) => chunk.isEntry);
  if (entries.length !== 1) {
    throw new RexError(
      "REX329",
      `measureBudgetChunks: expected one entry chunk, found ${entries.length}`,
    );
  }
  const entry = entries[0] as BundledChunk;
  const firstPaint = firstPaintChunks(entry, chunks);
  const sizes = [...firstPaint].map(chunkSize);
  return {
    entry: {
      fileName: entry.fileName,
      raw: sizes.reduce((total, size) => total + size.raw, 0),
      gzip: sizes.reduce((total, size) => total + size.gzip, 0),
    },
    firstPaint: sizes,
    lazy: chunks
      .filter((chunk) => !firstPaint.has(chunk))
      .map(chunkSize)
      .sort((a, b) => (a.fileName < b.fileName ? -1 : a.fileName > b.fileName ? 1 : 0)),
  };
}
