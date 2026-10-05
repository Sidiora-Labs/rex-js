import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REX_VERSION } from "../index.ts";
import { chunkTable, staticImportClosures } from "../vite/split.ts";
import { buildReporter, fitLogo, formatBuildChunks } from "./build-output.ts";
import { REX_LOGO } from "./logo.ts";

describe("build presentation", () => {
  it("embeds the supplied logo exactly and fits common terminal widths", () => {
    expect(REX_LOGO).toBe(
      readFileSync(new URL("../../../../assets/rex.asc", import.meta.url), "utf8"),
    );
    for (const columns of [20, 40, 76, 100, 400]) {
      const logo = fitLogo(columns);
      expect(logo.trim().length).toBeGreaterThan(0);
      expect(Math.max(...logo.split("\n").map((line) => line.length))).toBeLessThanOrEqual(columns);
    }
  });

  it("prints version, actual phases and timings with no ANSI in plain output", () => {
    const lines: string[] = [];
    const reporter = buildReporter({
      cwd: "/site",
      out: (line) => lines.push(line),
      err: () => undefined,
    });
    reporter.phase("Checking application");
    reporter.phase("Building client bundles");
    reporter.complete("static");
    const output = lines.join("");
    expect(output).toContain(`RexJS v${REX_VERSION}`);
    expect(output).toContain("[ok] Checking application");
    expect(output).toMatch(/Build complete in \d+\.\d{2}s \(static\)/);
    expect(output).not.toContain("\u001b");
    expect(output.indexOf("RexJS")).toBeLessThan(output.indexOf("Checking application"));
  });

  it("colors interactive output and never reports failed phases as complete", () => {
    const lines: string[] = [];
    const reporter = buildReporter({
      cwd: "/site",
      color: true,
      columns: 50,
      out: (line) => lines.push(line),
      err: () => undefined,
    });
    reporter.phase("Checking application");
    reporter.failed();
    const output = lines.join("");
    expect(output).toContain("\u001b[36m");
    expect(output).toContain("Build failed");
    expect(output).not.toContain("[ok]");
    expect(output).not.toContain("Build complete");
  });

  it("reports real own and import gzip measurements with unchanged budget markers", () => {
    const items = [
      {
        type: "chunk",
        name: "page-home",
        fileName: "assets/home.js",
        code: "export const home = 1;",
        isEntry: true,
        imports: ["assets/shared.js", "external-package"],
      },
      {
        type: "chunk",
        name: "shared",
        fileName: "assets/shared.js",
        code: "export const shared = 2;",
        isEntry: false,
        imports: [],
      },
    ] as const;
    const chunks = chunkTable(items, { page: 0 });
    const closures = staticImportClosures(items);
    const report = formatBuildChunks(chunks, closures);
    expect(report).toContain("0 KB OVER");
    expect(report).toContain("Total gzip");
    expect(report).toContain("external-package");
    expect(report).toContain(`${(closures[0]!.gzip / 1024).toFixed(2)} KB`);
    expect(report).toContain("Budgets apply to each chunk's own gzip size.");
    const narrow = formatBuildChunks(chunks, closures, 30);
    expect(narrow).toContain("    Gzip:");
    expect(narrow).toContain("0 KB OVER");
    expect(formatBuildChunks([], [])).not.toContain("NaN");
  });
});
