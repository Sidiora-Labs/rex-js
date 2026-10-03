import type { AnyEntity, InferEntity } from "./entity.ts";
import {
  matchesFilter,
  normalizeListQuery,
  validateStoreId,
  type ListQuery,
  type ListResult,
  type Store,
} from "./store.ts";

export function memoryStore<E extends AnyEntity>(
  entity: E,
  seed: readonly InferEntity<E>[] = [],
): Store<InferEntity<E>> {
  type T = InferEntity<E>;
  const records = new Map<string, T>();
  const keyOf = (record: T): string => entity.keyOf(record as never);

  for (const record of seed) records.set(keyOf(record), structuredClone(record));

  return Object.freeze({
    async get(id: string): Promise<T | undefined> {
      const record = records.get(validateStoreId(id));
      return record === undefined ? undefined : structuredClone(record);
    },
    async list(query?: ListQuery<T>): Promise<ListResult<T>> {
      const { filter, page, size, offset } = normalizeListQuery(query);
      const matching = [...records.keys()]
        .sort()
        .map((key) => records.get(key) as T)
        .filter((record) => matchesFilter(record, filter));
      return {
        items: matching.slice(offset, offset + size).map((record) => structuredClone(record)),
        page,
        size,
        total: matching.length,
      };
    },
    async put(record: T): Promise<T> {
      const copy = structuredClone(record);
      records.set(keyOf(copy), copy);
      return structuredClone(copy);
    },
    async delete(id: string): Promise<boolean> {
      return records.delete(validateStoreId(id));
    },
  });
}
