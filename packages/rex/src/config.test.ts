import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, expectTypeOf, it } from "vitest";
import * as config from "./config.ts";
import * as coreConfig from "./core/config.ts";
import * as deprecated from "./core/deprecated.ts";
import * as errors from "./core/errors.ts";
import { createRegistry } from "./core/registry.ts";

type Namespace = Readonly<Record<string, unknown>>;

const entry: Namespace = config;

const starred: readonly (readonly [string, Namespace])[] = [
  ["core/config.ts", coreConfig],
  ["core/errors.ts", errors],
  ["core/deprecated.ts", deprecated],
];

describe("rex/config entry", () => {
  it("re-exports every runtime binding of its three modules by identity", () => {
    for (const [file, module] of starred) {
      expect(Object.keys(module).length, file).toBeGreaterThan(0);
      for (const name of Object.keys(module)) {
        expect(entry[name], `${file} ${name}`).toBe(module[name]);
      }
    }
    expect(config.defineConfig).toBe(coreConfig.defineConfig);
    expect(config.parseConfig).toBe(coreConfig.parseConfig);
    expect(config.resolveOptions).toBe(coreConfig.resolveOptions);
    expect(config.DEFAULT_OPTIONS).toBe(coreConfig.DEFAULT_OPTIONS);
    expect(config.RexConfigError).toBe(coreConfig.RexConfigError);
    expect(config.RexError).toBe(errors.RexError);
    expect(config.deprecated).toBe(deprecated.deprecated);
    expectTypeOf<config.RexConfig>().toEqualTypeOf<coreConfig.RexConfig>();
    expectTypeOf<config.ResolvedRexOptions>().toEqualTypeOf<coreConfig.ResolvedRexOptions>();
    expectTypeOf<config.RexErrorCode>().toEqualTypeOf<errors.RexErrorCode>();
    expectTypeOf<config.DeprecationWarn>().toEqualTypeOf<deprecated.DeprecationWarn>();
  });

  it("exports exactly the union of its modules with no name claimed twice", () => {
    const owners = new Map<string, string[]>();
    for (const [file, module] of starred) {
      for (const name of Object.keys(module)) {
        owners.set(name, [...(owners.get(name) ?? []), file]);
      }
    }
    const shared = [...owners].filter(([, files]) => files.length > 1).map(([name]) => name);
    expect(shared).toEqual([]);
    expect(Object.keys(entry).sort()).toEqual([...owners.keys()].sort());
  });

  it("defines and parses a config through the entry", () => {
    const registry = createRegistry().freeze();
    const defined = config.defineConfig({ app: { name: "demo", registry } });
    expect(config.isDefinedConfig(defined)).toBe(true);
    expect(config.isDefinedConfig({ app: { name: "demo", registry } })).toBe(false);
    const read = config.readConfigExport(defined);
    expect(read.kind).toBe("config");
    expect(read.options.render.default).toBe("ssr");
    expect(read.kind === "config" && read.options === read.config).toBe(true);
    expect(read.options).toEqual({ ...config.DEFAULT_OPTIONS, app: defined.app, server: null });
    let failure: unknown;
    try {
      config.parseConfig({});
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(config.RexConfigError);
    expect((failure as config.RexConfigError).code).toBe("REX111");
    expect((failure as config.RexConfigError).field).toBe("app");
  });

  it("is the module behind @sidioralabs/rex/config", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const packageJson = JSON.parse(readFileSync(join(here, "../package.json"), "utf8")) as {
      readonly exports: Readonly<Record<string, string>>;
    };
    expect(packageJson.exports["./config"]).toBe("./src/config.ts");
  });
});
