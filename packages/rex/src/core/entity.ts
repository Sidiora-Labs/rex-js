import * as zm from "zod/mini";
import { RexNameError, validateName } from "./ids.ts";
import {
  fieldKind,
  objectJsonSchema,
  schemaType,
  type FieldKind,
  type JsonSchema,
} from "./schema.ts";
import {
  fromStandard,
  isStandardSchema,
  type AsZodSchema,
  type StandardInferOutput,
  type StandardSchemaV1,
  type ZodSchemaLike,
} from "./standard.ts";

export class RexDeclarationError extends Error {
  readonly declaration: string;
  readonly id: string;
  readonly field: string;

  constructor(declaration: string, id: string, field: string, problem: string) {
    super(`${declaration} ${JSON.stringify(id)}: field "${field}" ${problem}`);
    this.name = "RexDeclarationError";
    this.declaration = declaration;
    this.id = id;
    this.field = field;
  }
}

export function declarationName<N extends string>(declaration: string, name: N): N {
  try {
    return validateName(name, `${declaration} id`);
  } catch (error) {
    if (error instanceof RexNameError) {
      throw new RexDeclarationError(declaration, String(name), "id", error.message);
    }
    throw error;
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

export const FIELD_NAME_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

export type EntityFields = { readonly [field: string]: StandardSchemaV1 };

export type EntityShape<F extends EntityFields> = { -readonly [P in keyof F]: AsZodSchema<F[P]> };

export type EntityRecord<F extends EntityFields> = zm.output<zm.ZodMiniObject<EntityShape<F>>>;

export type StringFieldOf<F extends EntityFields> = {
  [P in keyof F]: StandardInferOutput<F[P]> extends string ? P : never;
}[keyof F] &
  string;

export interface EntityConfig<F extends EntityFields, K extends StringFieldOf<F>> {
  readonly fields: F;
  readonly label: (record: EntityRecord<F>) => string;
  readonly key?: K;
}

export interface EntityDeclaration<
  N extends string = string,
  F extends EntityFields = EntityFields,
  K extends string = StringFieldOf<F>,
> {
  readonly kind: "entity";
  readonly id: N;
  readonly name: N;
  readonly fields: Readonly<EntityShape<F>>;
  readonly fieldKinds: Readonly<Record<keyof F & string, FieldKind | undefined>>;
  readonly key: K;
  readonly schema: zm.ZodMiniObject<EntityShape<F>>;
  readonly jsonSchema: JsonSchema;
  label(record: EntityRecord<F>): string;
  parse(value: unknown): EntityRecord<F>;
  keyOf(record: EntityRecord<F>): string;
}

export type AnyEntity = EntityDeclaration<string, EntityFields, string>;

export type InferEntity<E> =
  E extends EntityDeclaration<string, infer F, infer _K> ? EntityRecord<F> : never;

const KEY_KINDS: readonly (FieldKind | undefined)[] = ["id", "text", "ref"];

export function entity<
  const N extends string,
  const F extends EntityFields,
  K extends StringFieldOf<F> = "id" & StringFieldOf<F>,
>(name: N, config: EntityConfig<F, K>): EntityDeclaration<N, F, K> {
  const id = declarationName("entity", name);
  const fail = (field: string, problem: string): never => {
    throw new RexDeclarationError("entity", id, field, problem);
  };

  if (!isPlainObject(config)) fail("config", "must be a declaration object");
  const allowed = new Set(["fields", "label", "key"]);
  for (const property of Object.keys(config)) {
    if (!allowed.has(property)) fail(property, "is not part of the entity declaration");
  }

  const fields = config.fields as unknown;
  if (!isPlainObject(fields)) fail("fields", "must be an object of field schemas");
  const fieldNames = Object.keys(fields as object);
  if (fieldNames.length === 0) fail("fields", "must declare at least one field");
  for (const fieldName of fieldNames) {
    if (!FIELD_NAME_PATTERN.test(fieldName)) {
      fail(`fields.${fieldName}`, "must be a camelCase name starting with a lowercase letter");
    }
    if (!isStandardSchema((fields as Record<string, unknown>)[fieldName])) {
      fail(`fields.${fieldName}`, "must be a Standard Schema such as a zod schema");
    }
  }

  if (typeof config.label !== "function") fail("label", "must be a function from record to string");

  const key = (config.key ?? "id") as K;
  if (typeof key !== "string") fail("key", "must name a field");
  if (!fieldNames.includes(key)) fail("key", `names unknown field "${key}"`);
  const shape = Object.fromEntries(
    fieldNames.map((fieldName) => [
      fieldName,
      fromStandard(config.fields[fieldName] as StandardSchemaV1),
    ]),
  ) as EntityShape<F>;
  const keySchema = (shape as Record<string, ZodSchemaLike>)[key] as ZodSchemaLike;
  const keyOptional =
    zm.safeParse(keySchema, undefined).success || zm.safeParse(keySchema, null).success;
  if (
    keyOptional ||
    (schemaType(keySchema) !== "string" && !KEY_KINDS.includes(fieldKind(keySchema)))
  ) {
    fail("key", `field "${key}" must be a required string field`);
  }

  const schema = zm.object(shape);
  let jsonSchema: JsonSchema;
  try {
    jsonSchema = objectJsonSchema(shape);
  } catch (error) {
    return fail("fields", `cannot be represented as JSON Schema: ${(error as Error).message}`);
  }

  const fieldKinds = Object.freeze(
    Object.fromEntries(
      fieldNames.map((fieldName) => [
        fieldName,
        fieldKind((shape as Record<string, ZodSchemaLike>)[fieldName] as ZodSchemaLike),
      ]),
    ),
  ) as Readonly<Record<keyof F & string, FieldKind | undefined>>;

  const label = config.label;
  const parse = (value: unknown): EntityRecord<F> => schema.parse(value) as EntityRecord<F>;
  const keyOf = (record: EntityRecord<F>): string => {
    const value = (record as Record<string, unknown>)[key];
    if (typeof value !== "string" || value.length === 0) {
      throw new RexDeclarationError("entity", id, key, "key value must be a non-empty string");
    }
    return value;
  };

  return Object.freeze({
    kind: "entity",
    id,
    name: id,
    fields: Object.freeze(shape),
    fieldKinds,
    key,
    schema,
    jsonSchema: Object.freeze(jsonSchema),
    label,
    parse,
    keyOf,
  });
}
