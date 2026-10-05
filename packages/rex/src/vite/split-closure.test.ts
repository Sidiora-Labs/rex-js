import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { build } from "vite";
import { describe, expect, it } from "vitest";
import {
  chunkTable,
  formatStaticImportClosures,
  staticImportClosures,
  type StaticImportChunk,
} from "./split.ts";

describe("static import closures", () => {
  it("deduplicates diamond imports and cycles and identifies external imports", () => {
    const chunks: StaticImportChunk[] = [
      {
        type: "chunk",
        name: "page-home",
        fileName: "home.js",
        code: "import './a.js'; import './b.js';",
        isEntry: true,
        imports: ["a.js", "b.js"],
      },
      {
        type: "chunk",
        name: "a",
        fileName: "a.js",
        code: "import './shared.js';",
        isEntry: false,
        imports: ["shared.js"],
      },
      {
        type: "chunk",
        name: "b",
        fileName: "b.js",
        code: "import './shared.js'; export const b = 2;",
        isEntry: false,
        imports: ["shared.js"],
      },
      {
        type: "chunk",
        name: "shared",
        fileName: "shared.js",
        code: "import './a.js'; import 'external';",
        isEntry: false,
        imports: ["a.js", "external"],
      },
    ];
    const closure = staticImportClosures(chunks).find((row) => row.file === "home.js")!;
    expect(closure.files).toEqual(["a.js", "b.js", "home.js", "shared.js"]);
    expect(closure.externalImports).toEqual(["external"]);
    expect(closure.raw).toBe(
      chunks.reduce((total, chunk) => total + Buffer.byteLength(chunk.code), 0),
    );
    expect(closure.gzip).toBe(
      chunks.reduce((total, chunk) => total + gzipSync(chunk.code).byteLength, 0),
    );
    const own = chunkTable(chunks).find((row) => row.file === "home.js")!;
    const budget = (own.gzip + 1) / 1024;
    expect(closure.gzip).toBeGreaterThan(budget * 1024);
    expect(chunkTable(chunks, { page: budget }).find((row) => row.file === "home.js")?.over).toBe(
      false,
    );
    expect(formatStaticImportClosures([closure])).toContain("measurements, not budgets");
    expect(formatStaticImportClosures([closure])).toContain("4 chunks  external: external");
  });

  it("measures real Vite shared output without loading a deferred chunk", async () => {
    const root = await mkdtemp(join(tmpdir(), "rex-static-closure-"));
    try {
      await Promise.all([
        writeFile(
          join(root, "home.js"),
          "import { shared } from './shared.js'; export const home = shared; export const later = () => import('./deferred.js');",
        ),
        writeFile(
          join(root, "other.js"),
          "import { shared } from './shared.js'; export const other = shared;",
        ),
        writeFile(join(root, "shared.js"), "export const shared = globalThis.location?.pathname;"),
        writeFile(join(root, "deferred.js"), "export const deferred = globalThis.location?.hash;"),
      ]);
      const result = await build({
        root,
        configFile: false,
        logLevel: "silent",
        build: {
          write: false,
          minify: true,
          rolldownOptions: {
            input: { "page-home": join(root, "home.js"), other: join(root, "other.js") },
            preserveEntrySignatures: "strict",
          },
        },
      });
      const outputs = Array.isArray(result) ? result : [result];
      const items = outputs.flatMap((output) => ("output" in output ? output.output : []));
      const chunks = items.filter((item) => item.type === "chunk");
      const home = chunks.find((chunk) => chunk.name === "page-home")!;
      expect(home).toBeDefined();
      expect(home.imports.length).toBeGreaterThan(0);
      expect(home.dynamicImports.length).toBeGreaterThan(0);
      const closure = staticImportClosures(items).find((row) => row.file === home.fileName)!;
      expect(closure.externalImports).toEqual([]);
      expect(closure.files).toContain(home.fileName);
      for (const imported of home.imports) expect(closure.files).toContain(imported);
      for (const deferred of home.dynamicImports) expect(closure.files).not.toContain(deferred);
      const transferred = chunks.filter((chunk) => closure.files.includes(chunk.fileName));
      expect(closure.gzip).toBe(
        transferred.reduce((total, chunk) => total + gzipSync(chunk.code).byteLength, 0),
      );
      expect(closure.gzip).toBeGreaterThan(gzipSync(home.code).byteLength);
      expect(formatStaticImportClosures([closure])).toContain(home.fileName);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);
});
