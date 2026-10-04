import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CLIENT_EXPORT_SURFACE,
  LAZY_CHUNK_BUDGET_KB,
  bundleBudgetEntry,
  entryBudgets,
  measureBudgetChunks,
  withinBudget,
  type BudgetMeasurement,
  type ChunkSize,
  type EntryBudget,
} from "./vite/budgets.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..");
const SIZE_TEST_TIMEOUT_MS = 120_000;

async function measuredSize(target: EntryBudget): Promise<BudgetMeasurement> {
  const chunks = await bundleBudgetEntry(packageRoot, target);
  expect(chunks.length).toBeGreaterThan(0);
  return measureBudgetChunks(chunks);
}

function kb(bytes: number): string {
  return (bytes / 1024).toFixed(2);
}

function report(target: EntryBudget, label: string, size: ChunkSize, budget: number): void {
  console.log(
    `rex size: ${target.entry} ${label} ${kb(size.raw)} KB raw, ${kb(size.gzip)} KB gzip (budget ${budget} KB)`,
  );
}

function inform(target: EntryBudget, label: string, size: ChunkSize): void {
  console.log(
    `rex size: ${target.entry} export surface ${label} ${kb(size.raw)} KB raw, ${kb(size.gzip)} KB gzip (for information)`,
  );
}

describe("entry size budgets", { timeout: SIZE_TEST_TIMEOUT_MS }, () => {
  it.each(entryBudgets())(
    "keeps the $entry entry chunk within $budget KB gzipped and each lazy chunk within 10 KB",
    async (target) => {
      const size = await measuredSize(target);
      for (const chunk of size.firstPaint) {
        report(target, `first-paint chunk ${chunk.fileName}`, chunk, target.budget);
      }
      report(target, `${target.source} entry chunk`, size.entry, target.budget);
      for (const lazy of size.lazy) {
        report(target, `lazy chunk ${lazy.fileName}`, lazy, LAZY_CHUNK_BUDGET_KB);
      }
      expect(size.entry.gzip).toBeLessThanOrEqual(target.budget * 1024);
      expect(withinBudget(size.entry.gzip, target.budget)).toBe(true);
      for (const lazy of size.lazy) {
        expect(lazy.gzip, lazy.fileName).toBeLessThanOrEqual(LAZY_CHUNK_BUDGET_KB * 1024);
      }
    },
  );

  it("prints the whole rex/client export surface for information without budgeting it", async () => {
    const runtime = entryBudgets().find((target) => target.entry === "client");
    expect(runtime).toBeDefined();
    const surface: EntryBudget = { ...(runtime as EntryBudget), source: CLIENT_EXPORT_SURFACE };
    const size = await measuredSize(surface);
    for (const chunk of size.firstPaint) {
      inform(surface, `first-paint chunk ${chunk.fileName}`, chunk);
    }
    inform(surface, `${surface.source} first paint`, size.entry);
    for (const lazy of size.lazy) {
      inform(surface, `lazy chunk ${lazy.fileName}`, lazy);
    }
    expect(size.firstPaint.length).toBeGreaterThan(0);
  });
});
