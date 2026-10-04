import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "vite";
import { describe, expect, it } from "vitest";
import { entryBudgets, withinBudget } from "./vite/budgets.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..");
const SIZE_TEST_TIMEOUT_MS = 120_000;

const SIZE_EXTERNALS = [
  "react",
  "react-dom",
  "@tanstack/react-query",
  "cmdk",
  "wouter",
  "@orpc/client",
] as const;

function isExternal(id: string): boolean {
  return SIZE_EXTERNALS.some((name) => id === name || id.startsWith(`${name}/`));
}

async function bundledSize(source: string): Promise<{ raw: number; gzip: number }> {
  const result = await build({
    root: packageRoot,
    configFile: false,
    logLevel: "silent",
    build: {
      write: false,
      minify: true,
      lib: { entry: join(packageRoot, source), formats: ["es"], fileName: "entry" },
      rolldownOptions: { external: isExternal },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunks = outputs
    .flatMap((output) => ("output" in output ? output.output : []))
    .filter((item) => item.type === "chunk");
  expect(chunks.length).toBeGreaterThan(0);
  const code = chunks.map((chunk) => chunk.code).join("\n");
  return { raw: Buffer.byteLength(code), gzip: gzipSync(code).byteLength };
}

describe("entry size budgets", { timeout: SIZE_TEST_TIMEOUT_MS }, () => {
  it.each(entryBudgets())("keeps the $entry entry within $budget KB gzipped", async (target) => {
    const size = await bundledSize(target.source);
    console.log(
      `rex size: ${target.entry} ${target.source} ${(size.raw / 1024).toFixed(2)} KB raw, ${(size.gzip / 1024).toFixed(2)} KB gzip (budget ${target.budget} KB)`,
    );
    expect(size.gzip).toBeLessThanOrEqual(target.budget * 1024);
    expect(withinBudget(size.gzip, target.budget)).toBe(true);
  });
});
