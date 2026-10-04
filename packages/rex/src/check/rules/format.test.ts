import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { discoverApp, runRules } from "../engine.ts";
import {
  FORMAT_CODE,
  FORMAT_IGNORE_FILES,
  FORMAT_RULE_ID,
  FORMAT_UNAVAILABLE_CODE,
  firstDifference,
  formatRule,
} from "./format.ts";
import { defaultRules } from "./index.ts";

const FORMAT_TIMEOUT_MS = 60_000;
const UNFORMATTED = "export const total = 1+2";
const FORMATTED = "export const total = 1 + 2;\n";
const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function writeApp(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "rex-format-"));
  temporary.push(root);
  for (const [file, content] of Object.entries(files)) {
    const full = path.join(root, file);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

describe("firstDifference", () => {
  it("points at the first differing character", () => {
    expect(firstDifference("a\nb\nc", "a\nb\nc")).toEqual({ line: 1, column: 1 });
    expect(firstDifference(UNFORMATTED, FORMATTED)).toEqual({ line: 1, column: 23 });
    expect(firstDifference("a\n  x = 1\n", "a\n  x = 2\n")).toEqual({ line: 2, column: 7 });
    expect(firstDifference("b\n", "a\n")).toEqual({ line: 1, column: 1 });
  });

  it("points past the end of a line the formatter extends or shortens", () => {
    expect(firstDifference("const a = 1\n", "const a = 1;\n")).toEqual({ line: 1, column: 12 });
    expect(firstDifference("const a = 1;\n", "const a = 1\n")).toEqual({ line: 1, column: 12 });
  });

  it("points at the last source line when the formatter appends lines", () => {
    expect(firstDifference("a\nb", "a\nb\nc")).toEqual({ line: 2, column: 1 });
  });
});

describe("format rule", { timeout: FORMAT_TIMEOUT_MS }, () => {
  it("is the format rule of the default set", () => {
    expect(formatRule.id).toBe(FORMAT_RULE_ID);
    expect(FORMAT_RULE_ID).toBe("format");
    expect(FORMAT_CODE).toBe("format/prettier");
    expect(FORMAT_UNAVAILABLE_CODE).toBe("format/unavailable");
    expect(FORMAT_IGNORE_FILES).toEqual([".prettierignore", ".gitignore"]);
    expect(defaultRules).toContain(formatRule);
  });

  it("warns about files prettier would rewrite with the rex preset", async () => {
    const root = writeApp({
      "app/data/formatted.ts": FORMATTED,
      "app/data/unformatted.ts": UNFORMATTED,
      "app/pages/home/utils.ts": "export const  name = 'home'\n",
    });
    const result = await runRules(discoverApp(root), [formatRule]);
    expect(
      result.findings.map((entry) => [
        entry.rule,
        entry.severity,
        entry.file,
        entry.line,
        entry.column,
      ]),
    ).toEqual([
      [FORMAT_CODE, "warning", "app/data/unformatted.ts", 1, 23],
      [FORMAT_CODE, "warning", "app/pages/home/utils.ts", 1, 14],
    ]);
    expect(result.findings[0]?.message).toBe(
      "app/data/unformatted.ts is not formatted: prettier --check would rewrite it from line 1",
    );
    expect(result.findings[0]?.hint).toContain("prettier --write .");
    expect(result.warnings).toBe(2);
    expect(result.errors).toBe(0);
    expect(result.exitCode).toBe(0);
  });

  it("honours the app's own prettier config", async () => {
    const root = writeApp({
      ".prettierrc": '{ "semi": false }\n',
      "app/data/bare.ts": "export const total = 1 + 2\n",
      "app/data/semi.ts": FORMATTED,
    });
    const result = await runRules(discoverApp(root), [formatRule]);
    expect(result.findings.map((entry) => [entry.file, entry.line, entry.column])).toEqual([
      ["app/data/semi.ts", 1, 27],
    ]);
  });

  it("skips files listed in .prettierignore and .gitignore", async () => {
    const root = writeApp({
      ".prettierignore": "app/data/generated.ts\n",
      ".gitignore": "app/data/vendored.ts\n",
      "app/data/checked.ts": UNFORMATTED,
      "app/data/generated.ts": UNFORMATTED,
      "app/data/vendored.ts": UNFORMATTED,
    });
    const result = await runRules(discoverApp(root), [formatRule]);
    expect(result.findings.map((entry) => entry.file)).toEqual(["app/data/checked.ts"]);
  });
});
