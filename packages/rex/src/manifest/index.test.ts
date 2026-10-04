import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, expectTypeOf, it } from "vitest";
import * as build from "./build.ts";
import * as manifest from "./index.ts";
import * as jsonSchema from "./json-schema.ts";
import * as sidecar from "./sidecar.schema.ts";
import * as types from "./types.ts";

type Namespace = Readonly<Record<string, unknown>>;

const entry: Namespace = manifest;

const starred: readonly (readonly [string, Namespace])[] = [
  ["types.ts", types],
  ["build.ts", build],
  ["json-schema.ts", jsonSchema],
  ["sidecar.schema.ts", sidecar],
];

describe("rex/manifest entry", () => {
  it("re-exports every runtime binding of its four modules by identity", () => {
    for (const [file, module] of starred) {
      expect(Object.keys(module).length, file).toBeGreaterThan(0);
      for (const name of Object.keys(module)) {
        expect(entry[name], `${file} ${name}`).toBe(module[name]);
      }
    }
    expect(manifest.buildManifest).toBe(build.buildManifest);
    expect(manifest.stableStringify).toBe(build.stableStringify);
    expect(manifest.MANIFEST_VERSION).toBe(types.MANIFEST_VERSION);
    expect(manifest.REX_SCREENS).toBe(types.REX_SCREENS);
    expect(manifest.toJsonSchema).toBe(jsonSchema.toJsonSchema);
    expect(manifest.objectJsonSchema).toBe(jsonSchema.objectJsonSchema);
    expect(manifest.validateSidecar).toBe(sidecar.validateSidecar);
    expect(manifest.sidecarJsonSchema).toBe(sidecar.sidecarJsonSchema);
    expectTypeOf<manifest.Manifest>().toEqualTypeOf<types.Manifest>();
    expectTypeOf<manifest.ManifestPage>().toEqualTypeOf<types.ManifestPage>();
    expectTypeOf<manifest.ManifestSource>().toEqualTypeOf<build.ManifestSource>();
    expectTypeOf<manifest.BuildManifestOptions>().toEqualTypeOf<build.BuildManifestOptions>();
    expectTypeOf<manifest.SidecarPayload>().toEqualTypeOf<sidecar.SidecarPayload>();
    expectTypeOf<manifest.SidecarValidation>().toEqualTypeOf<sidecar.SidecarValidation>();
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

  it("is the module behind @sidioralabs/rex/manifest and keeps the scanner out of it", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const packageJson = JSON.parse(readFileSync(join(here, "../../package.json"), "utf8")) as {
      readonly exports: Readonly<Record<string, string>>;
    };
    expect(packageJson.exports["./manifest"]).toBe("./src/manifest/index.ts");
    for (const name of ["scanManifest", "writeManifest", "loadRegistry", "renderAgentsMd"]) {
      expect(entry, name).not.toHaveProperty(name);
    }
  });
});
