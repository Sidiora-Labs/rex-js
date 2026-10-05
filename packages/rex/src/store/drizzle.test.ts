import { createClient } from "@libsql/client";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it } from "vitest";
import { entity } from "../core/entity.ts";
import { boolean, id, integer, json, markdown, real, text, timestamp } from "../schema/index.ts";
import { z } from "zod/mini";
import { bind } from "../core/store.ts";
import {
  conformanceEntity,
  conformanceRecord,
  runStoreConformance,
} from "../core/store.conformance.ts";
import {
  columnSpecs,
  createTableStatement,
  drizzleStore,
  entityTable,
  tableNameFor,
} from "./drizzle.ts";

function memoryDb() {
  return drizzle(createClient({ url: ":memory:" }));
}

runStoreConformance("drizzle libsql", (declaration) => drizzleStore(declaration, memoryDb()));

describe("caller-owned transactions", () => {
  const account = entity("transaction.account", {
    fields: { id: id(), balance: integer() },
    label: (record) => record.id,
  });
  const transfer = entity("transaction.transfer", {
    fields: { id: id(), amount: integer() },
    label: (record) => record.id,
  });

  it("commits two stores together and rolls both back when the callback throws", async () => {
    const db = memoryDb();
    try {
      await db.run(createTableStatement(account));
      await db.run(createTableStatement(transfer));
      const accounts = bind(account, drizzleStore(account, db, { createTable: false }));
      const transfers = bind(transfer, drizzleStore(transfer, db, { createTable: false }));
      await accounts.put({ id: "owner", balance: 100 });
      const result = await db.transaction(async (tx) => {
        const accounts = bind(account, drizzleStore(account, tx, { createTable: false }));
        const transfers = bind(transfer, drizzleStore(transfer, tx, { createTable: false }));
        await accounts.put({ id: "owner", balance: 80 });
        return transfers.put({ id: "committed", amount: 20 });
      });
      expect(result).toEqual({ id: "committed", amount: 20 });
      expect(await accounts.get("owner")).toEqual({ id: "owner", balance: 80 });
      expect(await transfers.get("committed")).toEqual(result);

      const failure = new Error("abort transfer");
      await expect(
        db.transaction(async (tx) => {
          const accounts = bind(account, drizzleStore(account, tx, { createTable: false }));
          const transfers = bind(transfer, drizzleStore(transfer, tx, { createTable: false }));
          await accounts.put({ id: "owner", balance: 60 });
          await transfers.put({ id: "rolled-back", amount: 20 });
          expect(await accounts.get("owner")).toEqual({ id: "owner", balance: 60 });
          expect(await transfers.get("rolled-back")).toEqual({ id: "rolled-back", amount: 20 });
          throw failure;
        }),
      ).rejects.toBe(failure);
      expect(await accounts.get("owner")).toEqual({ id: "owner", balance: 80 });
      expect(await transfers.get("rolled-back")).toBeUndefined();
      expect((await transfers.list()).items).toEqual([result]);
    } finally {
      db.$client.close();
    }
  });

  it("isolates an uncommitted transaction from a concurrent connection to the same database", async () => {
    const directory = await mkdtemp(join(tmpdir(), "rex-transactions-"));
    const url = pathToFileURL(join(directory, "database.db")).href;
    const writer = drizzle(createClient({ url }));
    const reader = drizzle(createClient({ url }));
    try {
      await writer.run("PRAGMA journal_mode = WAL");
      await writer.run(createTableStatement(account));
      await writer.run(createTableStatement(transfer));
      const accounts = bind(account, drizzleStore(account, writer, { createTable: false }));
      await accounts.put({ id: "owner", balance: 100 });
      const observedAccounts = bind(account, drizzleStore(account, reader, { createTable: false }));
      const observedTransfers = bind(
        transfer,
        drizzleStore(transfer, reader, { createTable: false }),
      );

      await writer.transaction(async (tx) => {
        const accounts = bind(account, drizzleStore(account, tx, { createTable: false }));
        const transfers = bind(transfer, drizzleStore(transfer, tx, { createTable: false }));
        await accounts.put({ id: "owner", balance: 75 });
        await transfers.put({ id: "isolated", amount: 25 });
        expect(await accounts.get("owner")).toEqual({ id: "owner", balance: 75 });
        expect(await observedAccounts.get("owner")).toEqual({ id: "owner", balance: 100 });
        expect(await observedTransfers.get("isolated")).toBeUndefined();
      });
      expect(await observedAccounts.get("owner")).toEqual({ id: "owner", balance: 75 });
      expect(await observedTransfers.get("isolated")).toEqual({ id: "isolated", amount: 25 });
    } finally {
      writer.$client.close();
      reader.$client.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("drizzleStore", () => {
  it("maps entity fields to a sqlite table definition", () => {
    expect(tableNameFor(conformanceEntity)).toBe("conformance_item");
    expect(createTableStatement(conformanceEntity)).toBe(
      'CREATE TABLE IF NOT EXISTS "conformance_item" (' +
        '"id" text PRIMARY KEY NOT NULL, "name" text NOT NULL, "quantity" integer NOT NULL, ' +
        '"weight" real NOT NULL, "active" integer NOT NULL, "price" text NOT NULL, "tier" text NOT NULL, ' +
        '"owner" text NOT NULL, "createdAt" text NOT NULL, "note" text)',
    );
    expect(columnSpecs(conformanceEntity).map((spec) => [spec.field, spec.type])).toEqual([
      ["id", "text"],
      ["name", "text"],
      ["quantity", "integer"],
      ["weight", "real"],
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

  it("stores a markdown field in a json column and sorts and ranges the other fields", async () => {
    const doc = entity("doc", {
      fields: {
        id: id(),
        title: text(),
        step: integer(),
        updatedAt: timestamp(),
        body: markdown(),
      },
      label: (record) => record.title,
    });
    expect(columnSpecs(doc).map((spec) => [spec.field, spec.type])).toEqual([
      ["id", "text"],
      ["title", "text"],
      ["step", "integer"],
      ["updatedAt", "text"],
      ["body", "json"],
    ]);
    const body = (title: string) => ({
      source: `# ${title}`,
      html: `<h1 id="${title.toLowerCase()}">${title}</h1>`,
      headings: [{ depth: 1, id: title.toLowerCase(), text: title }],
      text: title,
    });
    const store = bind(doc, drizzleStore(doc, memoryDb()));
    const intro = {
      id: "intro",
      title: "Intro",
      step: 2,
      updatedAt: "2026-10-04T10:00:00Z",
      body: body("Intro"),
    };
    const setup = {
      id: "setup",
      title: "Setup",
      step: 1,
      updatedAt: "2026-10-04T09:30:00.250Z",
      body: body("Setup"),
    };
    const usage = {
      id: "usage",
      title: "Usage",
      step: 3,
      updatedAt: "2026-10-05T00:00:00Z",
      body: body("Usage"),
    };
    for (const record of [intro, setup, usage]) await store.put(record);
    expect(await store.get("intro")).toEqual(intro);
    expect((await store.list({ sort: { field: "step" } })).items).toEqual([setup, intro, usage]);
    expect(
      (
        await store.list({
          filter: { updatedAt: { lt: "2026-10-05T00:00:00Z" } },
          sort: { field: "updatedAt", direction: "desc" },
        })
      ).items.map((record) => record.id),
    ).toEqual(["intro", "setup"]);
    await expect(store.list({ sort: { field: "body" } })).rejects.toThrow(
      expect.objectContaining({ name: "RexError", code: "REX329" }),
    );
    await expect(store.list({ sort: { field: "nope" } } as never)).rejects.toThrow(
      'store doc: unknown sort field "nope"',
    );
  });

  it("refuses fields that are both optional and nullable", () => {
    const ambiguous = entity("ambiguous", {
      fields: { id: id(), note: z.optional(z.nullable(z.string())) },
      label: (record) => record.id,
    });
    expect(() => drizzleStore(ambiguous, memoryDb())).toThrow("both optional and nullable");
    expect(() => drizzleStore(ambiguous, memoryDb())).toThrow(
      expect.objectContaining({ name: "RexError", code: "REX329" }),
    );
  });

  it("rejects unknown filter fields", async () => {
    const store = drizzleStore(conformanceEntity, memoryDb());
    await expect(store.list({ filter: { nope: 1 } as never })).rejects.toThrow(
      'unknown filter field "nope"',
    );
    await expect(store.list({ filter: { nope: 1 } as never })).rejects.toThrow(
      expect.objectContaining({ name: "RexError", code: "REX305" }),
    );
  });

  it("uses an existing table when createTable is false", async () => {
    const db = memoryDb();
    const missing = drizzleStore(conformanceEntity, db, {
      createTable: false,
      table: "items",
    });
    await expect(missing.get("item-001")).rejects.toThrow();
    await db.run(createTableStatement(conformanceEntity, "items"));
    await missing.put(conformanceRecord(2));
    expect((await missing.list()).items).toEqual([conformanceRecord(2)]);
    expect(() => drizzleStore(conformanceEntity, db, { table: "Bad-Name" })).toThrow(
      "lowercase snake_case",
    );
    expect(() => createTableStatement(conformanceEntity, "Bad-Name")).toThrow(
      expect.objectContaining({ name: "RexError", code: "REX329" }),
    );
    expect(() => entityTable(conformanceEntity, "Bad-Name")).toThrow(
      expect.objectContaining({ name: "RexError", code: "REX329" }),
    );
  });
});
