import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { format, type Config } from "prettier";
import { describe, expect, expectTypeOf, it } from "vitest";
import { PRETTIER_CONFIG_FILE, prettierConfigTemplate } from "./cli/gen/lint.ts";
import rexPrettier, { rexPrettierConfig } from "./prettier.ts";

const here = dirname(fileURLToPath(import.meta.url));

describe("rex/prettier", () => {
  it("default-exports the 100-column preset", () => {
    expect(rexPrettier).toBe(rexPrettierConfig);
    expect(rexPrettierConfig).toEqual({
      printWidth: 100,
      tabWidth: 2,
      useTabs: false,
      semi: true,
      singleQuote: false,
      jsxSingleQuote: false,
      quoteProps: "as-needed",
      trailingComma: "all",
      bracketSpacing: true,
      bracketSameLine: false,
      arrowParens: "always",
      endOfLine: "lf",
    });
    expectTypeOf(rexPrettierConfig).toMatchTypeOf<Config>();
    expectTypeOf(rexPrettierConfig.printWidth).toEqualTypeOf<100>();
  });

  it("formats typescript the house way", async () => {
    const formatted = await format("const a = {b:1,'c':[1,2]}\nconst f = x => x\nconst s = 'x'\n", {
      ...rexPrettierConfig,
      parser: "typescript",
    });
    expect(formatted).toBe('const a = { b: 1, c: [1, 2] };\nconst f = (x) => x;\nconst s = "x";\n');
    const jsx = await format("export const el = <a href='/x' b={1}></a>\n", {
      ...rexPrettierConfig,
      parser: "typescript",
    });
    expect(jsx).toBe('export const el = <a href="/x" b={1}></a>;\n');
  });

  it("wraps at 100 columns with trailing commas and two-space indents", async () => {
    const call =
      "export const total = computeTotal(argumentNumberOne, argumentNumberTwo, argumentNumberThree, argumentNumberFour);\n";
    expect(call.length).toBeGreaterThan(101);
    const formatted = await format(call, { ...rexPrettierConfig, parser: "typescript" });
    const lines = formatted.split("\n");
    expect(lines[0]).toBe("export const total = computeTotal(");
    expect(lines[1]).toBe("  argumentNumberOne,");
    expect(lines.at(-3)).toBe("  argumentNumberFour,");
    expect(lines.at(-2)).toBe(");");
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(100);
    const fits = `${"export const short = compute(a, b, c);".padEnd(99, " ")}\n`;
    expect(await format(fits, { ...rexPrettierConfig, parser: "typescript" })).toBe(
      "export const short = compute(a, b, c);\n",
    );
    expect(formatted).not.toContain("\r\n");
    expect(formatted).not.toContain("\t");
  });

  it("is the preset rex new tells apps to extend", () => {
    expect(PRETTIER_CONFIG_FILE).toBe(".prettierrc");
    expect(prettierConfigTemplate()).toBe('"@sidioralabs/rex/prettier"\n');
    const packageJson = JSON.parse(readFileSync(join(here, "../package.json"), "utf8")) as {
      readonly exports: Readonly<Record<string, string>>;
    };
    expect(packageJson.exports["./prettier"]).toBe("./src/prettier.ts");
  });
});
