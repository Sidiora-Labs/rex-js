import { z } from "zod";
import { validateName } from "./ids.ts";

export { z };

export const FIELD_KIND_KEY = "x-rex-field";
export const FIELD_REF_KEY = "x-rex-ref";

export type FieldKind =
  "id" | "text" | "money" | "integer" | "boolean" | "enum" | "ref" | "timestamp";

export const FIELD_KINDS: readonly FieldKind[] = [
  "id",
  "text",
  "money",
  "integer",
  "boolean",
  "enum",
  "ref",
  "timestamp",
];

export type JsonSchema = { [key: string]: unknown };

export const MONEY_PATTERN = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/;
export const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export interface TextOptions {
  readonly min?: number;
  readonly max?: number;
}

export interface IntegerOptions {
  readonly min?: number;
  readonly max?: number;
}

export type RefTarget = string | { readonly id: string };

export function id() {
  return z
    .string()
    .min(1)
    .max(128)
    .regex(ID_PATTERN)
    .meta({ [FIELD_KIND_KEY]: "id" });
}

export function text(options: TextOptions = {}) {
  let schema = z.string();
  if (options.min !== undefined) schema = schema.min(options.min);
  if (options.max !== undefined) schema = schema.max(options.max);
  return schema.meta({ [FIELD_KIND_KEY]: "text" });
}

export function money() {
  return z
    .string()
    .regex(MONEY_PATTERN)
    .meta({ [FIELD_KIND_KEY]: "money", format: "decimal" });
}

export function integer(options: IntegerOptions = {}) {
  let schema = z.number().int();
  if (options.min !== undefined) schema = schema.min(options.min);
  if (options.max !== undefined) schema = schema.max(options.max);
  return schema.meta({ [FIELD_KIND_KEY]: "integer" });
}

export function boolean() {
  return z.boolean().meta({ [FIELD_KIND_KEY]: "boolean" });
}

export function enumOf<const T extends readonly [string, ...string[]]>(values: T) {
  if (new Set(values).size !== values.length) {
    throw new Error(`enumOf: duplicate value in ${JSON.stringify(values)}`);
  }
  return z.enum(values).meta({ [FIELD_KIND_KEY]: "enum" });
}

export function ref(target: RefTarget) {
  const name = validateName(typeof target === "string" ? target : target.id, "ref target");
  return z
    .string()
    .min(1)
    .regex(ID_PATTERN)
    .meta({ [FIELD_KIND_KEY]: "ref", [FIELD_REF_KEY]: name });
}

export function timestamp() {
  return z.iso.datetime().meta({ [FIELD_KIND_KEY]: "timestamp" });
}

function unwrap(schema: z.ZodType): z.ZodType {
  let current: z.ZodType = schema;
  for (;;) {
    if (
      current instanceof z.ZodOptional ||
      current instanceof z.ZodNullable ||
      current instanceof z.ZodDefault
    ) {
      current = current.unwrap() as z.ZodType;
    } else {
      return current;
    }
  }
}

export function fieldKind(schema: z.ZodType): FieldKind | undefined {
  const kind = unwrap(schema).meta()?.[FIELD_KIND_KEY];
  return typeof kind === "string" && (FIELD_KINDS as readonly string[]).includes(kind)
    ? (kind as FieldKind)
    : undefined;
}

export function refTarget(schema: z.ZodType): string | undefined {
  const target = unwrap(schema).meta()?.[FIELD_REF_KEY];
  return typeof target === "string" ? target : undefined;
}

export function toJsonSchema(schema: z.ZodType, io: "input" | "output" = "output"): JsonSchema {
  return z.toJSONSchema(schema, {
    target: "draft-2020-12",
    unrepresentable: "throw",
    io,
  }) as JsonSchema;
}
