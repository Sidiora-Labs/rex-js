import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it } from "vitest";
import { entity } from "../core/entity.ts";
import { boolean, id, integer, json, real, text } from "../schema/index.ts";
import { z } from "zod/mini";
import { bind } from "../core/store.ts";
import {
  conformanceEntity,
  conformanceRecord,
  runStoreConformance,
} from "../core/store.conformance.ts";
import { columnSpecs, createTableStatement, drizzleStore, tableNameFor } from "./drizzle.ts";

function memoryDb() {
  return drizzle(createClient({ url: ":memory:" }));
}

runStoreConformance("drizzle libsql", (declaration) => drizzleStore(declaration, memoryDb()));

describe("drizzleStore", () => {
  it("maps entity fields to a sqlite table definition", () => {
    expect(tableNameFor(conformanceEntity)).toBe("conformance_item");
    expect(createTableStatement(conformanceEntity)).toBe(
      'CREATE TABLE IF NOT EXISTS "conformance_item" (' +
        '"id" text PRIMARY KEY NOT NULL, "name" text NOT NULL, "quantity" integer NOT NULL, ' +
        '"active" integer NOT NULL, "price" text NOT NULL, "tier" text NOT NULL, ' +
        '"owner" text NOT NULL, "createdAt" text NOT NULL, "note" text)',
    );
    expect(columnSpecs(conformanceEntity).map((spec) => [spec.field, spec.type])).toEqual([
      ["id", "text"],
      ["name", "text"],
      ["quantity", "integer"],
      ["active", "boolean"],
      ["price", "text"],
      ["tier", "text"],
      ["owner", "text"],
      ["createdAt", "text"],
      ["note", "text"],
    ]);
  });

  it("persists records in the database shared by store instances", async () => {
    const db = memoryDb();
    await drizzleStore(conformanceEntity, db).put(conformanceRecord(1));
    const again = drizzleStore(conformanceEntity, db);
    expect(await again.get("item-001")).toEqual(conformanceRecord(1));
    const rows = await db.$client.execute('SELECT "active", "price" FROM "conformance_item"');
    expect(rows.rows.map((row) => [row.active, row.price])).toEqual([[0, "1.50"]]);
  });

  it("keys records by a custom key field", async () => {
    const token = entity("token", {
      fields: { symbol: text({ min: 1 }), decimals: integer() },
      key: "symbol",
      label: (record) => record.symbol,
    });
    const store = drizzleStore(token, memoryDb());
    await store.put({ symbol: "PAX", decimals: 18 });
    expect(await store.get("PAX")).toEqual({ symbol: "PAX", decimals: 18 });
    expect(await store.delete("PAX")).toBe(true);
    expect(await store.get("PAX")).toBeUndefined();
  });

  it("stores nullable, plain number and structured fields", async () => {
    const profile = entity("profile.settings", {
      fields: {
        id: id(),
        nickname: z.nullable(z.string()),
        score: z.number(),
        tags: z.array(z.string()),
        prefs: z.object({ dust: boolean(), theme: z.enum(["light", "dark"]) }),
      },
      label: (record) => record.id,
    });
    expect(tableNameFor(profile)).toBe("profile_settings");
    expect(columnSpecs(profile).map((spec) => spec.type)).toEqual([
      "text",
      "text",
      "real",
      "json",
      "json",
    ]);
    const store = bind(profile, drizzleStore(profile, memoryDb()));
    const record = {
      id: "p-1",
      nickname: null,
      score: 2.5,
      tags: ["a", "b"],
      prefs: { dust: true, theme: "dark" as const },
    };
    expect(await store.put(record)).toEqual(record);
    expect(await store.get("p-1")).toEqual(record);
    expect((await store.list({ filter: { nickname: null } })).total).toBe(1);
    expect((await store.list({ filter: { score: 2.5 } })).total).toBe(1);
  });

  it("stores real and json field kinds in real and json columns", async () => {
    const reading = entity("reading", {
      fields: {
        id: id(),
        value: real({ min: 0 }),
        ratio: real().optional(),
        payload: json(),
      },
      label: (record) => record.id,
    });
    expect(columnSpecs(reading).map((spec) => [spec.field, spec.type])).toEqual([
      ["id", "text"],
      ["value", "real"],
      ["ratio", "real"],
      ["payload", "json"],
    ]);
    expect(createTableStatement(reading)).toBe(
      'CREATE TABLE IF NOT EXISTS "reading" (' +
        '"id" text PRIMARY KEY NOT NULL, "value" real NOT NULL, "ratio" real, "payload" text)',
    );
    const db = memoryDb();
    const store = bind(reading, drizzleStore(reading, db));
    const record = {
      id: "r-1",
      value: 2.75,
      payload: { tags: ["a"], nested: { on: true, count: 3, none: null } },
    };
    expect(await store.put(record)).toEqual(record);
    expect(await store.get("r-1")).toEqual(record);
    expect((await store.list({ filter: { value: 2.75 } })).total).toBe(1);
    const rows = await db.$client.execute('SELECT "value", "payload" FROM "reading"');
    expect(rows.rows.map((row) => [row.value, JSON.parse(String(row.payload))])).toEqual([
      [2.75, record.payload],
    ]);
  });

  it("refuses fields that are both optional and nullable", () => {
    const ambiguous = entity("ambiguous", {
      fields: { id: id(), note: z.optional(z.nullable(z.string())) },
      label: (record) => record.id,
    });
    expect(() => drizzleStore(ambiguous, memoryDb())).toThrow("both optional and nullable");
  });

  it("rejects unknown filter fields", async () => {
    const store = drizzleStore(conformanceEntity, memoryDb());
    await expect(store.list({ filter: { nope: 1 } as never })).rejects.toThrow(
      'unknown filter field "nope"',
    );
  });

  it("uses an existing table when createTable is false", async () => {
    const db = memoryDb();
    const missing = drizzleStore(conformanceEntity, db, { createTable: false, table: "items" });
    await expect(missing.get("item-001")).rejects.toThrow();
    await db.run(createTableStatement(conformanceEntity, "items"));
    await missing.put(conformanceRecord(2));
    expect((await missing.list()).items).toEqual([conformanceRecord(2)]);
    expect(() => drizzleStore(conformanceEntity, db, { table: "Bad-Name" })).toThrow(
      "lowercase snake_case",
    );
  });
});
