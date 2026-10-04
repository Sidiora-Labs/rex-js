import { describe, expect, it } from "vitest";
import { z as zc } from "zod";
import * as zm from "zod/mini";
import {
  STANDARD_VENDOR_KEY,
  objectJsonSchema,
  unwrapSchema,
  FIELD_KIND_KEY,
  FIELD_REF_KEY,
  boolean,
  enumOf,
  fieldKind,
  id,
  integer,
  json,
  money,
  real,
  ref,
  refTarget,
  text,
  timestamp,
  toJsonSchema,
} from "./schema.ts";
import { z } from "zod/mini";
import * as core from "../index.ts";
import { fromStandard, isZodSchema, validateStandard, type StandardSchemaV1 } from "./standard.ts";

const DRAFT = "https://json-schema.org/draft/2020-12/schema";

describe("field helpers validate values", () => {
  it("id", () => {
    expect(id().parse("acc_1")).toBe("acc_1");
    expect(id().safeParse("").success).toBe(false);
    expect(id().safeParse("-x").success).toBe(false);
    expect(id().safeParse("a".repeat(129)).success).toBe(false);
  });

  it("text", () => {
    expect(text().parse("")).toBe("");
    expect(text({ min: 1, max: 3 }).safeParse("").success).toBe(false);
    expect(text({ min: 1, max: 3 }).safeParse("abcd").success).toBe(false);
    expect(text({ min: 1, max: 3 }).parse("abc")).toBe("abc");
  });

  it("money", () => {
    for (const value of ["0", "12", "12.50", "-3.1", "0.000001"]) {
      expect(money().parse(value)).toBe(value);
    }
    for (const value of ["", "01", "1.", ".5", "1e3", "abc", "1,000"]) {
      expect(money().safeParse(value).success).toBe(false);
    }
    expect(money().safeParse(12).success).toBe(false);
  });

  it("integer", () => {
    expect(integer().parse(3)).toBe(3);
    expect(integer().safeParse(3.5).success).toBe(false);
    expect(integer({ min: 0, max: 10 }).safeParse(-1).success).toBe(false);
    expect(integer({ min: 0, max: 10 }).safeParse(11).success).toBe(false);
  });

  it("real", () => {
    expect(real().parse(2.5)).toBe(2.5);
    expect(real().parse(-3)).toBe(-3);
    expect(real().safeParse("2.5").success).toBe(false);
    expect(real().safeParse(Number.NaN).success).toBe(false);
    expect(real({ min: 0, max: 1 }).safeParse(-0.1).success).toBe(false);
    expect(real({ min: 0, max: 1 }).safeParse(1.1).success).toBe(false);
    expect(real({ min: 0, max: 1 }).parse(0.5)).toBe(0.5);
  });

  it("json", () => {
    const value = { tags: ["a", "b"], nested: { on: true, count: 2, none: null } };
    expect(json().parse(value)).toEqual(value);
    expect(json().parse("text")).toBe("text");
    expect(json().safeParse(undefined).success).toBe(false);
    expect(json().safeParse({ at: new Date(0) }).success).toBe(false);
  });

  it("boolean", () => {
    expect(boolean().parse(true)).toBe(true);
    expect(boolean().safeParse("true").success).toBe(false);
  });

  it("enumOf", () => {
    const network = enumOf(["paxeer", "ethereum"]);
    expect(network.parse("paxeer")).toBe("paxeer");
    expect(network.safeParse("solana").success).toBe(false);
    const parsed: "paxeer" | "ethereum" = network.parse("ethereum");
    expect(parsed).toBe("ethereum");
    expect(() => enumOf(["a", "a"])).toThrow("duplicate");
  });

  it("ref", () => {
    expect(ref("token").parse("tok_1")).toBe("tok_1");
    expect(ref({ id: "account" }).safeParse("").success).toBe(false);
    expect(() => ref("Token")).toThrow('invalid ref target "Token"');
  });

  it("timestamp", () => {
    expect(timestamp().parse("2026-10-04T12:00:00Z")).toBe("2026-10-04T12:00:00Z");
    expect(timestamp().safeParse("2026-10-04").success).toBe(false);
    expect(timestamp().safeParse("yesterday").success).toBe(false);
  });
});

describe("field kinds", () => {
  it("are recorded on every helper and survive optional, nullable and default", () => {
    expect(fieldKind(id())).toBe("id");
    expect(fieldKind(text())).toBe("text");
    expect(fieldKind(money())).toBe("money");
    expect(fieldKind(integer())).toBe("integer");
    expect(fieldKind(real())).toBe("real");
    expect(fieldKind(json())).toBe("json");
    expect(fieldKind(boolean())).toBe("boolean");
    expect(fieldKind(enumOf(["a", "b"]))).toBe("enum");
    expect(fieldKind(ref("token"))).toBe("ref");
    expect(fieldKind(timestamp())).toBe("timestamp");
    expect(fieldKind(text().optional())).toBe("text");
    expect(fieldKind(integer().nullable())).toBe("integer");
    expect(fieldKind(boolean().default(false))).toBe("boolean");
    expect(fieldKind(real().optional())).toBe("real");
    expect(fieldKind(json().nullable())).toBe("json");
    expect(fieldKind(z.string())).toBeUndefined();
    expect(refTarget(ref({ id: "account" }).optional())).toBe("account");
    expect(refTarget(text())).toBeUndefined();
  });
});

describe("toJsonSchema", () => {
  it("emits draft 2020-12 for every field helper", () => {
    expect(toJsonSchema(id())).toEqual({
      $schema: DRAFT,
      type: "string",
      minLength: 1,
      maxLength: 128,
      pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$",
      [FIELD_KIND_KEY]: "id",
    });
    expect(toJsonSchema(text({ min: 1, max: 80 }))).toEqual({
      $schema: DRAFT,
      type: "string",
      minLength: 1,
      maxLength: 80,
      [FIELD_KIND_KEY]: "text",
    });
    expect(toJsonSchema(money())).toEqual({
      $schema: DRAFT,
      type: "string",
      pattern: "^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$",
      format: "decimal",
      [FIELD_KIND_KEY]: "money",
    });
    expect(toJsonSchema(integer({ min: 0, max: 100 }))).toEqual({
      $schema: DRAFT,
      type: "integer",
      minimum: 0,
      maximum: 100,
      [FIELD_KIND_KEY]: "integer",
    });
    expect(toJsonSchema(boolean())).toEqual({
      $schema: DRAFT,
      type: "boolean",
      [FIELD_KIND_KEY]: "boolean",
    });
    expect(toJsonSchema(enumOf(["paxeer", "ethereum"]))).toEqual({
      $schema: DRAFT,
      type: "string",
      enum: ["paxeer", "ethereum"],
      [FIELD_KIND_KEY]: "enum",
    });
    expect(toJsonSchema(ref("token"))).toEqual({
      $schema: DRAFT,
      type: "string",
      minLength: 1,
      pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]*$",
      [FIELD_KIND_KEY]: "ref",
      [FIELD_REF_KEY]: "token",
    });
    expect(toJsonSchema(real({ min: 0 }))).toEqual({
      $schema: DRAFT,
      type: "number",
      minimum: 0,
      [FIELD_KIND_KEY]: "real",
    });
    const value = toJsonSchema(zm.object({ value: json() }));
    const property = (value.properties as Record<string, Record<string, unknown>>).value;
    const defs = value.$defs as Record<string, Record<string, unknown>>;
    const target = defs[String(property?.$ref).replace("#/$defs/", "")];
    expect(target?.[FIELD_KIND_KEY]).toBe("json");
    expect(target?.anyOf).toHaveLength(6);
    expect(value.required).toEqual(["value"]);
    const stamp = toJsonSchema(timestamp());
    expect(stamp.$schema).toBe(DRAFT);
    expect(stamp.type).toBe("string");
    expect(stamp.format).toBe("date-time");
    expect(stamp[FIELD_KIND_KEY]).toBe("timestamp");
  });

  it("emits objects with required fields and is identical across calls", () => {
    const schema = z.object({ to: ref("contact"), amount: money(), memo: text().optional() });
    const first = toJsonSchema(schema);
    expect(first.type).toBe("object");
    expect(first.required).toEqual(["to", "amount"]);
    expect(first.additionalProperties).toBe(false);
    expect(Object.keys(first.properties as object)).toEqual(["to", "amount", "memo"]);
    expect(JSON.stringify(toJsonSchema(schema))).toBe(JSON.stringify(first));
  });

  it("distinguishes input and output for defaults", () => {
    const schema = z.object({ hide: boolean().default(false) });
    expect(toJsonSchema(schema, "input").required).toBeUndefined();
    expect(toJsonSchema(schema, "output").required).toEqual(["hide"]);
  });

  it("throws on unrepresentable schemas", () => {
    expect(() => toJsonSchema(z.date())).toThrow();
  });
});

describe("field helpers are built on zod/mini", () => {
  it("leaves zod out of the core entry, which exports the field helpers and validateStandard", () => {
    const exported = core as Readonly<Record<string, unknown>>;
    expect(Object.hasOwn(exported, "z")).toBe(false);
    expect(Object.hasOwn(exported, "zm")).toBe(false);
    for (const value of Object.values(exported)) expect(value).not.toBe(zm.object);
    expect(core.validateStandard).toBe(validateStandard);
    expect([
      core.id,
      core.text,
      core.money,
      core.integer,
      core.real,
      core.boolean,
      core.enumOf,
      core.ref,
      core.timestamp,
      core.json,
    ]).toEqual([id, text, money, integer, real, boolean, enumOf, ref, timestamp, json]);
    expect(z.string()).toBeInstanceOf(zm.ZodMiniString);
    expect(z.string()).not.toBeInstanceOf(zc.ZodType);
  });

  it("returns zod/mini schemas, not classic zod schemas", () => {
    for (const schema of [
      id(),
      text(),
      money(),
      integer(),
      real(),
      boolean(),
      ref("token"),
      timestamp(),
      json(),
    ]) {
      expect(isZodSchema(schema)).toBe(true);
      expect(schema).not.toBeInstanceOf(zc.ZodType);
      expect(typeof (schema as unknown as { min?: unknown }).min).toBe("undefined");
    }
    expect(enumOf(["a", "b"])).not.toBeInstanceOf(zc.ZodType);
  });

  it("keeps optional, nullable, default and meta on the helpers with their field tags", () => {
    const memo = text({ max: 3 }).optional();
    expect(memo.parse(undefined)).toBeUndefined();
    expect(memo.safeParse("abcd").success).toBe(false);
    expect(fieldKind(memo)).toBe("text");
    const last = text({ min: 1 }).nullable();
    expect(last.parse(null)).toBeNull();
    expect(fieldKind(last)).toBe("text");
    const hide = boolean().default(false);
    expect(hide.parse(undefined)).toBe(false);
    expect(fieldKind(hide)).toBe("boolean");
    const tagged = money().meta({ description: "Amount" });
    expect(fieldKind(tagged)).toBe("money");
    expect(toJsonSchema(tagged)).toMatchObject({ description: "Amount", "x-rex-field": "money" });
    const wrapped = ref("token").optional().nullable();
    expect(refTarget(wrapped)).toBe("token");
    expect(unwrapSchema(wrapped)._zod.def.type).toBe("string");
  });

  it("composes with zod/mini and classic zod objects", () => {
    const mini = zm.object({ to: ref("contact"), memo: zm.optional(text()) });
    expect(mini.parse({ to: "c-1" })).toEqual({ to: "c-1" });
    const classic = zc.object({ to: ref("contact"), amount: money() });
    expect(classic.safeParse({ to: "c-1", amount: "x" }).success).toBe(false);
    expect(fieldKind(classic.shape.amount)).toBe("money");
  });

  it("reads field tags from classic zod schemas tagged with meta", () => {
    const classic = zc.string().meta({ [FIELD_KIND_KEY]: "text" }).optional();
    expect(fieldKind(classic)).toBe("text");
  });
});

describe("objectJsonSchema", () => {
  const hand: StandardSchemaV1<string, string> = {
    "~standard": {
      version: 1,
      vendor: "hand",
      validate: (value) =>
        typeof value === "string" ? { value } : { issues: [{ message: "must be a string" }] },
    },
  };

  it("matches the JSON Schema of a zod object for zod fields", () => {
    const shape = { name: text({ min: 1 }), count: integer().optional() };
    expect(objectJsonSchema(shape)).toEqual(toJsonSchema(zm.object(shape)));
  });

  it("marks Standard Schema fields with their vendor", () => {
    const schema = objectJsonSchema({ name: text(), code: fromStandard(hand) });
    const properties = schema.properties as Record<string, Record<string, unknown>>;
    expect(properties.code?.[STANDARD_VENDOR_KEY]).toBe("hand");
    expect(properties.name?.[FIELD_KIND_KEY]).toBe("text");
  });
});
