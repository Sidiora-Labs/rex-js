import { describe, expect, it } from "vitest";
import { entity } from "./entity.ts";
import { id, integer, text } from "./schema.ts";
import { bind } from "./store.ts";
import { memoryStore } from "./store.memory.ts";
import { conformanceEntity, conformanceRecord, runStoreConformance } from "./store.conformance.ts";

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
