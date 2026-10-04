import { resolve } from "node:path";
import type { Plugin } from "vite";
import { describe, expect, it } from "vitest";
import { DEFAULT_APP_NAME } from "../manifest/build.ts";
import { REX_HOOKS, type RexHook, type RexHookContext } from "./hooks.ts";
import plugin, { assemblePlugins, createHookContext, rex } from "./plugin.ts";
import { runtimePaths } from "./resolve.ts";
import { DEFAULT_APP_DIR } from "./virtual.ts";

const names = (plugins: readonly Plugin[]) => plugins.map((entry) => entry.name);

describe("createHookContext", () => {
  it("starts from the working directory, the default app folder and the package entries", () => {
    const context = createHookContext();
    expect(context.options).toEqual({});
    expect(context.appDir).toBe(DEFAULT_APP_DIR);
    expect(context.paths).toEqual(runtimePaths());
    expect(context.state).toEqual({ root: process.cwd(), name: DEFAULT_APP_NAME });
    expect(context.appPath()).toBe(resolve(process.cwd(), DEFAULT_APP_DIR));
  });

  it("keeps the given options and derives the app path from the mutable root", () => {
    const options = { appDir: "src/app", name: "notes" };
    const context = createHookContext(options);
    expect(context.options).toBe(options);
    expect(context.appDir).toBe("src/app");
    expect(context.state.name).toBe("notes");
    expect(context.appPath()).toBe(resolve(process.cwd(), "src/app"));
    context.state.root = "/srv/site";
    expect(context.appPath()).toBe(resolve("/srv/site", "src/app"));
    context.state.name = "renamed";
    expect(context.state).toEqual({ root: "/srv/site", name: "renamed" });
  });
});

describe("assemblePlugins", () => {
  it("runs every hook with the same context and flattens their plugins in order", () => {
    const context = createHookContext({ appDir: "site" });
    const seen: RexHookContext[] = [];
    const single: RexHook = (given) => {
      seen.push(given);
      return { name: `single:${given.appDir}` };
    };
    const produced: Plugin[] = [{ name: "many:a" }, { name: "many:b" }];
    const many: RexHook = (given) => {
      seen.push(given);
      return produced;
    };
    const plugins = assemblePlugins(context, [single, many, single]);
    expect(names(plugins)).toEqual(["single:site", "many:a", "many:b", "single:site"]);
    expect(seen).toHaveLength(3);
    for (const given of seen) expect(given).toBe(context);
    expect(plugins[1]).toBe(produced[0]);
    expect(plugins).not.toBe(produced);
    expect(assemblePlugins(context, [])).toEqual([]);
  });

  it("assembles the ordered REX_HOOKS by default", () => {
    const context = createHookContext();
    const expected = REX_HOOKS.flatMap((hook) => {
      const result = hook(context);
      return Array.isArray(result) ? [...(result as readonly Plugin[])] : [result as Plugin];
    });
    expect(names(assemblePlugins(context))).toEqual(names(expected));
    expect(names(assemblePlugins(context, REX_HOOKS))).toEqual(names(expected));
  });
});

describe("rex", () => {
  it("returns the assembled plugin list for the given options", () => {
    const plugins = rex();
    const plain = names(plugins);
    expect(plain).toEqual(names(assemblePlugins(createHookContext())));
    expect(plain[0]).toBe("rex");
    expect(plain.at(-1)).toBe("rex:shell-components");
    for (const name of [
      "rex:app",
      "rex:entry",
      "rex:dev-server",
      "rex:render",
      "rex:ssr",
      "rex:hmr",
      "rex:nonce",
      "rex:devtools",
      "rex:overlay",
      "vite:react-babel",
      "vite:react-refresh",
    ]) {
      expect(plain, name).toContain(name);
    }
    expect(plain.indexOf("rex:app")).toBeLessThan(plain.indexOf("rex:entry"));
    expect(plain.indexOf("rex:render")).toBeLessThan(plain.indexOf("rex:ssr"));
    expect(plain.indexOf("vite:react-babel")).toBeLessThan(plain.indexOf("rex:hmr"));
    expect(new Set(plain).size).toBe(plain.length);
    expect(names(rex({ name: "notes", appDir: "site" }))).toEqual(plain);
    expect(rex()).not.toBe(plugins);
  });

  it("is the module's default export", () => {
    expect(plugin).toBe(rex);
  });
});
