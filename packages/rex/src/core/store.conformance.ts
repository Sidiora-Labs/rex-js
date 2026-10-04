import { beforeEach, describe, expect, it } from "vitest";
import { entity, type InferEntity } from "./entity.ts";
import { boolean, enumOf, id, integer, money, ref, text, timestamp } from "../schema/index.ts";
import { MAX_PAGE_SIZE, type Store } from "./store.ts";

export const conformanceEntity = entity("conformance-item", {
  fields: {
    id: id(),
    name: text({ min: 1 }),
    quantity: integer({ min: 0 }),
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

export function conformanceRecord(
  index: number,
  overrides: Partial<ConformanceRecord> = {},
): ConformanceRecord {
  const suffix = String(index).padStart(3, "0");
  return {
    id: `item-${suffix}`,
    name: `Item ${suffix}`,
    quantity: index,
    active: index % 2 === 0,
    price: `${index}.50`,
    tier: index % 3 === 0 ? "gold" : "silver",
    owner: index % 2 === 0 ? "acc-even" : "acc-odd",
    createdAt: `2026-10-04T00:00:${String(index % 60).padStart(2, "0")}Z`,
    ...overrides,
  };
}

export function runStoreConformance(name: string, makeStore: MakeStore): void {
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
      await expect(store.list({ page: 0 })).rejects.toThrow(RangeError);
      await expect(store.list({ page: 1.5 })).rejects.toThrow(RangeError);
      await expect(store.list({ size: 0 })).rejects.toThrow(RangeError);
      await expect(store.list({ size: MAX_PAGE_SIZE + 1 })).rejects.toThrow(RangeError);
    });

    it("rejects an empty id", async () => {
      await expect(store.get("")).rejects.toThrow(TypeError);
      await expect(store.delete("")).rejects.toThrow(TypeError);
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
