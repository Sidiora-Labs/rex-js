import type { AnyEntity, InferEntity } from "./entity.ts";

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 500;

export type StoreRecord = { readonly [field: string]: unknown };

export type StoreFilter<T> = { readonly [P in keyof T]?: T[P] };

export interface ListQuery<T> {
  readonly filter?: StoreFilter<T>;
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

export interface NormalizedListQuery<T> {
  readonly filter: StoreFilter<T>;
  readonly page: number;
  readonly size: number;
  readonly offset: number;
}

export function normalizeListQuery<T>(query: ListQuery<T> = {}): NormalizedListQuery<T> {
  const page = query.page ?? 1;
  const size = query.size ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(page) || page < 1) {
    throw new RangeError(`list: page must be an integer of at least 1, received ${String(page)}`);
  }
  if (!Number.isInteger(size) || size < 1 || size > MAX_PAGE_SIZE) {
    throw new RangeError(
      `list: size must be an integer from 1 to ${MAX_PAGE_SIZE}, received ${String(size)}`,
    );
  }
  return { filter: query.filter ?? {}, page, size, offset: (page - 1) * size };
}

export function matchesFilter<T>(record: T, filter: StoreFilter<T>): boolean {
  for (const field of Object.keys(filter) as (keyof T)[]) {
    const expected = filter[field];
    if (expected === undefined) continue;
    if (!Object.is(record[field], expected)) return false;
  }
  return true;
}

export function validateStoreId(id: unknown): string {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError(`store: id must be a non-empty string, received ${JSON.stringify(id)}`);
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
      const filter = query?.filter;
      if (filter !== undefined) {
        for (const field of Object.keys(filter)) {
          if (!(field in entity.fields)) {
            throw new TypeError(`store ${entity.id}: unknown filter field "${field}"`);
          }
        }
      }
      return store.list(query);
    },
    put: async (record: InferEntity<E>) => store.put(entity.parse(record) as InferEntity<E>),
    delete: async (id: string) => store.delete(validateStoreId(id)),
  });
}
