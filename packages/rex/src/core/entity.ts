import { RexNameError, validateName } from "./ids.ts";
import { fieldKind, toJsonSchema, z, type FieldKind, type JsonSchema } from "./schema.ts";

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

export type EntityFields = { readonly [field: string]: z.ZodType };

export type EntityRecord<F extends EntityFields> = z.output<
  z.ZodObject<{ -readonly [P in keyof F]: F[P] }>
>;

export type StringFieldOf<F extends EntityFields> = {
  [P in keyof F]: z.output<F[P]> extends string ? P : never;
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
  readonly fields: Readonly<F>;
  readonly fieldKinds: Readonly<Record<keyof F & string, FieldKind | undefined>>;
  readonly key: K;
  readonly schema: z.ZodObject<{ -readonly [P in keyof F]: F[P] }>;
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
    if (!((fields as Record<string, unknown>)[fieldName] instanceof z.ZodType)) {
      fail(`fields.${fieldName}`, "must be a zod schema");
    }
  }

  if (typeof config.label !== "function") fail("label", "must be a function from record to string");

  const key = (config.key ?? "id") as K;
  if (typeof key !== "string") fail("key", "must name a field");
  if (!fieldNames.includes(key)) fail("key", `names unknown field "${key}"`);
  const keySchema = config.fields[key] as z.ZodType;
  const keyOptional = keySchema.safeParse(undefined).success || keySchema.safeParse(null).success;
  if (
    keyOptional ||
    (!(keySchema instanceof z.ZodString) && !KEY_KINDS.includes(fieldKind(keySchema)))
  ) {
    fail("key", `field "${key}" must be a required string field`);
  }

  const shape = { ...config.fields } as { -readonly [P in keyof F]: F[P] };
  const schema = z.object(shape);
  let jsonSchema: JsonSchema;
  try {
    jsonSchema = toJsonSchema(schema);
  } catch (error) {
    return fail("fields", `cannot be represented as JSON Schema: ${(error as Error).message}`);
  }

  const fieldKinds = Object.freeze(
    Object.fromEntries(
      fieldNames.map((fieldName) => [fieldName, fieldKind(config.fields[fieldName] as z.ZodType)]),
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
    fields: Object.freeze({ ...config.fields }),
    fieldKinds,
    key,
    schema,
    jsonSchema: Object.freeze(jsonSchema),
    label,
    parse,
    keyOf,
  });
}
