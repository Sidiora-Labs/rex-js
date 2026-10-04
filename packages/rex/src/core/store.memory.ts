import type { AnyEntity, InferEntity } from "./entity.ts";
import {
  compareFieldValues,
  matchesCondition,
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
      const { conditions, sort, page, size, offset } = normalizeListQuery(
        query,
        entity.fieldKinds,
        entity.id,
      );
      const matching = [...records.keys()]
        .sort()
        .map((key) => records.get(key) as T)
        .filter((record) =>
          conditions.every((condition) =>
            matchesCondition(record, condition, entity.fieldKinds[condition.field]),
          ),
        );
      if (sort !== null) {
        const kind = entity.fieldKinds[sort.field];
        const sign = sort.direction === "desc" ? -1 : 1;
        const field = (record: T) => (record as Readonly<Record<string, unknown>>)[sort.field];
        matching.sort((a, b) => sign * compareFieldValues(kind, field(a), field(b)));
      }
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
