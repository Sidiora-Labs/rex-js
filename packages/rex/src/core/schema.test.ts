import { describe, expect, it } from "vitest";
import { z as zc } from "zod";
import { z } from "zod/mini";
import { money, ref, text } from "../schema/index.ts";
import {
  FIELD_KIND_KEY,
  REX_SCHEMA_VENDOR,
  acceptsSync,
  fieldKind,
  objectSchema,
  objectShape,
  refTarget,
  schemaType,
  unwrapSchema,
} from "./schema.ts";
import { validateStandard, validateStandardSync, type StandardSchemaV1 } from "./standard.ts";

const hand: StandardSchemaV1<string, string> = {
  "~standard": {
    version: 1,
    vendor: "hand",
    validate: (value) =>
      typeof value === "string" ? { value } : { issues: [{ message: "must be a string" }] },
  },
};

const later: StandardSchemaV1<string, string> = {
  "~standard": {
    version: 1,
    vendor: "later",
    validate: async (value) =>
      typeof value === "string" ? { value } : { issues: [{ message: "must be a string" }] },
  },
};

describe("core schema reads without importing zod", () => {
  it("contains no zod import", async () => {
    const { readFile } = await import("node:fs/promises");
    for (const file of ["./schema.ts", "./standard.ts", "./entity.ts", "./action.ts", "./page.ts"]) {
      const source = await readFile(new URL(file, import.meta.url), "utf8");
      expect(source).not.toMatch(/^import (?!type)[^;]*from "zod/m);
    }
  });

  it("reads field kinds and ref targets through wrappers and classic meta", () => {
    expect(fieldKind(money())).toBe("money");
    expect(fieldKind(text().optional().nullable())).toBe("text");
    expect(fieldKind(zc.string().meta({ [FIELD_KIND_KEY]: "text" }).optional())).toBe("text");
    expect(fieldKind(z.string())).toBeUndefined();
    expect(fieldKind(hand)).toBeUndefined();
    expect(refTarget(ref("token").optional())).toBe("token");
    expect(refTarget(hand)).toBeUndefined();
  });

  it("reads schema types and object shapes structurally", () => {
    expect(schemaType(text().optional())).toBe("string");
    expect(schemaType(hand)).toBeUndefined();
    expect(unwrapSchema(hand)).toBe(hand);
    const shape = { name: text() };
    expect(objectShape(z.object(shape))).toEqual(shape);
    expect(objectShape(z.string())).toBeUndefined();
    expect(acceptsSync(text().optional(), undefined)).toBe(true);
    expect(acceptsSync(text(), undefined)).toBe(false);
    expect(acceptsSync(later, "x")).toBe(false);
  });
});

describe("objectSchema", () => {
  it("validates each field through the Standard Schema interface", () => {
    const schema = objectSchema({ name: text({ min: 1 }), code: hand, memo: text().optional() });
    expect(schema["~standard"].vendor).toBe(REX_SCHEMA_VENDOR);
    expect(validateStandardSync(schema, { name: "a", code: "x", extra: 1 })).toEqual({
      value: { name: "a", code: "x" },
    });
    const failed = validateStandardSync(schema, { name: "", code: 3 });
    expect(failed.issues?.map((issue) => issue.path)).toEqual([["name"], ["code"]]);
    expect(validateStandardSync(schema, null).issues).toHaveLength(1);
    expect(validateStandardSync(schema, ["a"]).issues).toHaveLength(1);
  });

  it("keeps defaults and settles asynchronous fields", async () => {
    const withDefault = objectSchema({ hide: z._default(z.boolean(), false) });
    expect(validateStandardSync(withDefault, {})).toEqual({ value: { hide: false } });
    const pending = objectSchema({ code: later });
    expect(() => validateStandardSync(pending, { code: "x" })).toThrow();
    expect(await validateStandard(pending, { code: "x" })).toEqual({ value: { code: "x" } });
    const rejected = await validateStandard(pending, { code: 1 });
    expect(rejected.issues?.[0]?.path).toEqual(["code"]);
  });
});
