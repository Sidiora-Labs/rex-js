import { describe, expect, it } from "vitest";
import {
  FIELD_KIND_KEY,
  FIELD_REF_KEY,
  boolean,
  enumOf,
  fieldKind,
  id,
  integer,
  money,
  ref,
  refTarget,
  text,
  timestamp,
  toJsonSchema,
  z,
} from "./schema.ts";

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
    expect(fieldKind(boolean())).toBe("boolean");
    expect(fieldKind(enumOf(["a", "b"]))).toBe("enum");
    expect(fieldKind(ref("token"))).toBe("ref");
    expect(fieldKind(timestamp())).toBe("timestamp");
    expect(fieldKind(text().optional())).toBe("text");
    expect(fieldKind(integer().nullable())).toBe("integer");
    expect(fieldKind(boolean().default(false))).toBe("boolean");
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
