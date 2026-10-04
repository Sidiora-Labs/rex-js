import { describe, expect, it } from "vitest";
import * as devtools from "./devtools.tsx";
import * as env from "./env.ts";
import * as index from "./index.ts";
import * as panels from "./panels.tsx";
import * as profiler from "./profiler.ts";
import * as provider from "./provider.tsx";
import * as store from "./store.ts";
import * as vite from "./vite.ts";

const sources = { env, store, profiler, provider, panels, devtools } as const;

function exported(module: object): Record<string, unknown> {
  return module as Record<string, unknown>;
}

function names(module: object): string[] {
  return Object.keys(module).sort();
}

describe("devtools index", () => {
  it("re-exports every value of the devtools modules by identity", () => {
    for (const [name, module] of Object.entries(sources)) {
      expect(names(module).length, name).toBeGreaterThan(0);
      for (const key of names(module)) {
        expect(exported(index)[key], `${name}.${key}`).toBe(exported(module)[key]);
      }
    }
  });

  it("exposes exactly the union of those modules and nothing from the Vite hook", () => {
    const expected = [
      ...new Set(Object.values(sources).flatMap((module) => Object.keys(module))),
    ].sort();
    expect(expected).toContain("createDevtoolsStore");
    expect(expected).toContain("RexDevtools");
    expect(names(index)).toEqual(expected);
    expect(names(vite)).toEqual(["devtoolsEnabled", "devtoolsHook"]);
    for (const key of names(vite)) expect(index).not.toHaveProperty(key);
  });

  it("keeps the devtools constants consistent across the modules", () => {
    expect(index.DEVTOOLS_PANELS).toEqual(Object.keys(index.DEVTOOLS_PANEL_TITLES));
    expect(index.DEVTOOLS_SHORTCUT).toBe("mod+shift+d");
    expect(index.DEVTOOLS_DEFINE).toBe(`import.meta.env.${index.DEVTOOLS_ENV_KEY}`);
    expect(index.DEVTOOLS_ATTRIBUTE).toBe("data-rex-devtools");
    expect(index.createDevtoolsStore().snapshot().panel).toBe(index.DEVTOOLS_PANELS[0]);
  });
});
