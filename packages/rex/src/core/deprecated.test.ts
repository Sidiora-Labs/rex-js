import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deprecated, deprecationMessage, hasWarned, resetDeprecations } from "./deprecated.ts";
import { errorDocs } from "./errors.ts";

beforeEach(resetDeprecations);
afterEach(resetDeprecations);

describe("deprecationMessage", () => {
  it("names the code, the message and the docs page", () => {
    expect(deprecationMessage("REX101", "wrap the app in defineConfig")).toBe(
      `rex: REX101 deprecated: wrap the app in defineConfig (${errorDocs("REX101")})`,
    );
    expect(deprecationMessage("REX610", "replace the placeholder")).toBe(
      "rex: REX610 deprecated: replace the placeholder (https://rex.sidioralabs.com/errors/REX610)",
    );
  });
});

describe("deprecated", () => {
  it("warns through the given sink once per code", () => {
    const warnings: string[] = [];
    const warn = (message: string) => {
      warnings.push(message);
    };
    expect(hasWarned("REX101")).toBe(false);
    expect(deprecated("REX101", "first", warn)).toBe(true);
    expect(deprecated("REX101", "second", warn)).toBe(false);
    expect(deprecated("REX610", "placeholder", warn)).toBe(true);
    expect(warnings).toEqual([
      deprecationMessage("REX101", "first"),
      deprecationMessage("REX610", "placeholder"),
    ]);
    expect(hasWarned("REX101")).toBe(true);
    expect(hasWarned("REX610")).toBe(true);
    expect(hasWarned("REX100")).toBe(false);
  });

  it("warns again after the deprecations are reset", () => {
    const warnings: string[] = [];
    const warn = (message: string) => {
      warnings.push(message);
    };
    deprecated("REX101", "once", warn);
    resetDeprecations();
    expect(hasWarned("REX101")).toBe(false);
    expect(deprecated("REX101", "again", warn)).toBe(true);
    expect(warnings).toEqual([
      deprecationMessage("REX101", "once"),
      deprecationMessage("REX101", "again"),
    ]);
  });

  it("writes to console.warn by default", () => {
    const original = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => {
      calls.push(args);
    };
    try {
      expect(deprecated("REX101", "legacy config")).toBe(true);
      expect(deprecated("REX101", "legacy config")).toBe(false);
    } finally {
      console.warn = original;
    }
    expect(calls).toEqual([[deprecationMessage("REX101", "legacy config")]]);
    expect(hasWarned("REX101")).toBe(true);
  });
});
