import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, expectTypeOf, it } from "vitest";
import * as defineElement from "./define-element.tsx";
import * as interop from "./index.ts";
import * as mount from "./mount.tsx";
import * as native from "./native.tsx";

type Namespace = Readonly<Record<string, unknown>>;

const sources: readonly (readonly [string, Namespace])[] = [
  ["./define-element.tsx", defineElement as Namespace],
  ["./mount.tsx", mount as Namespace],
  ["./native.tsx", native as Namespace],
];

const entry = interop as Namespace;

describe("client/interop entry", () => {
  it("re-exports the custom element, mount and native bindings by identity", () => {
    expect(interop.defineElement).toBe(defineElement.defineElement);
    expect(interop.attributeName).toBe(defineElement.attributeName);
    expect(interop.coerceAttribute).toBe(defineElement.coerceAttribute);
    expect(interop.mountRexPage).toBe(mount.mountRexPage);
    expect(interop.Native).toBe(native.Native);
    for (const [path, module] of sources) {
      for (const name of Object.keys(module)) {
        expect(entry[name], `${name} from ${path}`).toBe(module[name]);
      }
    }
    expectTypeOf<interop.NativeProps>().toEqualTypeOf<native.NativeProps>();
    expectTypeOf<interop.NativeTag>().toEqualTypeOf<native.NativeTag>();
    expectTypeOf<interop.NativeMount>().toEqualTypeOf<native.NativeMount>();
    expectTypeOf<interop.MountRexPageOptions>().toEqualTypeOf<mount.MountRexPageOptions>();
    expectTypeOf<interop.UnmountRexPage>().toEqualTypeOf<mount.UnmountRexPage>();
    expectTypeOf<interop.ElementPropKind>().toEqualTypeOf<defineElement.ElementPropKind>();
    expectTypeOf<interop.RexElementConstructor>().toEqualTypeOf<defineElement.RexElementConstructor>();
    expectTypeOf<interop.DefineElementOptions<{ a: string }>>().toEqualTypeOf<
      defineElement.DefineElementOptions<{ a: string }>
    >();
  });

  it("exports exactly the union of its three modules", () => {
    const expected = new Set<string>();
    for (const [, module] of sources) {
      for (const name of Object.keys(module)) expected.add(name);
    }
    expect(Object.keys(entry).sort()).toEqual([...expected].sort());
    expect(Object.keys(entry).sort()).toEqual([
      "Native",
      "attributeName",
      "coerceAttribute",
      "defineElement",
      "mountRexPage",
    ]);
  });

  it("is the module behind the @sidioralabs/rex/client/interop export", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const manifest = JSON.parse(readFileSync(join(here, "../../../package.json"), "utf8")) as {
      readonly exports: Readonly<Record<string, string>>;
    };
    expect(manifest.exports["./client/interop"]).toBe("./src/client/interop/index.ts");
  });
});
