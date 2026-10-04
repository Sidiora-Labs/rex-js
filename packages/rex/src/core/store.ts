import type { AnyEntity, InferEntity } from "./entity.ts";
import { RexError } from "./errors.ts";
import type { FieldKind } from "./schema.ts";

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 500;

export type StoreRecord = { readonly [field: string]: unknown };

export type FieldKinds = Readonly<Record<string, FieldKind | undefined>>;

export const SORT_DIRECTIONS = ["asc", "desc"] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export const RANGE_OPERATORS = ["lt", "lte", "gt", "gte", "in"] as const;
export type RangeOperator = (typeof RANGE_OPERATORS)[number];

export const RANGE_FIELD_KINDS: readonly FieldKind[] = ["integer", "real", "timestamp", "text"];
export const SORT_FIELD_KINDS: readonly FieldKind[] = [
  "id",
  "text",
  "money",
  "integer",
  "real",
  "boolean",
  "enum",
  "ref",
  "timestamp",
];

export interface RangeFilter<V> {
  readonly lt?: V;
  readonly lte?: V;
  readonly gt?: V;
  readonly gte?: V;
  readonly in?: readonly V[];
}

export type StoreFilter<T> = {
  readonly [P in keyof T]?: T[P] | RangeFilter<NonNullable<T[P]>>;
};

export interface ListSort<T> {
  readonly field: keyof T & string;
  readonly direction?: SortDirection;
}

export interface ListQuery<T> {
  readonly filter?: StoreFilter<T>;
  readonly sort?: ListSort<T>;
  readonly page?: number;
  readonly size?: number;
}

export interface ListResult<T> {
  readonly items: T[];
  readonly page: number;
  readonly size: number;
  readonly total: number;
}

export interface Store<T> {
  get(id: string): Promise<T | undefined>;
  list(query?: ListQuery<T>): Promise<ListResult<T>>;
  put(record: T): Promise<T>;
  delete(id: string): Promise<boolean>;
}

export type StoreCondition =
  | { readonly field: string; readonly op: "eq"; readonly value: unknown }
  | { readonly field: string; readonly op: Exclude<RangeOperator, "in">; readonly value: unknown }
  | { readonly field: string; readonly op: "in"; readonly value: readonly unknown[] };

export interface NormalizedSort {
  readonly field: string;
  readonly direction: SortDirection;
}

export interface NormalizedListQuery<T> {
  readonly filter: StoreFilter<T>;
  readonly conditions: readonly StoreCondition[];
  readonly sort: NormalizedSort | null;
  readonly page: number;
  readonly size: number;
  readonly offset: number;
}

function invalid(message: string): RexError {
  return new RexError("REX329", `list: ${message}`);
}

function unknownField(entity: string | undefined, role: "filter" | "sort", field: string) {
  return new RexError(
    "REX305",
    `store${entity === undefined ? "" : ` ${entity}`}: unknown ${role} field "${field}"`,
  );
}

function knownField(
  kinds: FieldKinds | undefined,
  field: string,
  entity: string | undefined,
  role: "filter" | "sort",
): FieldKind | undefined {
  if (kinds !== undefined && !Object.hasOwn(kinds, field)) throw unknownField(entity, role, field);
  return kinds?.[field];
}

function isOperatorObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function validOperand(kind: FieldKind | undefined, value: unknown): boolean {
  if (kind === "integer" || kind === "real")
    return typeof value === "number" && Number.isFinite(value);
  if (kind === "timestamp") return typeof value === "string" && !Number.isNaN(Date.parse(value));
  if (kind === "text") return typeof value === "string";
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value));
}

function rangeConditions(
  field: string,
  operators: Readonly<Record<string, unknown>>,
  kind: FieldKind | undefined,
  checked: boolean,
): StoreCondition[] {
  if (checked && (kind === undefined || !RANGE_FIELD_KINDS.includes(kind))) {
    throw invalid(
      `field "${field}" (${kind ?? "no field kind"}) takes no range filter; range filters apply to ${RANGE_FIELD_KINDS.join(", ")} fields`,
    );
  }
  const names = Object.keys(operators);
  if (names.length === 0) throw invalid(`the filter of "${field}" names no operator`);
  return names.map((op): StoreCondition => {
    if (!(RANGE_OPERATORS as readonly string[]).includes(op)) {
      throw invalid(`unknown operator "${op}" on "${field}"; use ${RANGE_OPERATORS.join(", ")}`);
    }
    const value = operators[op];
    const operands = op === "in" ? value : [value];
    if (!Array.isArray(operands)) throw invalid(`"${field}".in must be a list of values`);
    for (const operand of operands) {
      if (!validOperand(kind, operand)) {
        throw invalid(
          `"${field}".${op} received ${JSON.stringify(operand)}, which is not a ${kind ?? "string or number"} value`,
        );
      }
    }
    return op === "in"
      ? { field, op, value: Object.freeze([...(operands as unknown[])]) }
      : { field, op: op as Exclude<RangeOperator, "in">, value };
  });
}

export function filterConditions(
  filter: Readonly<Record<string, unknown>>,
  kinds?: FieldKinds,
  entity?: string,
): readonly StoreCondition[] {
  const conditions: StoreCondition[] = [];
  for (const [field, value] of Object.entries(filter)) {
    if (value === undefined) continue;
    const kind = knownField(kinds, field, entity, "filter");
    if (isOperatorObject(value)) {
      conditions.push(...rangeConditions(field, value, kind, kinds !== undefined));
    } else {
      conditions.push({ field, op: "eq", value });
    }
  }
  return conditions;
}

function normalizeSort(
  sort: unknown,
  kinds: FieldKinds | undefined,
  entity: string | undefined,
): NormalizedSort | null {
  if (sort === undefined) return null;
  if (!isOperatorObject(sort) || typeof sort.field !== "string" || sort.field === "") {
    throw invalid("sort must be { field, direction } naming a field");
  }
  const direction = sort.direction ?? "asc";
  if (!(SORT_DIRECTIONS as readonly unknown[]).includes(direction)) {
    throw invalid(`sort direction must be asc or desc, received ${JSON.stringify(direction)}`);
  }
  const kind = knownField(kinds, sort.field, entity, "sort");
  if (kinds !== undefined && (kind === undefined || !SORT_FIELD_KINDS.includes(kind))) {
    throw invalid(
      `field "${sort.field}" (${kind ?? "no field kind"}) cannot be sorted; sort applies to ${SORT_FIELD_KINDS.join(", ")} fields`,
    );
  }
  return { field: sort.field, direction: direction as SortDirection };
}

export function normalizeListQuery<T>(
  query: ListQuery<T> = {},
  kinds?: FieldKinds,
  entity?: string,
): NormalizedListQuery<T> {
  const page = query.page ?? 1;
  const size = query.size ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(page) || page < 1) {
    throw invalid(`page must be an integer of at least 1, received ${String(page)}`);
  }
  if (!Number.isInteger(size) || size < 1 || size > MAX_PAGE_SIZE) {
    throw invalid(`size must be an integer from 1 to ${MAX_PAGE_SIZE}, received ${String(size)}`);
  }
  const filter = query.filter ?? {};
  return {
    filter,
    conditions: filterConditions(filter as Readonly<Record<string, unknown>>, kinds, entity),
    sort: normalizeSort(query.sort, kinds, entity),
    page,
    size,
    offset: (page - 1) * size,
  };
}

function compareText(a: string, b: string): number {
  const left = a[Symbol.iterator]();
  const right = b[Symbol.iterator]();
  for (;;) {
    const x = left.next();
    const y = right.next();
    if (x.done === true || y.done === true) return x.done === y.done ? 0 : x.done === true ? -1 : 1;
    const delta = (x.value.codePointAt(0) as number) - (y.value.codePointAt(0) as number);
    if (delta !== 0) return delta < 0 ? -1 : 1;
  }
}

function numberOf(kind: FieldKind | undefined, value: unknown): number | null {
  if (kind === "integer" || kind === "real") return typeof value === "number" ? value : null;
  if (kind === "money") return Number(value);
  if (kind === "timestamp") return Date.parse(String(value));
  if (kind === "boolean") return value === true ? 1 : 0;
  return null;
}

export function compareFieldValues(kind: FieldKind | undefined, a: unknown, b: unknown): number {
  const missingA = a === undefined || a === null;
  const missingB = b === undefined || b === null;
  if (missingA || missingB) return missingA === missingB ? 0 : missingA ? -1 : 1;
  const x = numberOf(kind, a);
  const y = numberOf(kind, b);
  if (x !== null && y !== null) return x === y ? 0 : x < y ? -1 : 1;
  return compareText(String(a), String(b));
}

export function matchesCondition(
  record: unknown,
  condition: StoreCondition,
  kind: FieldKind | undefined,
): boolean {
  const value = (record as Readonly<Record<string, unknown>>)[condition.field];
  if (condition.op === "eq") return Object.is(value, condition.value);
  if (value === undefined || value === null) return false;
  if (condition.op === "in") {
    return condition.value.some((operand) => compareFieldValues(kind, value, operand) === 0);
  }
  const order = compareFieldValues(kind, value, condition.value);
  switch (condition.op) {
    case "lt":
      return order < 0;
    case "lte":
      return order <= 0;
    case "gt":
      return order > 0;
    case "gte":
      return order >= 0;
  }
}

export function matchesFilter<T>(record: T, filter: StoreFilter<T>, kinds?: FieldKinds): boolean {
  return filterConditions(filter as Readonly<Record<string, unknown>>, kinds).every((condition) =>
    matchesCondition(record, condition, kinds?.[condition.field]),
  );
}

export function validateStoreId(id: unknown): string {
  if (typeof id !== "string" || id.length === 0) {
    throw new RexError(
      "REX329",
      `store: id must be a non-empty string, received ${JSON.stringify(id)}`,
    );
  }
  return id;
}

export interface EntityStore<E extends AnyEntity> extends Store<InferEntity<E>> {
  readonly entity: E;
}

export function bind<E extends AnyEntity>(entity: E, store: Store<InferEntity<E>>): EntityStore<E> {
  return Object.freeze({
    entity,
    get: async (id: string) => store.get(validateStoreId(id)),
    list: async (query?: ListQuery<InferEntity<E>>) => {
      for (const field of Object.keys(query?.filter ?? {})) {
        if (!Object.hasOwn(entity.fields, field)) throw unknownField(entity.id, "filter", field);
      }
      const sorted = query?.sort?.field;
      if (sorted !== undefined && !Object.hasOwn(entity.fields, sorted)) {
        throw unknownField(entity.id, "sort", sorted);
      }
      return store.list(query);
    },
    put: async (record: InferEntity<E>) => store.put(entity.parse(record) as InferEntity<E>),
    delete: async (id: string) => store.delete(validateStoreId(id)),
  });
}
