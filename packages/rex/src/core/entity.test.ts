import { describe, expect, expectTypeOf, it } from "vitest";
import { RexDeclarationError, entity, type InferEntity } from "./entity.ts";
import {
  FIELD_KIND_KEY,
  boolean,
  enumOf,
  id,
  integer,
  money,
  ref,
  text,
  timestamp,
  z,
} from "./schema.ts";

const account = entity("account", {
  fields: {
    id: id(),
    name: text({ min: 1, max: 40 }),
    balance: money(),
    network: enumOf(["paxeer", "ethereum"]),
    custodial: boolean(),
    openedAt: timestamp(),
  },
  label: (record) => `${record.name} (${record.network})`,
});

const token = entity("token", {
  fields: {
    symbol: text({ min: 1 }),
    decimals: integer({ min: 0, max: 36 }),
    account: ref(account),
  },
  key: "symbol",
  label: (record) => record.symbol,
});

const sample = {
  id: "acc-1",
  name: "Main",
  balance: "12.5",
  network: "paxeer",
  custodial: false,
  openedAt: "2026-10-04T10:00:00Z",
} as const;

function declarationError(run: () => unknown): RexDeclarationError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(RexDeclarationError);
    return error as RexDeclarationError;
  }
  throw new Error("expected a RexDeclarationError");
}

describe("entity", () => {
  it("derives a stable id from its name", () => {
    expect(account.kind).toBe("entity");
    expect(account.id).toBe("account");
    expect(account.name).toBe("account");
    expect(token.id).toBe("token");
  });

  it("defaults the key to id and accepts a declared key", () => {
    expect(account.key).toBe("id");
    expect(token.key).toBe("symbol");
    expect(account.keyOf(account.parse(sample))).toBe("acc-1");
    expect(token.keyOf({ symbol: "PAX", decimals: 18, account: "acc-1" })).toBe("PAX");
  });

  it("builds a zod object schema from the fields", () => {
    expect(account.schema).toBeInstanceOf(z.ZodObject);
    expect(account.parse(sample)).toEqual(sample);
    expect(account.schema.safeParse({ ...sample, balance: 12 }).success).toBe(false);
    expect(() => account.parse({ ...sample, name: "" })).toThrow("name");
  });

  it("derives the JSON schema from the same field definition", () => {
    expect(account.jsonSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(account.jsonSchema.type).toBe("object");
    expect(account.jsonSchema.required).toEqual([
      "id",
      "name",
      "balance",
      "network",
      "custodial",
      "openedAt",
    ]);
    const properties = account.jsonSchema.properties as Record<string, Record<string, unknown>>;
    expect(properties.balance?.[FIELD_KIND_KEY]).toBe("money");
    expect(properties.network?.enum).toEqual(["paxeer", "ethereum"]);
    expect(token.fieldKinds).toEqual({ symbol: "text", decimals: "integer", account: "ref" });
  });

  it("exposes the label function", () => {
    expect(account.label(account.parse(sample))).toBe("Main (paxeer)");
  });

  it("infers the record type", () => {
    type Account = InferEntity<typeof account>;
    expectTypeOf<Account>().toEqualTypeOf<{
      id: string;
      name: string;
      balance: string;
      network: "paxeer" | "ethereum";
      custodial: boolean;
      openedAt: string;
    }>();
    type Token = InferEntity<typeof token>;
    expectTypeOf<Token["decimals"]>().toEqualTypeOf<number>();
    expectTypeOf(token.key).toEqualTypeOf<"symbol">();
  });

  it("is frozen", () => {
    expect(Object.isFrozen(account)).toBe(true);
    expect(Object.isFrozen(account.fields)).toBe(true);
    expect(Object.isFrozen(account.jsonSchema)).toBe(true);
  });

  it("contains no React dependency", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(new URL("./entity.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/from "react/);
  });
});

describe("entity declaration errors name the field", () => {
  const label = () => "x";

  it("id", () => {
    const error = declarationError(() => entity("Account", { fields: { id: id() }, label }));
    expect(error.field).toBe("id");
    expect(error.message).toContain('invalid entity id "Account"');
  });

  it("config", () => {
    expect(declarationError(() => entity("account", null as never)).field).toBe("config");
  });

  it("unknown property", () => {
    const error = declarationError(() =>
      entity("account", { fields: { id: id() }, label, table: "accounts" } as never),
    );
    expect(error.field).toBe("table");
  });

  it("fields", () => {
    expect(declarationError(() => entity("account", { fields: {}, label } as never)).field).toBe(
      "fields",
    );
    expect(declarationError(() => entity("account", { fields: [], label } as never)).field).toBe(
      "fields",
    );
  });

  it("field name", () => {
    const error = declarationError(() =>
      entity("account", { fields: { id: id(), Balance: money() }, label } as never),
    );
    expect(error.field).toBe("fields.Balance");
  });

  it("field schema", () => {
    const error = declarationError(() =>
      entity("account", { fields: { id: id(), balance: "money" }, label } as never),
    );
    expect(error.field).toBe("fields.balance");
    expect(error.message).toContain('field "fields.balance" must be a zod schema');
  });

  it("label", () => {
    const error = declarationError(() =>
      entity("account", { fields: { id: id() }, label: "name" } as never),
    );
    expect(error.field).toBe("label");
  });

  it("key", () => {
    expect(
      declarationError(() => entity("account", { fields: { name: text() }, label } as never))
        .message,
    ).toContain('names unknown field "id"');
    expect(
      declarationError(() =>
        entity("account", { fields: { id: id(), n: integer() }, key: "n", label } as never),
      ).field,
    ).toBe("key");
    expect(
      declarationError(() => entity("account", { fields: { id: id().optional() }, label } as never))
        .message,
    ).toContain("required string field");
  });

  it("unrepresentable field", () => {
    const error = declarationError(() =>
      entity("account", { fields: { id: id(), at: z.date() }, label } as never),
    );
    expect(error.field).toBe("fields");
  });
});
