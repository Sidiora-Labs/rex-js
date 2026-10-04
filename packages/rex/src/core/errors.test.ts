import { describe, expect, it } from "vitest";
import { deprecated, deprecationMessage, hasWarned, resetDeprecations } from "./deprecated.ts";
import {
  REX_ERROR_CATALOG,
  REX_ERROR_CODE_PATTERN,
  RexDeclarationOptionError,
  RexError,
  errorDocs,
  formatRexError,
  isRexError,
  isRexErrorCode,
  type RexErrorCode,
} from "./errors.ts";

const codes = Object.keys(REX_ERROR_CATALOG) as RexErrorCode[];

describe("the error catalog", () => {
  it("holds config codes in REX1xx and declaration codes in REX2xx, each with a hint", () => {
    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) {
      const entry = REX_ERROR_CATALOG[code];
      expect(code).toMatch(REX_ERROR_CODE_PATTERN);
      expect(entry.title.trim()).not.toBe("");
      expect(entry.hint.trim()).not.toBe("");
      expect(code.startsWith(entry.area === "config" ? "REX1" : "REX2")).toBe(true);
    }
    for (const code of ["REX100", "REX101", "REX102", "REX110", "REX200", "REX210"]) {
      expect(isRexErrorCode(code)).toBe(true);
    }
    expect(isRexErrorCode("REX999")).toBe(false);
    expect(isRexErrorCode("toString")).toBe(false);
  });
});

describe("RexError", () => {
  it("carries code, hint, docs and an optional location", () => {
    const error = new RexError("REX113", "rex.config.ts: render is wrong", {
      file: "rex.config.ts",
      line: 4,
      column: 12,
    });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("RexError");
    expect(error.code).toBe("REX113");
    expect(error.message).toBe("REX113 rex.config.ts: render is wrong");
    expect(error.hint).toBe(REX_ERROR_CATALOG.REX113.hint);
    expect(error.docs).toBe("https://rex.sidioralabs.com/errors/REX113");
    expect(error.docs).toBe(errorDocs("REX113"));
    expect([error.file, error.line, error.column]).toEqual(["rex.config.ts", 4, 12]);
    expect(formatRexError(error)).toBe(
      [
        "REX113 rex.config.ts: render is wrong (rex.config.ts:4:12)",
        `  hint: ${REX_ERROR_CATALOG.REX113.hint}`,
        "  docs: https://rex.sidioralabs.com/errors/REX113",
      ].join("\n"),
    );
  });

  it("defaults the location to null and accepts a custom hint and cause", () => {
    const cause = new Error("root");
    const error = new RexError("REX100", "missing", { hint: "create it", cause });
    expect([error.file, error.line, error.column]).toEqual([null, null, null]);
    expect(error.hint).toBe("create it");
    expect(error.cause).toBe(cause);
    expect(formatRexError(error).split("\n")[0]).toBe("REX100 missing");
  });

  it("refuses an uncatalogued code", () => {
    expect(() => new RexError("REX999" as RexErrorCode, "x")).toThrow(TypeError);
  });

  it("is recognised structurally across module instances", () => {
    expect(isRexError(new RexError("REX110", "x"))).toBe(true);
    expect(isRexError(new Error("REX110 x"))).toBe(false);
    expect(isRexError({ code: "REX110", message: "x" })).toBe(false);
  });

  it("names the declaration, id and field for declaration option errors", () => {
    const error = new RexDeclarationOptionError("REX200", {
      declaration: "page",
      id: "home",
      field: "render",
      problem: "must be one of ssr, csr, ssg, static",
    });
    expect(error).toBeInstanceOf(RexError);
    expect(error.message).toBe('REX200 page "home": field "render" must be one of ssr, csr, ssg, static');
    expect([error.declaration, error.id, error.field]).toEqual(["page", "home", "render"]);
  });
});

describe("deprecated", () => {
  it("warns once per code with the docs link", () => {
    resetDeprecations();
    const warnings: string[] = [];
    const warn = (message: string) => warnings.push(message);
    expect(deprecated("REX101", "use defineConfig", warn)).toBe(true);
    expect(deprecated("REX101", "use defineConfig", warn)).toBe(false);
    expect(hasWarned("REX101")).toBe(true);
    expect(warnings).toEqual([
      "rex: REX101 deprecated: use defineConfig (https://rex.sidioralabs.com/errors/REX101)",
    ]);
    expect(deprecationMessage("REX101", "use defineConfig")).toBe(warnings[0]);
    resetDeprecations();
    expect(hasWarned("REX101")).toBe(false);
  });
});
