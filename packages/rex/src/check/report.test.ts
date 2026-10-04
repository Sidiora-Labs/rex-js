import { describe, expect, it } from "vitest";
import { isRexError, type RexError } from "../core/errors.ts";
import { compareFindings } from "./engine.ts";
import { REPORT_FORMATS, formatFindings, formatHuman, formatJson } from "./report.ts";
import { finding, type Finding } from "./rule.ts";

const badge = finding({
  rule: "naming/part-name",
  file: "app/pages/home/regions/main/parts/badge.tsx",
  message: "part file badge.tsx is not PascalCase",
  hint: "Rename it.",
});
const unformatted = finding({
  rule: "format/prettier",
  severity: "warning",
  file: "app/data/unformatted.ts",
  line: 12,
  column: 3,
  message: "not formatted",
  hint: "Run prettier.",
});
const alt = finding({
  rule: "a11y/img-alt",
  file: "app/data/unformatted.ts",
  line: 2,
  column: 10,
  message: "img has no alt",
  hint: "Add alt.",
});
const unsorted: readonly Finding[] = [badge, unformatted, alt];

describe("formatJson", () => {
  it("prints an empty list for no findings", () => {
    expect(formatJson([])).toBe("[]\n");
  });

  it("sorts the findings and ends with a newline", () => {
    const output = formatJson(unsorted);
    expect(output.endsWith("\n")).toBe(true);
    expect(JSON.parse(output)).toEqual([alt, unformatted, badge]);
    expect(JSON.parse(output)).toEqual([...unsorted].sort(compareFindings));
    expect(output).toBe(`${JSON.stringify([alt, unformatted, badge], null, 2)}\n`);
  });

  it("normalises the key order of findings built by hand", () => {
    const shuffled: Finding = {
      hint: badge.hint,
      message: badge.message,
      column: badge.column,
      line: badge.line,
      file: badge.file,
      severity: badge.severity,
      rule: badge.rule,
    };
    expect(Object.keys(JSON.parse(formatJson([shuffled]))[0])).toEqual([
      "rule",
      "severity",
      "file",
      "line",
      "column",
      "message",
      "hint",
    ]);
    expect(formatJson([shuffled])).toBe(formatJson([badge]));
  });
});

describe("formatHuman", () => {
  it("reports no findings", () => {
    expect(formatHuman([])).toBe("No findings.\n");
  });

  it("groups by file, aligns positions and counts problems", () => {
    expect(formatHuman(unsorted)).toBe(
      [
        "app/data/unformatted.ts",
        "  2:10  error    a11y/img-alt  img has no alt",
        "        hint: Add alt.",
        "  12:3  warning  format/prettier  not formatted",
        "        hint: Run prettier.",
        "",
        "app/pages/home/regions/main/parts/badge.tsx",
        "  1:1  error    naming/part-name  part file badge.tsx is not PascalCase",
        "       hint: Rename it.",
        "",
        "3 problems (2 errors, 1 warning) in 2 files",
        "",
      ].join("\n"),
    );
  });

  it("uses singular words for one problem, error, warning and file", () => {
    expect(formatHuman([badge]).split("\n").at(-2)).toBe(
      "1 problem (1 error, 0 warnings) in 1 file",
    );
    expect(formatHuman([unformatted]).split("\n").at(-2)).toBe(
      "1 problem (0 errors, 1 warning) in 1 file",
    );
  });
});

describe("formatFindings", () => {
  it("lists the formats and dispatches to them", () => {
    expect(REPORT_FORMATS).toEqual(["json", "human"]);
    expect(formatFindings(unsorted, "json")).toBe(formatJson(unsorted));
    expect(formatFindings(unsorted, "human")).toBe(formatHuman(unsorted));
    expect(formatFindings([], "human")).toBe("No findings.\n");
  });

  it("rejects an unknown format with REX506", () => {
    expect.assertions(3);
    try {
      formatFindings(unsorted, "xml" as never);
    } catch (error) {
      expect(isRexError(error)).toBe(true);
      expect((error as RexError).code).toBe("REX506");
      expect((error as RexError).message).toBe('REX506 formatFindings: unknown format "xml"');
    }
  });
});
