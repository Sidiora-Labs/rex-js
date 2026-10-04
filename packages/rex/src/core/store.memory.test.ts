import { describe, expect, it } from "vitest";
import { entity } from "./entity.ts";
import { id, integer, text } from "../schema/index.ts";
import {
  RANGE_FIELD_KINDS,
  SORT_FIELD_KINDS,
  bind,
  compareFieldValues,
  filterConditions,
  matchesFilter,
  normalizeListQuery,
} from "./store.ts";
import { memoryStore } from "./store.memory.ts";
import {
  conformanceEntity,
  conformanceRecord,
  runStoreConformance,
  type ConformanceRecord,
} from "./store.conformance.ts";

interface Doc {
  readonly id: string;
  readonly payload: unknown;
}

runStoreConformance("memory", (declaration) => memoryStore(declaration));

describe("memoryStore", () => {
  it("starts from a seed keyed by the entity key", async () => {
    const store = memoryStore(conformanceEntity, [conformanceRecord(2), conformanceRecord(1)]);
    expect((await store.list()).items.map((item) => item.id)).toEqual(["item-001", "item-002"]);
  });

  it("keys records by a custom key field", async () => {
    const token = entity("token", {
      fields: { symbol: text({ min: 1 }), decimals: integer() },
      key: "symbol",
      label: (record) => record.symbol,
    });
    const store = memoryStore(token, [{ symbol: "PAX", decimals: 18 }]);
    expect(await store.get("PAX")).toEqual({ symbol: "PAX", decimals: 18 });
    expect(await store.delete("PAX")).toBe(true);
  });
});

describe("bind", () => {
  const account = entity("account", {
    fields: { id: id(), name: text({ min: 1 }), balance: integer({ min: 0 }) },
    label: (record) => record.name,
  });

  it("validates records on put against the entity schema", async () => {
    const store = bind(account, memoryStore(account));
    await expect(store.put({ id: "acc-1", name: "Main", balance: -1 } as never)).rejects.toThrow(
      "balance",
    );
    await expect(store.put({ id: "acc-1", name: "", balance: 1 })).rejects.toThrow("name");
    expect(await store.list()).toEqual({ items: [], page: 1, size: 50, total: 0 });
  });

  it("strips unknown properties and stores the parsed record", async () => {
    const store = bind(account, memoryStore(account));
    const saved = await store.put({ id: "acc-1", name: "Main", balance: 5, extra: true } as never);
    expect(saved).toEqual({ id: "acc-1", name: "Main", balance: 5 });
    expect(await store.get("acc-1")).toEqual({ id: "acc-1", name: "Main", balance: 5 });
  });

  it("rejects unknown filter fields and empty ids", async () => {
    const store = bind(account, memoryStore(account));
    await expect(store.list({ filter: { nope: 1 } as never })).rejects.toThrow(
      'unknown filter field "nope"',
    );
    const invalidArgument = expect.objectContaining({ name: "RexError", code: "REX329" });
    await expect(store.get("")).rejects.toThrow(invalidArgument);
    await expect(store.delete("")).rejects.toThrow(invalidArgument);
    expect(store.entity).toBe(account);
    expect(Object.isFrozen(store)).toBe(true);
  });
});

describe("list queries", () => {
  const invalidArgument = expect.objectContaining({ name: "RexError", code: "REX329" });

  it("normalizes a filter into equality and range conditions and a sort", () => {
    const normalized = normalizeListQuery<ConformanceRecord>(
      {
        filter: { quantity: { gte: 2, lt: 5 }, active: true, note: undefined, tier: "gold" },
        sort: { field: "quantity", direction: "desc" },
        page: 2,
        size: 10,
      },
      conformanceEntity.fieldKinds,
      conformanceEntity.id,
    );
    expect(normalized.conditions).toEqual([
      { field: "quantity", op: "gte", value: 2 },
      { field: "quantity", op: "lt", value: 5 },
      { field: "active", op: "eq", value: true },
      { field: "tier", op: "eq", value: "gold" },
    ]);
    expect(normalized.sort).toEqual({ field: "quantity", direction: "desc" });
    expect([normalized.page, normalized.size, normalized.offset]).toEqual([2, 10, 10]);
    expect(normalizeListQuery<{ name: string }>({ sort: { field: "name" } }).sort).toEqual({
      field: "name",
      direction: "asc",
    });
    expect(normalizeListQuery().sort).toBeNull();
  });

  it("validates operators and operands without field kinds and kinds with them", () => {
    expect(filterConditions({ anything: { in: ["a", 2] } })).toEqual([
      { field: "anything", op: "in", value: ["a", 2] },
    ]);
    expect(() => filterConditions({ anything: { in: [true] } })).toThrow(invalidArgument);
    expect(() => filterConditions({ anything: { near: 1 } })).toThrow(
      'list: unknown operator "near" on "anything"; use lt, lte, gt, gte, in',
    );
    expect(() => filterConditions({ active: { gt: false } }, conformanceEntity.fieldKinds)).toThrow(
      'list: field "active" (boolean) takes no range filter; range filters apply to integer, real, timestamp, text fields',
    );
    expect(() =>
      normalizeListQuery<Doc>({ sort: { field: "id" } }, { id: "id", payload: "json" }),
    ).not.toThrow();
    expect(() =>
      normalizeListQuery<Doc>({ sort: { field: "payload" } }, { id: "id", payload: "json" }),
    ).toThrow('list: field "payload" (json) cannot be sorted');
    expect(() =>
      normalizeListQuery<{ x: string }>({ sort: { field: "x" } }, { id: "id" }, "thing"),
    ).toThrow('store thing: unknown sort field "x"');
    expect(RANGE_FIELD_KINDS).toEqual(["integer", "real", "timestamp", "text"]);
    expect(SORT_FIELD_KINDS).not.toContain("json");
    expect(SORT_FIELD_KINDS).not.toContain("markdown");
  });

  it("compares values by field kind with absent values first", () => {
    expect(compareFieldValues("integer", 2, 10)).toBe(-1);
    expect(compareFieldValues("text", "2", "10")).toBe(1);
    expect(compareFieldValues("money", "9.5", "10.00")).toBe(-1);
    expect(compareFieldValues("timestamp", "2026-10-04T00:00:00.5Z", "2026-10-04T00:00:00Z")).toBe(
      1,
    );
    expect(compareFieldValues("boolean", false, true)).toBe(-1);
    expect(compareFieldValues("text", "\u{1F600}", "\uFFFD")).toBe(1);
    expect(compareFieldValues("text", undefined, "")).toBe(-1);
    expect(compareFieldValues("real", null, undefined)).toBe(0);
    expect(compareFieldValues("enum", "gold", "gold")).toBe(0);
  });

  it("matches a record against equality and range filters", () => {
    const record = conformanceRecord(4);
    const kinds = conformanceEntity.fieldKinds;
    expect(matchesFilter(record, { quantity: { gt: 3, lte: 4 }, tier: "silver" }, kinds)).toBe(
      true,
    );
    expect(matchesFilter(record, { quantity: { in: [1, 2] } }, kinds)).toBe(false);
    expect(matchesFilter(record, { note: { gte: "" } }, kinds)).toBe(false);
    expect(matchesFilter(record, { createdAt: { lt: "2026-10-04T00:00:04.001Z" } }, kinds)).toBe(
      true,
    );
  });

  it("is rejected by bind for an undeclared sort field", async () => {
    const store = bind(conformanceEntity, memoryStore(conformanceEntity));
    await expect(store.list({ sort: { field: "nope" } } as never)).rejects.toThrow(
      'store conformance-item: unknown sort field "nope"',
    );
    await expect(store.list({ sort: { field: "nope" } } as never)).rejects.toThrow(
      expect.objectContaining({ name: "RexError", code: "REX305" }),
    );
    await store.put(conformanceRecord(1));
    expect((await store.list({ sort: { field: "weight", direction: "desc" } })).total).toBe(1);
  });
});
