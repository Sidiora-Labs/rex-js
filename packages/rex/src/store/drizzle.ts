import { and, asc, count, eq, getTableColumns, isNull, sql, type SQL } from "drizzle-orm";
import {
  integer,
  real,
  sqliteTable,
  text,
  type BaseSQLiteDatabase,
  type SQLiteColumn,
  type SQLiteColumnBuilderBase,
} from "drizzle-orm/sqlite-core";
import type { AnyEntity, InferEntity } from "../core/entity.ts";
import { fieldKind, schemaType, type FieldKind } from "../core/schema.ts";
import type { ZodSchemaLike } from "../core/standard.ts";
import {
  normalizeListQuery,
  validateStoreId,
  type ListQuery,
  type ListResult,
  type Store,
} from "../core/store.ts";

export type ColumnType = "text" | "integer" | "real" | "boolean" | "json";

export interface ColumnSpec {
  readonly field: string;
  readonly type: ColumnType;
  readonly optional: boolean;
  readonly nullable: boolean;
  readonly key: boolean;
}

export interface DrizzleStoreOptions {
  readonly table?: string;
  readonly createTable?: boolean;
}

export type AsyncSQLiteDatabase = BaseSQLiteDatabase<"async", unknown, Record<string, unknown>>;

const TABLE_NAME_PATTERN = /^[a-z_][a-z0-9_]*$/;

const KIND_COLUMNS: Readonly<Record<FieldKind, ColumnType>> = {
  id: "text",
  text: "text",
  money: "text",
  integer: "integer",
  real: "real",
  boolean: "boolean",
  enum: "text",
  ref: "text",
  timestamp: "text",
  json: "json",
};

const SQL_TYPES: Readonly<Record<ColumnType, string>> = {
  text: "text",
  json: "text",
  integer: "integer",
  boolean: "integer",
  real: "real",
};

const TYPE_COLUMNS: Readonly<Record<string, ColumnType>> = {
  string: "text",
  enum: "text",
  number: "real",
  boolean: "boolean",
};

function columnTypeOf(schema: ZodSchemaLike): ColumnType {
  const kind = fieldKind(schema);
  if (kind !== undefined) return KIND_COLUMNS[kind];
  return TYPE_COLUMNS[schemaType(schema)] ?? "json";
}

export function tableNameFor(declared: AnyEntity): string {
  return declared.id.replace(/[.-]/g, "_");
}

export function columnSpecs(declared: AnyEntity): readonly ColumnSpec[] {
  return Object.entries(declared.fields).map(([field, schema]) => {
    const zodSchema = schema as ZodSchemaLike;
    const optional = zodSchema.safeParse(undefined).success;
    const nullable = zodSchema.safeParse(null).success;
    if (optional && nullable) {
      throw new TypeError(
        `drizzleStore ${declared.id}: field "${field}" is both optional and nullable, which one SQL NULL cannot distinguish`,
      );
    }
    return {
      field,
      type: columnTypeOf(zodSchema),
      optional,
      nullable,
      key: field === declared.key,
    };
  });
}

export function createTableStatement(declared: AnyEntity, table = tableNameFor(declared)): string {
  if (!TABLE_NAME_PATTERN.test(table)) {
    throw new TypeError(`drizzleStore: table name "${table}" must be lowercase snake_case`);
  }
  const columns = columnSpecs(declared).map((spec) => {
    const constraints = `${spec.key ? " PRIMARY KEY" : ""}${
      spec.optional || spec.nullable ? "" : " NOT NULL"
    }`;
    return `"${spec.field}" ${SQL_TYPES[spec.type]}${constraints}`;
  });
  return `CREATE TABLE IF NOT EXISTS "${table}" (${columns.join(", ")})`;
}

function columnBuilder(spec: ColumnSpec): SQLiteColumnBuilderBase {
  const base =
    spec.type === "integer"
      ? integer(spec.field)
      : spec.type === "boolean"
        ? integer(spec.field, { mode: "boolean" })
        : spec.type === "real"
          ? real(spec.field)
          : spec.type === "json"
            ? text(spec.field, { mode: "json" })
            : text(spec.field);
  if (spec.key) return base.primaryKey().notNull();
  return spec.optional || spec.nullable ? base : base.notNull();
}

export function entityTable(declared: AnyEntity, table = tableNameFor(declared)) {
  if (!TABLE_NAME_PATTERN.test(table)) {
    throw new TypeError(`drizzleStore: table name "${table}" must be lowercase snake_case`);
  }
  const columns: Record<string, SQLiteColumnBuilderBase> = {};
  for (const spec of columnSpecs(declared)) columns[spec.field] = columnBuilder(spec);
  return sqliteTable(table, columns);
}

export function drizzleStore<E extends AnyEntity>(
  declared: E,
  db: AsyncSQLiteDatabase,
  options: DrizzleStoreOptions = {},
): Store<InferEntity<E>> {
  type T = InferEntity<E>;
  const tableName = options.table ?? tableNameFor(declared);
  const specs = columnSpecs(declared);
  const table = entityTable(declared, tableName);
  const ddl = createTableStatement(declared, tableName);
  const columns = getTableColumns(table) as Record<string, SQLiteColumn>;
  const keyColumn = columns[declared.key] as SQLiteColumn;
  const specByField = new Map(specs.map((spec) => [spec.field, spec]));

  let ready: Promise<void> | undefined;
  const init = (): Promise<void> => {
    if (options.createTable === false) return Promise.resolve();
    ready ??= db.run(sql.raw(ddl)).then(() => undefined);
    return ready;
  };

  const encode = (record: T): Record<string, unknown> => {
    declared.keyOf(record as never);
    const row: Record<string, unknown> = {};
    for (const spec of specs) {
      const value = (record as Record<string, unknown>)[spec.field];
      row[spec.field] = value === undefined ? null : value;
    }
    return row;
  };

  const decode = (row: Record<string, unknown>): T => {
    const record: Record<string, unknown> = {};
    for (const spec of specs) {
      const value = row[spec.field];
      if (value === null || value === undefined) {
        if (spec.optional) continue;
        record[spec.field] = null;
      } else {
        record[spec.field] = value;
      }
    }
    return record as T;
  };

  const condition = (field: string, value: unknown): SQL => {
    const column = columns[field];
    const spec = specByField.get(field);
    if (column === undefined || spec === undefined) {
      throw new TypeError(`drizzleStore ${declared.id}: unknown filter field "${field}"`);
    }
    if (value === null) return spec.optional ? sql`0` : isNull(column);
    return eq(column, value);
  };

  return Object.freeze({
    async get(id: string): Promise<T | undefined> {
      const key = validateStoreId(id);
      await init();
      const rows = await db.select().from(table).where(eq(keyColumn, key)).limit(1);
      const row = rows[0];
      return row === undefined ? undefined : decode(row as Record<string, unknown>);
    },
    async list(query?: ListQuery<T>): Promise<ListResult<T>> {
      const { filter, page, size, offset } = normalizeListQuery(query);
      const conditions = Object.entries(filter as Record<string, unknown>)
        .filter(([, value]) => value !== undefined)
        .map(([field, value]) => condition(field, value));
      const where = conditions.length === 0 ? undefined : and(...conditions);
      await init();
      const [counted] = await db.select({ total: count() }).from(table).where(where);
      if (counted === undefined)
        throw new Error(`drizzleStore ${declared.id}: count returned no row`);
      const rows = await db
        .select()
        .from(table)
        .where(where)
        .orderBy(asc(keyColumn))
        .limit(size)
        .offset(offset);
      return {
        items: rows.map((row) => decode(row as Record<string, unknown>)),
        page,
        size,
        total: counted.total,
      };
    },
    async put(record: T): Promise<T> {
      const row = encode(record);
      const updates: Record<string, unknown> = {};
      for (const spec of specs) if (!spec.key) updates[spec.field] = row[spec.field];
      await init();
      const insert = db.insert(table).values(row as never);
      const saved =
        Object.keys(updates).length === 0
          ? await insert.onConflictDoNothing({ target: keyColumn }).returning()
          : await insert
              .onConflictDoUpdate({ target: keyColumn, set: updates as never })
              .returning();
      const stored = saved[0];
      return decode((stored ?? row) as Record<string, unknown>);
    },
    async delete(id: string): Promise<boolean> {
      const key = validateStoreId(id);
      await init();
      const removed = await db
        .delete(table)
        .where(eq(keyColumn, key))
        .returning({ key: keyColumn });
      return removed.length > 0;
    },
  });
}
