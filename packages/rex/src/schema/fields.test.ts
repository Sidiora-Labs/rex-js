import { describe, expect, it } from "vitest";
import { z as zc } from "zod";
import * as zm from "zod/mini";
import { z } from "zod/mini";
import * as core from "../index.ts";
import { FIELD_KIND_KEY, fieldKind, refTarget, unwrapSchema } from "../core/schema.ts";
import { isZodSchema, validateStandard } from "../core/standard.ts";
import { toJsonSchema } from "../manifest/json-schema.ts";
import * as schemaEntry from "./index.ts";
import { boolean, enumOf, id, integer, json, money, real, ref, text, timestamp } from "./index.ts";

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

describe("field helpers are built on zod/mini", () => {
  it("are exported by rex/schema and not by the core entry, which keeps validateStandard", () => {
    const exported = core as Readonly<Record<string, unknown>>;
    expect(Object.hasOwn(exported, "z")).toBe(false);
    expect(Object.hasOwn(exported, "zm")).toBe(false);
    for (const value of Object.values(exported)) expect(value).not.toBe(zm.object);
    expect(core.validateStandard).toBe(validateStandard);
    const helpers = [
      "id",
      "text",
      "money",
      "integer",
      "real",
      "boolean",
      "enumOf",
      "ref",
      "timestamp",
      "json",
    ];
    for (const name of helpers) expect(Object.hasOwn(exported, name)).toBe(false);
    for (const name of [
      "defineConfig",
      "buildManifest",
      "validateSidecar",
      "toJsonSchema",
      "fieldKind",
    ]) {
      expect(Object.hasOwn(exported, name)).toBe(false);
    }
    expect([
      schemaEntry.id,
      schemaEntry.text,
      schemaEntry.money,
      schemaEntry.integer,
      schemaEntry.real,
      schemaEntry.boolean,
      schemaEntry.enumOf,
      schemaEntry.ref,
      schemaEntry.timestamp,
      schemaEntry.json,
    ]).toEqual([id, text, money, integer, real, boolean, enumOf, ref, timestamp, json]);
    expect(Object.hasOwn(schemaEntry as Readonly<Record<string, unknown>>, "z")).toBe(false);
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
    expect((unwrapSchema(wrapped) as zm.ZodMiniType)._zod.def.type).toBe("string");
  });

  it("composes with zod/mini and classic zod objects", () => {
    const mini = zm.object({ to: ref("contact"), memo: zm.optional(text()) });
    expect(mini.parse({ to: "c-1" })).toEqual({ to: "c-1" });
    const classic = zc.object({ to: ref("contact"), amount: money() });
    expect(classic.safeParse({ to: "c-1", amount: "x" }).success).toBe(false);
    expect(fieldKind(classic.shape.amount)).toBe("money");
  });

  it("reads field tags from classic zod schemas tagged with meta", () => {
    const classic = zc
      .string()
      .meta({ [FIELD_KIND_KEY]: "text" })
      .optional();
    expect(fieldKind(classic)).toBe("text");
  });
});
