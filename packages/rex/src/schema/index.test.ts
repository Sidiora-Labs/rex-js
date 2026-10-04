import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, expectTypeOf, it } from "vitest";
import * as coreSchema from "../core/schema.ts";
import * as adapter from "./adapter.ts";
import * as fields from "./fields.ts";
import * as schema from "./index.ts";

type Namespace = Readonly<Record<string, unknown>>;

const entry: Namespace = schema;
const fieldModule: Namespace = fields;
const adapterModule: Namespace = adapter;
const core: Namespace = coreSchema;

const ADAPTER_EXPORTS = ["fromStandard", "standardSource"] as const;

const CORE_EXPORTS = [
  "FIELD_KINDS",
  "FIELD_KIND_KEY",
  "FIELD_REF_KEY",
  "ID_PATTERN",
  "MONEY_PATTERN",
  "STANDARD_VENDOR_KEY",
  "fieldKind",
  "refTarget",
] as const;

describe("rex/schema entry", () => {
  it("re-exports every field constructor by identity", () => {
    const names = Object.keys(fieldModule);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(entry[name], name).toBe(fieldModule[name]);
    expect(schema.field).toBe(fields.field);
    expect(schema.id).toBe(fields.id);
    expect(schema.text).toBe(fields.text);
    expect(schema.money).toBe(fields.money);
    expect(schema.integer).toBe(fields.integer);
    expect(schema.real).toBe(fields.real);
    expect(schema.boolean).toBe(fields.boolean);
    expect(schema.enumOf).toBe(fields.enumOf);
    expect(schema.ref).toBe(fields.ref);
    expect(schema.timestamp).toBe(fields.timestamp);
    expect(schema.json).toBe(fields.json);
    expectTypeOf<schema.TextOptions>().toEqualTypeOf<fields.TextOptions>();
    expectTypeOf<schema.RefTarget>().toEqualTypeOf<fields.RefTarget>();
  });

  it("re-exports the adapter and the core vocabulary selectively", () => {
    for (const name of ADAPTER_EXPORTS) {
      expect(adapterModule[name], name).toBeDefined();
      expect(entry[name], name).toBe(adapterModule[name]);
    }
    for (const name of CORE_EXPORTS) {
      expect(core[name], name).toBeDefined();
      expect(entry[name], name).toBe(core[name]);
    }
    for (const name of Object.keys(core)) {
      if ((CORE_EXPORTS as readonly string[]).includes(name)) continue;
      expect(entry, name).not.toHaveProperty(name);
    }
    expectTypeOf<schema.FieldKind>().toEqualTypeOf<coreSchema.FieldKind>();
    expectTypeOf<schema.JsonSchema>().toEqualTypeOf<coreSchema.JsonSchema>();
  });

  it("exports exactly the field constructors plus the listed names", () => {
    expect(Object.keys(entry).sort()).toEqual(
      [...Object.keys(fieldModule), ...ADAPTER_EXPORTS, ...CORE_EXPORTS].sort(),
    );
  });

  it("tags every constructed field with a kind the vocabulary lists", () => {
    const constructed: readonly (readonly [coreSchema.FieldKind, unknown])[] = [
      ["id", schema.id()],
      ["text", schema.text()],
      ["money", schema.money()],
      ["integer", schema.integer()],
      ["real", schema.real()],
      ["boolean", schema.boolean()],
      ["enum", schema.enumOf(["a", "b"])],
      ["ref", schema.ref("account")],
      ["timestamp", schema.timestamp()],
      ["json", schema.json()],
      ["markdown", schema.markdown()],
    ];
    expect(constructed.map(([kind]) => kind).sort()).toEqual([...schema.FIELD_KINDS].sort());
    for (const [kind, field] of constructed) {
      expect(schema.fieldKind(field), kind).toBe(kind);
    }
    expect(schema.refTarget(schema.ref("account"))).toBe("account");
    expect(schema.refTarget(schema.ref({ id: "token" }))).toBe("token");
    expect(schema.refTarget(schema.text())).toBeUndefined();
    expect(schema.ID_PATTERN.test("acc-1")).toBe(true);
    expect(schema.MONEY_PATTERN.test("1.50")).toBe(true);
    expect(schema.MONEY_PATTERN.test("01")).toBe(false);
  });

  it("is the module behind @sidioralabs/rex/schema", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const packageJson = JSON.parse(readFileSync(join(here, "../../package.json"), "utf8")) as {
      readonly exports: Readonly<Record<string, string>>;
    };
    expect(packageJson.exports["./schema"]).toBe("./src/schema/index.ts");
  });
});
