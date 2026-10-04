import { describe, expect, it } from "vitest";
import * as zm from "zod/mini";
import { z } from "zod/mini";
import {
  FIELD_KIND_KEY,
  FIELD_REF_KEY,
  STANDARD_VENDOR_KEY,
  objectSchema,
} from "../core/schema.ts";
import type { StandardSchemaV1 } from "../core/standard.ts";
import {
  boolean,
  enumOf,
  fromStandard,
  id,
  integer,
  json,
  money,
  real,
  ref,
  text,
  timestamp,
} from "../schema/index.ts";
import * as manifestEntry from "./index.ts";
import { objectJsonSchema, standardJsonSchema, toJsonSchema } from "./json-schema.ts";

const DRAFT = "https://json-schema.org/draft/2020-12/schema";

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

describe("JSON Schema lives behind rex/manifest", () => {
  const hand: StandardSchemaV1<string, string> = {
    "~standard": {
      version: 1,
      vendor: "hand",
      validate: (value) =>
        typeof value === "string" ? { value } : { issues: [{ message: "must be a string" }] },
    },
  };

  it("exports the generator, buildManifest and the sidecar schema", () => {
    expect(manifestEntry.toJsonSchema).toBe(toJsonSchema);
    expect(manifestEntry.objectJsonSchema).toBe(objectJsonSchema);
    expect(typeof manifestEntry.buildManifest).toBe("function");
    expect(typeof manifestEntry.validateSidecar).toBe("function");
    expect(manifestEntry.sidecarJsonSchema.title).toBe("Rex page sidecar");
  });

  it("marks a declared Standard Schema field with its vendor without an adapter", () => {
    const schema = objectJsonSchema({ name: text(), code: hand });
    const properties = schema.properties as Record<string, Record<string, unknown>>;
    expect(properties.code?.[STANDARD_VENDOR_KEY]).toBe("hand");
    expect(schema.required).toEqual(["name", "code"]);
  });

  it("derives the JSON Schema of a zod schema or a Rex object schema at manifest time", () => {
    const input = z.object({ to: ref("contact"), amount: money() });
    expect(standardJsonSchema(input, "input")).toEqual(toJsonSchema(input, "input"));
    const shape = { name: text({ min: 1 }), count: integer().optional() };
    expect(standardJsonSchema(objectSchema(shape), "input")).toEqual(
      toJsonSchema(zm.object(shape), "input"),
    );
  });
});
