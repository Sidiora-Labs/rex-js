import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { bundleBudgetEntry, entryBudgets, withinBudget, type EntryBudget } from "./vite/budgets.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..");
const SIZE_TEST_TIMEOUT_MS = 120_000;

async function bundledSize(target: EntryBudget): Promise<{ raw: number; gzip: number }> {
  const chunks = await bundleBudgetEntry(packageRoot, target);
  expect(chunks.length).toBeGreaterThan(0);
  const code = chunks.map((chunk) => chunk.code).join("\n");
  return { raw: Buffer.byteLength(code), gzip: gzipSync(code).byteLength };
}

describe("entry size budgets", { timeout: SIZE_TEST_TIMEOUT_MS }, () => {
  it.each(entryBudgets())("keeps the $entry entry within $budget KB gzipped", async (target) => {
    const size = await bundledSize(target);
    console.log(
      `rex size: ${target.entry} ${target.source} ${(size.raw / 1024).toFixed(2)} KB raw, ${(size.gzip / 1024).toFixed(2)} KB gzip (budget ${target.budget} KB)`,
    );
    expect(size.gzip).toBeLessThanOrEqual(target.budget * 1024);
    expect(withinBudget(size.gzip, target.budget)).toBe(true);
  });
});
