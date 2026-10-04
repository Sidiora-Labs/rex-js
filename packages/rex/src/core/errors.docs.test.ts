import { describe, expect, it } from "vitest";
import {
  REX_ERROR_AREAS,
  REX_ERROR_DOCS,
  errorArea,
  errorHint,
  explainRexError,
  type RexErrorArea,
} from "./errors.docs.ts";
import {
  REX_ERROR_CATALOG,
  RexDeclarationOptionError,
  RexError,
  formatRexError,
  type RexErrorCode,
} from "./errors.ts";

const codes = Object.keys(REX_ERROR_CATALOG) as RexErrorCode[];

describe("error areas", () => {
  it("cover the six code prefixes with distinct titles", () => {
    expect(Object.keys(REX_ERROR_AREAS)).toEqual([
      "config",
      "declaration",
      "runtime",
      "server",
      "checker",
      "cli",
    ]);
    expect(Object.values(REX_ERROR_AREAS).map((area) => area.prefix)).toEqual([
      "REX1",
      "REX2",
      "REX3",
      "REX4",
      "REX5",
      "REX6",
    ]);
    expect(new Set(Object.values(REX_ERROR_AREAS).map((area) => area.title)).size).toBe(6);
  });

  it("map each code to the area of its prefix", () => {
    expect(errorArea("REX100")).toBe("config");
    expect(errorArea("REX218")).toBe("declaration");
    expect(errorArea("REX329")).toBe("runtime");
    expect(errorArea("REX440")).toBe("server");
    expect(errorArea("REX504")).toBe("checker");
    expect(errorArea("REX612")).toBe("cli");
    const seen = new Set<RexErrorArea>();
    for (const code of codes) {
      const area = errorArea(code);
      expect(code.startsWith(REX_ERROR_AREAS[area].prefix), code).toBe(true);
      seen.add(area);
    }
    expect([...seen].sort()).toEqual(Object.keys(REX_ERROR_AREAS).sort());
  });
});

describe("error docs", () => {
  it("hold one trimmed single-line hint per catalogued code", () => {
    expect(Object.keys(REX_ERROR_DOCS).sort()).toEqual([...codes].sort());
    for (const code of codes) {
      const { hint } = REX_ERROR_DOCS[code];
      expect(hint, code).toBe(hint.trim());
      expect(hint, code).not.toContain("\n");
      expect(hint.length, code).toBeGreaterThan(10);
      expect(hint, code).not.toBe(REX_ERROR_CATALOG[code]);
    }
  });
});

describe("errorHint", () => {
  it("prefers the error's own hint over the catalogue hint", () => {
    const bare = new RexError("REX504", "finding: file must be a non-empty path");
    expect(errorHint(bare)).toBe(REX_ERROR_DOCS.REX504.hint);
    const hinted = new RexError("REX504", "finding: file must be a non-empty path", {
      hint: "pass the file",
    });
    expect(errorHint(hinted)).toBe("pass the file");
    const option = new RexDeclarationOptionError("REX213", {
      declaration: "page",
      id: "home",
      field: "route",
      problem: "must start with /",
    });
    expect(errorHint(option)).toBe(REX_ERROR_DOCS.REX213.hint);
  });
});

describe("explainRexError", () => {
  it("explains an error with its location, the catalogue hint and the docs link", () => {
    const located = new RexError("REX460", "discoverApp: no app directory", {
      file: "rex.config.ts",
      line: 3,
      column: 9,
    });
    expect(explainRexError(located)).toBe(formatRexError(located, REX_ERROR_DOCS.REX460.hint));
    expect(explainRexError(located).split("\n")).toEqual([
      "REX460 discoverApp: no app directory (rex.config.ts:3:9)",
      `  hint: ${REX_ERROR_DOCS.REX460.hint}`,
      "  docs: https://rex.sidioralabs.com/errors/REX460",
    ]);
  });

  it("keeps a custom hint and omits the location when there is none", () => {
    const hinted = new RexError("REX100", "rex.config.ts is missing", { hint: "run rex new" });
    expect(explainRexError(hinted).split("\n")).toEqual([
      "REX100 rex.config.ts is missing",
      "  hint: run rex new",
      "  docs: https://rex.sidioralabs.com/errors/REX100",
    ]);
    expect(explainRexError(hinted)).not.toContain(REX_ERROR_DOCS.REX100.hint);
  });
});
