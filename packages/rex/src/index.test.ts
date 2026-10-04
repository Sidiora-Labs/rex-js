import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, expectTypeOf, it } from "vitest";
import * as action from "./core/action.ts";
import * as actor from "./core/actor.ts";
import * as deprecated from "./core/deprecated.ts";
import * as entity from "./core/entity.ts";
import * as errors from "./core/errors.ts";
import * as flow from "./core/flow.ts";
import * as ids from "./core/ids.ts";
import * as journal from "./core/journal.ts";
import * as overlay from "./core/overlay.ts";
import * as page from "./core/page.ts";
import * as policy from "./core/policy.ts";
import * as protocol from "./core/protocol.ts";
import * as registry from "./core/registry.ts";
import * as serialize from "./core/serialize.ts";
import * as standard from "./core/standard.ts";
import * as states from "./core/states.ts";
import * as memoryStore from "./core/store.memory.ts";
import * as store from "./core/store.ts";
import * as rex from "./index.ts";
import * as manifestTypes from "./manifest/types.ts";

type Namespace = Readonly<Record<string, unknown>>;

const entry: Namespace = rex;

const starred: readonly (readonly [string, Namespace])[] = [
  ["core/errors.ts", errors],
  ["core/serialize.ts", serialize],
  ["core/deprecated.ts", deprecated],
  ["core/ids.ts", ids],
  ["core/entity.ts", entity],
  ["core/store.ts", store],
  ["core/store.memory.ts", memoryStore],
  ["core/actor.ts", actor],
  ["core/policy.ts", policy],
  ["core/action.ts", action],
  ["core/states.ts", states],
  ["core/overlay.ts", overlay],
  ["core/page.ts", page],
  ["core/registry.ts", registry],
  ["core/journal.ts", journal],
  ["core/flow.ts", flow],
  ["core/protocol.ts", protocol],
  ["manifest/types.ts", manifestTypes],
];

const STANDARD_EXPORTS = ["isStandardSchema", "validateStandard", "validateStandardSync"] as const;

const here = dirname(fileURLToPath(import.meta.url));

function packageJson(): { readonly version: string; readonly exports: Record<string, string> } {
  return JSON.parse(readFileSync(join(here, "../package.json"), "utf8")) as {
    readonly version: string;
    readonly exports: Record<string, string>;
  };
}

describe("rex root entry", () => {
  it("names the package version", () => {
    expect(rex.REX_VERSION).toBe(packageJson().version);
    expect(rex.REX_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("re-exports every runtime binding of its star modules by identity", () => {
    const owners = new Map<string, string[]>();
    for (const [file, module] of starred) {
      expect(Object.keys(module).length, file).toBeGreaterThan(0);
      for (const name of Object.keys(module)) {
        owners.set(name, [...(owners.get(name) ?? []), file]);
        expect(entry[name], `${file} ${name}`).toBe(module[name]);
      }
    }
    const shared = [...owners].filter(([, files]) => files.length > 1).map(([name]) => name);
    expect(shared).toEqual([]);
    expect(owners.size).toBeGreaterThan(80);
    expect(rex.action).toBe(action.action);
    expect(rex.entity).toBe(entity.entity);
    expect(rex.page).toBe(page.page);
    expect(rex.policy).toBe(policy.policy);
    expect(rex.flow).toBe(flow.flow);
    expect(rex.createRegistry).toBe(registry.createRegistry);
    expect(rex.memoryStore).toBe(memoryStore.memoryStore);
    expect(rex.RexError).toBe(errors.RexError);
    expect(rex.MANIFEST_VERSION).toBe(manifestTypes.MANIFEST_VERSION);
  });

  it("exposes the Standard Schema helpers selectively", () => {
    const standardModule: Namespace = standard;
    for (const name of STANDARD_EXPORTS) {
      expect(standardModule[name], name).toBeDefined();
      expect(entry[name], name).toBe(standardModule[name]);
    }
    for (const name of Object.keys(standardModule)) {
      if ((STANDARD_EXPORTS as readonly string[]).includes(name)) continue;
      expect(entry, name).not.toHaveProperty(name);
    }
    expect(entry).not.toHaveProperty("isZodSchema");
    expect(entry).not.toHaveProperty("StandardValidationError");
    expectTypeOf<rex.StandardSchemaV1>().toEqualTypeOf<standard.StandardSchemaV1>();
    expectTypeOf<rex.StandardInferInput<rex.StandardSchemaV1<string>>>().toEqualTypeOf<string>();
    expectTypeOf<
      rex.StandardInferOutput<rex.StandardSchemaV1<string, number>>
    >().toEqualTypeOf<number>();
  });

  it("exports exactly the union of its star modules, the standard helpers and the version", () => {
    const expected = new Set<string>(["REX_VERSION", ...STANDARD_EXPORTS]);
    for (const [, module] of starred) {
      for (const name of Object.keys(module)) expected.add(name);
    }
    expect(Object.keys(entry).sort()).toEqual([...expected].sort());
  });

  it("is the module behind the package root export", () => {
    expect(packageJson().exports["."]).toBe("./src/index.ts");
  });
});
