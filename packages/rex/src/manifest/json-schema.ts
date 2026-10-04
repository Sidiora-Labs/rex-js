import * as zm from "zod/mini";
import type { $ZodType } from "zod/v4/core";
import { REX_SCHEMA_VENDOR, STANDARD_VENDOR_KEY, type JsonSchema } from "../core/schema.ts";
import { isZodSchema, type StandardSchemaV1 } from "../core/standard.ts";
import { standardSource } from "../schema/adapter.ts";

export function toJsonSchema(schema: $ZodType, io: "input" | "output" = "output"): JsonSchema {
  return zm.toJSONSchema(schema, {
    target: "draft-2020-12",
    unrepresentable: "throw",
    io,
  }) as JsonSchema;
}

export function rexObjectShape(schema: unknown): Readonly<Record<string, StandardSchemaV1>> | null {
  if (
    isZodSchema(schema) ||
    (schema as StandardSchemaV1)["~standard"].vendor !== REX_SCHEMA_VENDOR
  ) {
    return null;
  }
  const shape = (schema as { shape?: unknown }).shape;
  return typeof shape === "object" && shape !== null
    ? (shape as Readonly<Record<string, StandardSchemaV1>>)
    : null;
}

export function standardVendorOf(schema: unknown): string | null {
  const source = standardSource(schema);
  if (source !== null) return source["~standard"].vendor;
  if (isZodSchema(schema) || rexObjectShape(schema) !== null) return null;
  return (schema as StandardSchemaV1)["~standard"].vendor;
}

export function standardJsonSchema(
  schema: StandardSchemaV1,
  io: "input" | "output" = "output",
): JsonSchema {
  const shape = rexObjectShape(schema);
  if (shape !== null) return objectJsonSchema(shape, io);
  return toJsonSchema(schema as unknown as $ZodType, io);
}

export function objectJsonSchema(
  shape: Readonly<Record<string, StandardSchemaV1>>,
  io: "input" | "output" = "output",
): JsonSchema {
  const placeholders = new Map<$ZodType, string>();
  const requiredStandard = new Set<string>();
  const entries = Object.entries(shape).map(([name, schema]): [string, $ZodType] => {
    const source = standardSource(schema) ?? schema;
    if (source === schema && isZodSchema(schema)) return [name, schema as unknown as $ZodType];
    const placeholder = zm.unknown();
    placeholders.set(placeholder, source["~standard"].vendor);
    const missing = source["~standard"].validate(undefined);
    if (!(missing instanceof Promise) && missing.issues !== undefined) requiredStandard.add(name);
    return [name, placeholder];
  });
  const json = zm.toJSONSchema(zm.object(Object.fromEntries(entries)), {
    target: "draft-2020-12",
    unrepresentable: "throw",
    io,
    override: (ctx) => {
      const vendor = placeholders.get(ctx.zodSchema as $ZodType);
      if (vendor !== undefined) ctx.jsonSchema[STANDARD_VENDOR_KEY] = vendor;
    },
  }) as JsonSchema;
  if (requiredStandard.size === 0) return json;
  const required = new Set([
    ...((json.required as string[] | undefined) ?? []),
    ...requiredStandard,
  ]);
  return { ...json, required: Object.keys(shape).filter((name) => required.has(name)) };
}
