import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizePath, resolveConfig } from "vite";
import { afterAll, describe, expect, it } from "vitest";
import { devtoolsHook } from "../client/devtools/vite.ts";
import { DEFAULT_APP_NAME } from "../manifest/build.ts";
import { appModuleHook } from "./app-module.ts";
import { boundaryHook } from "./boundary.ts";
import { compilerHook } from "./compiler.ts";
import { devServerHook } from "./dev-server.ts";
import { entryModuleHook } from "./entry-module.ts";
import { hmrHook } from "./hmr.ts";
import { REX_HOOKS, configHook, reactHook, type RexHook } from "./hooks.ts";
import { nonceHook } from "./nonce.ts";
import { overlayHook } from "./overlay.ts";
import { createHookContext, type RexPluginOptions } from "./plugin.ts";
import { shellComponentsHook } from "./shell-components.ts";
import { ssrHook } from "./ssr.ts";
import { stylesHook } from "./styles.ts";

const ORDER: readonly RexHook[] = [
  configHook,
  appModuleHook,
  entryModuleHook,
  devServerHook,
  ssrHook,
  compilerHook,
  reactHook,
  hmrHook,
  nonceHook,
  stylesHook,
  boundaryHook,
  devtoolsHook,
  overlayHook,
  shellComponentsHook,
];

const roots: string[] = [];

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function projectRoot(manifest: string | null): string {
  const root = mkdtempSync(join(tmpdir(), "rex-hooks-"));
  roots.push(root);
  if (manifest !== null) writeFileSync(join(root, "package.json"), manifest);
  return root;
}

async function resolved(root: string, options: RexPluginOptions = {}) {
  const context = createHookContext(options);
  const config = await resolveConfig(
    { root, configFile: false, logLevel: "silent", plugins: [configHook(context)] },
    "serve",
  );
  return { context, config };
}

describe("REX_HOOKS", () => {
  it("lists the hooks in their fixed order", () => {
    expect(REX_HOOKS).toHaveLength(ORDER.length);
    for (const [index, hook] of ORDER.entries()) expect(REX_HOOKS[index]).toBe(hook);
    expect(new Set(REX_HOOKS).size).toBe(ORDER.length);
  });
});

describe("configHook", () => {
  it("is the first pre plugin, named rex", () => {
    const plugin = configHook(createHookContext());
    expect(plugin.name).toBe("rex");
    expect(plugin.enforce).toBe("pre");
    expect(REX_HOOKS[0]).toBe(configHook);
  });

  it("records the resolved root and takes the app name from package.json", async () => {
    const root = projectRoot(JSON.stringify({ name: "@acme/notes", private: true }));
    const { context, config } = await resolved(root);
    expect(context.state.root).toBe(config.root);
    expect(normalizePath(context.state.root)).toBe(normalizePath(root));
    expect(context.state.name).toBe("@acme/notes");
  });

  it("prefers the configured name over package.json", async () => {
    const root = projectRoot(JSON.stringify({ name: "@acme/notes" }));
    const { context } = await resolved(root, { name: "fixture" });
    expect(context.state.name).toBe("fixture");
  });

  it("falls back to the default app name without a usable package name", async () => {
    const blank = await resolved(projectRoot(JSON.stringify({ name: "   ", version: "1.0.0" })));
    expect(blank.context.state.name).toBe(DEFAULT_APP_NAME);
    const unnamed = await resolved(projectRoot(JSON.stringify({ private: true })));
    expect(unnamed.context.state.name).toBe(DEFAULT_APP_NAME);
    const missing = await resolved(projectRoot(null));
    expect(missing.context.state.name).toBe(DEFAULT_APP_NAME);
    expect(missing.context.state.root).toBe(missing.config.root);
  });
});

describe("reactHook", () => {
  it("contributes the fresh @vitejs/plugin-react plugin set", () => {
    const plugins = reactHook();
    const names = plugins.map((plugin) => plugin.name);
    expect(names).toContain("vite:react-babel");
    expect(names).toContain("vite:react-refresh");
    expect(new Set(names).size).toBe(names.length);
    for (const plugin of plugins) expect(typeof plugin.name).toBe("string");
    expect(reactHook()).not.toBe(plugins);
    expect(reactHook().map((plugin) => plugin.name)).toEqual(names);
  });
});
