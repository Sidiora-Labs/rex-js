import { beforeEach, describe, expect, it } from "vitest";
import { entity, type InferEntity } from "./entity.ts";
import {
  boolean,
  enumOf,
  id,
  integer,
  money,
  real,
  ref,
  text,
  timestamp,
} from "../schema/index.ts";
import { MAX_PAGE_SIZE, type Store } from "./store.ts";

const invalidArgument = expect.objectContaining({ name: "RexError", code: "REX329" });

export const conformanceEntity = entity("conformance-item", {
  fields: {
    id: id(),
    name: text({ min: 1 }),
    quantity: integer({ min: 0 }),
    weight: real(),
    active: boolean(),
    price: money(),
    tier: enumOf(["gold", "silver"]),
    owner: ref("account"),
    createdAt: timestamp(),
    note: text().optional(),
  },
  label: (item) => item.name,
});

export type ConformanceEntity = typeof conformanceEntity;
export type ConformanceRecord = InferEntity<ConformanceEntity>;

export type MakeStore = (
  declaration: ConformanceEntity,
) => Store<ConformanceRecord> | Promise<Store<ConformanceRecord>>;

export type MakeSeededStore = (
  declaration: ConformanceEntity,
  seed: readonly ConformanceRecord[],
) => Store<ConformanceRecord> | Promise<Store<ConformanceRecord>>;

export function conformanceRecord(
  index: number,
  overrides: Partial<ConformanceRecord> = {},
): ConformanceRecord {
  const suffix = String(index).padStart(3, "0");
  return {
    id: `item-${suffix}`,
    name: `Item ${suffix}`,
    quantity: index,
    weight: index * 0.25,
    active: index % 2 === 0,
    price: `${index}.50`,
    tier: index % 3 === 0 ? "gold" : "silver",
    owner: index % 2 === 0 ? "acc-even" : "acc-odd",
    createdAt: `2026-10-04T00:00:${String(index % 60).padStart(2, "0")}Z`,
    ...overrides,
  };
}

export function runStoreConformance(name: string, makeStore: MakeStore): void {
  runStoreQueryConformance(name, async (declaration, seed) => {
    const store = await makeStore(declaration);
    for (const record of seed) await store.put(record);
    return store;
  });
  describe(`store conformance: ${name}`, () => {
    let store: Store<ConformanceRecord>;

    beforeEach(async () => {
      store = await makeStore(conformanceEntity);
    });

    it("returns undefined for a missing id", async () => {
      expect(await store.get("item-404")).toBeUndefined();
    });

    it("stores and returns every field kind unchanged", async () => {
      const record = conformanceRecord(1, { note: "first" });
      expect(await store.put(record)).toEqual(record);
      expect(await store.get(record.id)).toEqual(record);
    });

    it("keeps an optional field absent", async () => {
      const record = conformanceRecord(2);
      await store.put(record);
      const loaded = await store.get(record.id);
      expect(loaded).toEqual(record);
      expect(loaded?.note).toBeUndefined();
    });

    it("overwrites a record with the same key", async () => {
      await store.put(conformanceRecord(3));
      const updated = conformanceRecord(3, { name: "Renamed", quantity: 99, active: true });
      await store.put(updated);
      expect(await store.get(updated.id)).toEqual(updated);
      expect((await store.list()).total).toBe(1);
    });

    it("deletes a record and reports whether it existed", async () => {
      await store.put(conformanceRecord(4));
      expect(await store.delete("item-004")).toBe(true);
      expect(await store.get("item-004")).toBeUndefined();
      expect(await store.delete("item-004")).toBe(false);
    });

    it("lists an empty store", async () => {
      expect(await store.list()).toEqual({ items: [], page: 1, size: 50, total: 0 });
    });

    it("lists in ascending key order regardless of insertion order", async () => {
      for (const index of [5, 1, 4, 2, 3]) await store.put(conformanceRecord(index));
      const result = await store.list();
      expect(result.items.map((item) => item.id)).toEqual([
        "item-001",
        "item-002",
        "item-003",
        "item-004",
        "item-005",
      ]);
      expect(result.total).toBe(5);
    });

    it("pages with page and size", async () => {
      for (let index = 1; index <= 7; index++) await store.put(conformanceRecord(index));
      const first = await store.list({ page: 1, size: 3 });
      const second = await store.list({ page: 2, size: 3 });
      const third = await store.list({ page: 3, size: 3 });
      const beyond = await store.list({ page: 4, size: 3 });
      expect(first.items.map((item) => item.quantity)).toEqual([1, 2, 3]);
      expect(second.items.map((item) => item.quantity)).toEqual([4, 5, 6]);
      expect(third.items.map((item) => item.quantity)).toEqual([7]);
      expect(beyond.items).toEqual([]);
      expect([first.total, second.total, third.total, beyond.total]).toEqual([7, 7, 7, 7]);
      expect([second.page, second.size]).toEqual([2, 3]);
    });

    it("filters by field equality across kinds", async () => {
      for (let index = 1; index <= 9; index++) await store.put(conformanceRecord(index));
      const active = await store.list({ filter: { active: true } });
      expect(active.items.map((item) => item.quantity)).toEqual([2, 4, 6, 8]);
      expect(active.total).toBe(4);
      const gold = await store.list({ filter: { tier: "gold" } });
      expect(gold.items.map((item) => item.quantity)).toEqual([3, 6, 9]);
      const combined = await store.list({ filter: { tier: "gold", owner: "acc-even" } });
      expect(combined.items.map((item) => item.quantity)).toEqual([6]);
      const byNumber = await store.list({ filter: { quantity: 5 } });
      expect(byNumber.items.map((item) => item.id)).toEqual(["item-005"]);
      const byMoney = await store.list({ filter: { price: "7.50" } });
      expect(byMoney.items.map((item) => item.id)).toEqual(["item-007"]);
      const none = await store.list({ filter: { name: "missing" } });
      expect(none).toEqual({ items: [], page: 1, size: 50, total: 0 });
    });

    it("applies paging after filtering", async () => {
      for (let index = 1; index <= 9; index++) await store.put(conformanceRecord(index));
      const page = await store.list({ filter: { active: false }, page: 2, size: 2 });
      expect(page.items.map((item) => item.quantity)).toEqual([5, 7]);
      expect(page.total).toBe(5);
    });

    it("rejects invalid paging", async () => {
      await expect(store.list({ page: 0 })).rejects.toThrow(invalidArgument);
      await expect(store.list({ page: 1.5 })).rejects.toThrow(invalidArgument);
      await expect(store.list({ size: 0 })).rejects.toThrow(invalidArgument);
      await expect(store.list({ size: MAX_PAGE_SIZE + 1 })).rejects.toThrow(invalidArgument);
    });

    it("rejects an empty id", async () => {
      await expect(store.get("")).rejects.toThrow(invalidArgument);
      await expect(store.delete("")).rejects.toThrow(invalidArgument);
    });

    it("isolates stored records from caller mutation", async () => {
      const record = conformanceRecord(8);
      const returned = await store.put(record);
      record.name = "mutated input";
      returned.name = "mutated output";
      const loaded = await store.get("item-008");
      expect(loaded?.name).toBe("Item 008");
      if (loaded) loaded.name = "mutated loaded";
      expect((await store.get("item-008"))?.name).toBe("Item 008");
      const listed = await store.list();
      const first = listed.items[0];
      if (first) first.name = "mutated listed";
      expect((await store.get("item-008"))?.name).toBe("Item 008");
    });
  });
}

function records(...indexes: readonly number[]): ConformanceRecord[] {
  return indexes.map((index) => conformanceRecord(index));
}

const ids = (result: { readonly items: readonly ConformanceRecord[] }) =>
  result.items.map((item) => item.id);

export function runStoreQueryConformance(name: string, makeSeeded: MakeSeededStore): void {
  describe(`store query conformance: ${name}`, () => {
    it("sorts by an integer, a real and a text field in both directions", async () => {
      const store = await makeSeeded(conformanceEntity, records(4, 1, 5, 2, 3));
      expect(ids(await store.list({ sort: { field: "quantity", direction: "desc" } }))).toEqual([
        "item-005",
        "item-004",
        "item-003",
        "item-002",
        "item-001",
      ]);
      expect(ids(await store.list({ sort: { field: "weight" } }))).toEqual([
        "item-001",
        "item-002",
        "item-003",
        "item-004",
        "item-005",
      ]);
      const named = await makeSeeded(conformanceEntity, [
        conformanceRecord(1, { name: "beta" }),
        conformanceRecord(2, { name: "Alpha" }),
        conformanceRecord(3, { name: "alpha" }),
        conformanceRecord(4, { name: "\u00e9t\u00e9" }),
      ]);
      expect(ids(await named.list({ sort: { field: "name", direction: "asc" } }))).toEqual([
        "item-002",
        "item-003",
        "item-001",
        "item-004",
      ]);
      expect(ids(await named.list({ sort: { field: "name", direction: "desc" } }))).toEqual([
        "item-004",
        "item-001",
        "item-003",
        "item-002",
      ]);
    });

    it("sorts timestamps by instant and money by amount, not by their text", async () => {
      const store = await makeSeeded(conformanceEntity, [
        conformanceRecord(1, { createdAt: "2026-10-04T00:00:01Z", price: "10.00" }),
        conformanceRecord(2, { createdAt: "2026-10-04T00:00:00.500Z", price: "9.5" }),
        conformanceRecord(3, { createdAt: "2026-10-04T00:00:00Z", price: "100" }),
      ]);
      expect(ids(await store.list({ sort: { field: "createdAt" } }))).toEqual([
        "item-003",
        "item-002",
        "item-001",
      ]);
      expect(ids(await store.list({ sort: { field: "price", direction: "desc" } }))).toEqual([
        "item-003",
        "item-001",
        "item-002",
      ]);
    });

    it("breaks sort ties by ascending key and places absent values first ascending, last descending", async () => {
      const store = await makeSeeded(conformanceEntity, [
        conformanceRecord(3, { tier: "gold", note: "b" }),
        conformanceRecord(1, { tier: "gold" }),
        conformanceRecord(2, { tier: "silver", note: "a" }),
        conformanceRecord(4, { tier: "silver" }),
      ]);
      expect(ids(await store.list({ sort: { field: "tier", direction: "desc" } }))).toEqual([
        "item-002",
        "item-004",
        "item-001",
        "item-003",
      ]);
      expect(ids(await store.list({ sort: { field: "note" } }))).toEqual([
        "item-001",
        "item-004",
        "item-002",
        "item-003",
      ]);
      expect(ids(await store.list({ sort: { field: "note", direction: "desc" } }))).toEqual([
        "item-003",
        "item-002",
        "item-001",
        "item-004",
      ]);
    });

    it("filters integer and real fields by range", async () => {
      const store = await makeSeeded(conformanceEntity, records(1, 2, 3, 4, 5, 6, 7, 8, 9));
      const between = await store.list({ filter: { quantity: { gte: 3, lt: 7 } } });
      expect(ids(between)).toEqual(["item-003", "item-004", "item-005", "item-006"]);
      expect(between.total).toBe(4);
      expect(ids(await store.list({ filter: { quantity: { gt: 7 } } }))).toEqual([
        "item-008",
        "item-009",
      ]);
      expect(ids(await store.list({ filter: { quantity: { lte: 2 } } }))).toEqual([
        "item-001",
        "item-002",
      ]);
      expect(ids(await store.list({ filter: { weight: { gt: 1.5, lte: 2 } } }))).toEqual([
        "item-007",
        "item-008",
      ]);
      expect(ids(await store.list({ filter: { weight: { lt: 0.5 } } }))).toEqual(["item-001"]);
    });

    it("filters timestamps by instant and text by code point order", async () => {
      const store = await makeSeeded(conformanceEntity, [
        conformanceRecord(1, { createdAt: "2026-10-04T00:00:00Z", name: "apple" }),
        conformanceRecord(2, { createdAt: "2026-10-04T00:00:00.500Z", name: "banana" }),
        conformanceRecord(3, { createdAt: "2026-10-04T00:00:01Z", name: "cherry" }),
        conformanceRecord(4, { createdAt: "2026-10-05T00:00:00Z", name: "Date" }),
      ]);
      expect(
        ids(await store.list({ filter: { createdAt: { gt: "2026-10-04T00:00:00Z" } } })),
      ).toEqual(["item-002", "item-003", "item-004"]);
      expect(
        ids(
          await store.list({
            filter: { createdAt: { gte: "2026-10-04T00:00:00.5Z", lt: "2026-10-05T00:00:00Z" } },
          }),
        ),
      ).toEqual(["item-002", "item-003"]);
      expect(ids(await store.list({ filter: { name: { gte: "b", lt: "c" } } }))).toEqual([
        "item-002",
      ]);
      expect(ids(await store.list({ filter: { name: { lt: "a" } } }))).toEqual(["item-004"]);
    });

    it("filters by membership with in", async () => {
      const store = await makeSeeded(conformanceEntity, records(1, 2, 3, 4, 5, 6));
      expect(ids(await store.list({ filter: { quantity: { in: [2, 5, 40] } } }))).toEqual([
        "item-002",
        "item-005",
      ]);
      expect(ids(await store.list({ filter: { name: { in: ["Item 003", "Item 006"] } } }))).toEqual(
        ["item-003", "item-006"],
      );
      expect(
        ids(
          await store.list({
            filter: { createdAt: { in: ["2026-10-04T00:00:01.000Z", "2026-10-04T00:00:04Z"] } },
          }),
        ),
      ).toEqual(["item-001", "item-004"]);
      expect(await store.list({ filter: { quantity: { in: [] } } })).toEqual({
        items: [],
        page: 1,
        size: 50,
        total: 0,
      });
    });

    it("excludes absent values from a range and combines ranges, equality, sort and paging", async () => {
      const store = await makeSeeded(conformanceEntity, [
        ...records(1, 2, 3, 4, 5, 6, 7, 8),
        conformanceRecord(9, { note: "kept" }),
        conformanceRecord(10, { note: "also" }),
      ]);
      expect(ids(await store.list({ filter: { note: { gte: "" } } }))).toEqual([
        "item-009",
        "item-010",
      ]);
      const query = {
        filter: { active: true, quantity: { gte: 2, lte: 8 } },
        sort: { field: "quantity", direction: "desc" },
      } as const;
      const first = await store.list({ ...query, page: 1, size: 3 });
      const second = await store.list({ ...query, page: 2, size: 3 });
      expect(ids(first)).toEqual(["item-008", "item-006", "item-004"]);
      expect(ids(second)).toEqual(["item-002"]);
      expect([first.total, second.total]).toEqual([4, 4]);
    });

    it("rejects malformed sorts and range filters", async () => {
      const store = await makeSeeded(conformanceEntity, records(1));
      const unknownField = expect.objectContaining({ name: "RexError", code: "REX305" });
      const cases: unknown[] = [
        { sort: { field: "quantity", direction: "up" } },
        { sort: { direction: "asc" } },
        { sort: "quantity" },
        { filter: { quantity: { between: [1, 2] } } },
        { filter: { quantity: {} } },
        { filter: { quantity: { in: 3 } } },
        { filter: { quantity: { gt: "3" } } },
        { filter: { weight: { lt: Number.NaN } } },
        { filter: { createdAt: { gt: "yesterday" } } },
        { filter: { name: { lt: 3 } } },
        { filter: { active: { gt: false } } },
        { filter: { price: { gt: "1.00" } } },
        { filter: { tier: { in: ["gold"] } } },
      ];
      for (const query of cases) {
        await expect(store.list(query as never), JSON.stringify(query)).rejects.toThrow(
          invalidArgument,
        );
      }
      await expect(store.list({ sort: { field: "missing" } } as never)).rejects.toThrow(
        unknownField,
      );
      await expect(store.list({ filter: { missing: { gt: 1 } } } as never)).rejects.toThrow(
        unknownField,
      );
    });
  });
}
