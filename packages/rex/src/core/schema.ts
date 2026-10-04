import * as zm from "zod/mini";
import type { $ZodType, util } from "zod/v4/core";
import { RexError } from "./errors.ts";
import { validateName } from "./ids.ts";
import { standardSource } from "./standard.ts";

export * as z from "zod/mini";

export const FIELD_KIND_KEY = "x-rex-field";
export const FIELD_REF_KEY = "x-rex-ref";
export const STANDARD_VENDOR_KEY = "x-rex-standard";

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
  | "json";

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

export interface RealOptions {
  readonly min?: number;
  readonly max?: number;
}

export type RefTarget = string | { readonly id: string };

type FieldMeta = Readonly<Record<string, unknown>>;

export interface RexFieldMethods<T extends zm.ZodMiniType> {
  optional(): RexField<zm.ZodMiniOptional<T>>;
  nullable(): RexField<zm.ZodMiniNullable<T>>;
  default(value: util.NoUndefined<zm.output<T>>): RexField<zm.ZodMiniDefault<T>>;
  meta(meta: FieldMeta): RexField<T>;
}

export type RexField<T extends zm.ZodMiniType> = T & RexFieldMethods<T>;

export function field<T extends zm.ZodMiniType>(schema: T, meta?: FieldMeta): RexField<T> {
  if (meta !== undefined) zm.globalRegistry.add(schema, { ...meta });
  const methods: RexFieldMethods<T> = {
    optional: () => field(zm.optional(schema)),
    nullable: () => field(zm.nullable(schema)),
    default: (value) => field(zm._default(schema, value)),
    meta: (next) => field(schema.clone() as T, { ...zm.globalRegistry.get(schema), ...next }),
  };
  return Object.assign(schema, methods);
}

export function id() {
  return field(
    zm.string().check(zm.minLength(1), zm.maxLength(128), zm.regex(ID_PATTERN)),
    { [FIELD_KIND_KEY]: "id" },
  );
}

export function text(options: TextOptions = {}) {
  return field(
    zm.string().check(
      ...[
        ...(options.min === undefined ? [] : [zm.minLength(options.min)]),
        ...(options.max === undefined ? [] : [zm.maxLength(options.max)]),
      ],
    ),
    { [FIELD_KIND_KEY]: "text" },
  );
}

export function money() {
  return field(zm.string().check(zm.regex(MONEY_PATTERN)), {
    [FIELD_KIND_KEY]: "money",
    format: "decimal",
  });
}

export function integer(options: IntegerOptions = {}) {
  return field(
    zm.int().check(
      ...[
        ...(options.min === undefined ? [] : [zm.gte(options.min)]),
        ...(options.max === undefined ? [] : [zm.lte(options.max)]),
      ],
    ),
    { [FIELD_KIND_KEY]: "integer" },
  );
}

export function real(options: RealOptions = {}) {
  return field(
    zm.number().check(
      ...[
        ...(options.min === undefined ? [] : [zm.gte(options.min)]),
        ...(options.max === undefined ? [] : [zm.lte(options.max)]),
      ],
    ),
    { [FIELD_KIND_KEY]: "real" },
  );
}

export function boolean() {
  return field(zm.boolean(), { [FIELD_KIND_KEY]: "boolean" });
}

export function enumOf<const T extends readonly [string, ...string[]]>(values: T) {
  if (new Set(values).size !== values.length) {
    throw new RexError("REX221", `enumOf: duplicate value in ${JSON.stringify(values)}`);
  }
  return field(zm.enum(values), { [FIELD_KIND_KEY]: "enum" });
}

export function ref(target: RefTarget) {
  const name = validateName(typeof target === "string" ? target : target.id, "ref target");
  return field(zm.string().check(zm.minLength(1), zm.regex(ID_PATTERN)), {
    [FIELD_KIND_KEY]: "ref",
    [FIELD_REF_KEY]: name,
  });
}

export function timestamp() {
  return field(zm.iso.datetime(), { [FIELD_KIND_KEY]: "timestamp" });
}

export function json() {
  return field(zm.json(), { [FIELD_KIND_KEY]: "json" });
}

const WRAPPER_TYPES = new Set(["optional", "nullable", "default"]);

export function unwrapSchema(schema: $ZodType): $ZodType {
  let current = schema;
  for (;;) {
    const def = current._zod.def as { readonly type: string; readonly innerType?: $ZodType };
    if (!WRAPPER_TYPES.has(def.type) || def.innerType === undefined) return current;
    current = def.innerType;
  }
}

export function schemaType(schema: $ZodType): string {
  return unwrapSchema(schema)._zod.def.type;
}

function metaOf(schema: $ZodType): Readonly<Record<string, unknown>> | undefined {
  return zm.globalRegistry.get(unwrapSchema(schema)) as Readonly<Record<string, unknown>> | undefined;
}

export function fieldKind(schema: $ZodType): FieldKind | undefined {
  const kind = metaOf(schema)?.[FIELD_KIND_KEY];
  return typeof kind === "string" && (FIELD_KINDS as readonly string[]).includes(kind)
    ? (kind as FieldKind)
    : undefined;
}

export function refTarget(schema: $ZodType): string | undefined {
  const target = metaOf(schema)?.[FIELD_REF_KEY];
  return typeof target === "string" ? target : undefined;
}

export function toJsonSchema(schema: $ZodType, io: "input" | "output" = "output"): JsonSchema {
  return zm.toJSONSchema(schema, {
    target: "draft-2020-12",
    unrepresentable: "throw",
    io,
  }) as JsonSchema;
}

export function objectJsonSchema(
  shape: Readonly<Record<string, $ZodType>>,
  io: "input" | "output" = "output",
): JsonSchema {
  const placeholders = new Map<$ZodType, string>();
  const requiredStandard = new Set<string>();
  const entries = Object.entries(shape).map(([name, schema]): [string, $ZodType] => {
    const source = standardSource(schema);
    if (source === null) return [name, schema];
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
  const required = new Set([...((json.required as string[] | undefined) ?? []), ...requiredStandard]);
  return { ...json, required: Object.keys(shape).filter((name) => required.has(name)) };
}
