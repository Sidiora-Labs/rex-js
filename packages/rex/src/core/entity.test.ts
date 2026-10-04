import { describe, expect, expectTypeOf, it } from "vitest";
import { RexDeclarationError, entity, type InferEntity } from "./entity.ts";
import { FIELD_KIND_KEY } from "./schema.ts";
import { boolean, enumOf, id, integer, money, ref, text, timestamp } from "../schema/index.ts";
import { z } from "zod/mini";
import { RexError } from "./errors.ts";
import { validateStandardSync, type StandardSchemaV1 } from "./standard.ts";
import { buildManifest } from "../manifest/build.ts";

function entityJsonSchema(declared: Parameters<typeof buildManifest>[0]["entities"][number]) {
  const built = buildManifest({ entities: [declared], actions: [], pages: [], policies: [] });
  return (built.entities[0] as (typeof built.entities)[number]).schema;
}

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

  it("builds a Standard Schema object from the declared fields", () => {
    expect(account.schema["~standard"].vendor).toBe("rex");
    expect(account.schema.shape).toBe(account.fields);
    expect(account.parse(sample)).toEqual(sample);
    expect(validateStandardSync(account.schema, { ...sample, balance: 12 }).issues).toBeDefined();
    expect(() => account.parse({ ...sample, name: "" })).toThrow("name");
  });

  it("derives the JSON schema from the same field definition when the manifest is built", () => {
    expect(Object.hasOwn(account, "jsonSchema")).toBe(false);
    const jsonSchema = entityJsonSchema(account);
    expect(jsonSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(jsonSchema.type).toBe("object");
    expect(jsonSchema.required).toEqual([
      "id",
      "name",
      "balance",
      "network",
      "custodial",
      "openedAt",
    ]);
    const properties = jsonSchema.properties as Record<string, Record<string, unknown>>;
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
    expect(Object.isFrozen(account.schema)).toBe(true);
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
    expect(error.message).toContain(
      'field "fields.balance" must be a Standard Schema such as a zod schema',
    );
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

  it("unrepresentable field fails when the manifest is built, naming the entity", () => {
    const dated = entity("account", { fields: { id: id(), at: z.date() }, label } as never);
    let error: unknown;
    try {
      entityJsonSchema(dated);
    } catch (thrown) {
      error = thrown;
    }
    expect(error).toBeInstanceOf(RexError);
    expect((error as RexError).code).toBe("REX210");
    expect((error as RexError).message).toContain('entity "account"');
  });
});

describe("Standard Schema fields", () => {
  const isoCountry: StandardSchemaV1<string, string> = {
    "~standard": {
      version: 1,
      vendor: "hand",
      validate: (value) =>
        typeof value === "string" && /^[A-Z]{2}$/.test(value)
          ? { value }
          : { issues: [{ message: "must be a two-letter country code" }] },
    },
  };

  const office = entity("office", {
    fields: { id: id(), country: isoCountry, name: text({ min: 1 }) },
    label: (record) => `${record.name} (${record.country})`,
  });

  it("accepts a hand-written Standard Schema field and validates through it", () => {
    expect(office.fields.country).toBe(isoCountry);
    expect(office.parse({ id: "o-1", country: "PT", name: "Lisbon" })).toEqual({
      id: "o-1",
      country: "PT",
      name: "Lisbon",
    });
    expect(() => office.parse({ id: "o-1", country: "Portugal", name: "Lisbon" })).toThrow(
      /two-letter country code/,
    );
    expect(office.fieldKinds.country).toBeUndefined();
    expect(office.fieldKinds.name).toBe("text");
    expectTypeOf<InferEntity<typeof office>>().toEqualTypeOf<{
      id: string;
      country: string;
      name: string;
    }>();
  });

  it("describes the Standard Schema field in the JSON schema by its vendor", () => {
    const jsonSchema = entityJsonSchema(office);
    const properties = jsonSchema.properties as Record<string, Record<string, unknown>>;
    expect(properties.country).toEqual({ "x-rex-standard": "hand" });
    expect(jsonSchema.required).toEqual(["id", "country", "name"]);
  });

  it("refuses a Standard Schema key it cannot prove is a string", () => {
    const error = declarationError(() =>
      entity("office", { fields: { id: isoCountry }, label: () => "x" }),
    );
    expect(error.field).toBe("key");
  });
});
