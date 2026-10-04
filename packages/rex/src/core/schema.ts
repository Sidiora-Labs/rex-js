import type { StandardIssue, StandardResult, StandardSchemaV1 } from "./standard.ts";

export const FIELD_KIND_KEY = "x-rex-field";
export const FIELD_REF_KEY = "x-rex-ref";
export const STANDARD_VENDOR_KEY = "x-rex-standard";
export const REX_SCHEMA_VENDOR = "rex";

export type FieldKind =
  | "id"
  | "text"
  | "money"
  | "integer"
  | "real"
  | "boolean"
  | "enum"
  | "ref"
  | "timestamp"
  | "json"
  | "markdown";

export const FIELD_KINDS: readonly FieldKind[] = [
  "id",
  "text",
  "money",
  "integer",
  "real",
  "boolean",
  "enum",
  "ref",
  "timestamp",
  "json",
  "markdown",
];

export type JsonSchema = { [key: string]: unknown };

export const MONEY_PATTERN = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/;
export const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export interface SchemaDefinition {
  readonly type: string;
  readonly innerType?: unknown;
  readonly shape?: Readonly<Record<string, unknown>>;
}

interface SchemaInternals {
  readonly _zod: { readonly def: SchemaDefinition };
}

interface SchemaMetadataRegistry {
  get(schema: unknown): unknown;
}

const WRAPPER_TYPES = new Set(["optional", "nullable", "default"]);

function hasDefinition(schema: unknown): schema is SchemaInternals {
  if ((typeof schema !== "object" && typeof schema !== "function") || schema === null) return false;
  const internals = (schema as { _zod?: unknown })._zod;
  if (typeof internals !== "object" || internals === null) return false;
  const def = (internals as { def?: unknown }).def;
  return (
    typeof def === "object" && def !== null && typeof (def as { type?: unknown }).type === "string"
  );
}

export function schemaDefinition(schema: unknown): SchemaDefinition | undefined {
  return hasDefinition(schema) ? schema._zod.def : undefined;
}

export function unwrapSchema(schema: unknown): unknown {
  let current = schema;
  for (;;) {
    const def = schemaDefinition(current);
    if (def === undefined || !WRAPPER_TYPES.has(def.type) || def.innerType === undefined) {
      return current;
    }
    current = def.innerType;
  }
}

export function schemaType(schema: unknown): string | undefined {
  return schemaDefinition(unwrapSchema(schema))?.type;
}

export function objectShape(schema: unknown): Readonly<Record<string, unknown>> | undefined {
  const def = schemaDefinition(schema);
  if (def === undefined || def.type !== "object") return undefined;
  const shape = def.shape;
  return typeof shape === "object" && shape !== null ? shape : undefined;
}

function metadataRegistry(): SchemaMetadataRegistry | undefined {
  const registry = (globalThis as { __zod_globalRegistry?: unknown }).__zod_globalRegistry;
  return typeof registry === "object" &&
    registry !== null &&
    typeof (registry as { get?: unknown }).get === "function"
    ? (registry as SchemaMetadataRegistry)
    : undefined;
}

function metaOf(schema: unknown): Readonly<Record<string, unknown>> | undefined {
  const unwrapped = unwrapSchema(schema);
  if (!hasDefinition(unwrapped)) return undefined;
  const meta = metadataRegistry()?.get(unwrapped);
  return typeof meta === "object" && meta !== null
    ? (meta as Readonly<Record<string, unknown>>)
    : undefined;
}

export function fieldKind(schema: unknown): FieldKind | undefined {
  const kind = metaOf(schema)?.[FIELD_KIND_KEY];
  return typeof kind === "string" && (FIELD_KINDS as readonly string[]).includes(kind)
    ? (kind as FieldKind)
    : undefined;
}

export function refTarget(schema: unknown): string | undefined {
  const target = metaOf(schema)?.[FIELD_REF_KEY];
  return typeof target === "string" ? target : undefined;
}

export function acceptsSync(schema: StandardSchemaV1, value: unknown): boolean {
  const result = schema["~standard"].validate(value);
  return !(result instanceof Promise) && result.issues === undefined;
}

export type ObjectShape = { readonly [field: string]: StandardSchemaV1 };

export interface ObjectSchema<Shape extends ObjectShape, Input, Output> extends StandardSchemaV1<
  Input,
  Output
> {
  readonly shape: Shape;
}

type FieldResult = readonly [string, StandardResult<unknown>];

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function settleObject(
  input: Readonly<Record<string, unknown>>,
  results: readonly FieldResult[],
): StandardResult<Record<string, unknown>> {
  const issues: StandardIssue[] = [];
  const value: Record<string, unknown> = {};
  for (const [name, result] of results) {
    if (result.issues !== undefined) {
      for (const issue of result.issues) {
        issues.push({ message: issue.message, path: [name, ...(issue.path ?? [])] });
      }
      continue;
    }
    if (result.value === undefined && !Object.hasOwn(input, name)) continue;
    value[name] = result.value;
  }
  return issues.length > 0 ? { issues } : { value };
}

export function objectSchema<Shape extends ObjectShape, Input = unknown, Output = Input>(
  shape: Shape,
): ObjectSchema<Shape, Input, Output> {
  const names = Object.keys(shape);
  const validate = (value: unknown): StandardResult<Output> | Promise<StandardResult<Output>> => {
    if (!isRecord(value)) return { issues: [{ message: "expected an object", path: [] }] };
    const pending: (FieldResult | Promise<FieldResult>)[] = names.map((name) => {
      const result = (shape[name] as StandardSchemaV1)["~standard"].validate(value[name]);
      return result instanceof Promise
        ? result.then((settled): FieldResult => [name, settled])
        : [name, result];
    });
    if (pending.some((entry) => entry instanceof Promise)) {
      return Promise.all(pending).then(
        (results) => settleObject(value, results) as StandardResult<Output>,
      );
    }
    return settleObject(value, pending as FieldResult[]) as StandardResult<Output>;
  };
  return Object.freeze({
    shape,
    "~standard": Object.freeze({ version: 1 as const, vendor: REX_SCHEMA_VENDOR, validate }),
  });
}
