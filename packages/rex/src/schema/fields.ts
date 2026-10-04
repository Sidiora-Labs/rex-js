import * as zm from "zod/mini";
import type { util } from "zod/v4/core";
import { RexError } from "../core/errors.ts";
import { validateName } from "../core/ids.ts";
import { FIELD_KIND_KEY, FIELD_REF_KEY, ID_PATTERN, MONEY_PATTERN } from "../core/schema.ts";

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
  return field(zm.string().check(zm.minLength(1), zm.maxLength(128), zm.regex(ID_PATTERN)), {
    [FIELD_KIND_KEY]: "id",
  });
}

export function text(options: TextOptions = {}) {
  return field(
    zm
      .string()
      .check(
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
    zm
      .int()
      .check(
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
    zm
      .number()
      .check(
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
