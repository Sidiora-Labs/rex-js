import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createServer,
  normalizePath,
  parseSync,
  resolveConfig,
  type Plugin,
  type ViteDevServer,
} from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Manifest } from "../manifest/types.ts";
import {
  appModuleConfig,
  appModuleHook,
  buildAppManifest,
  generateAppModule,
  generateManifestModule,
  invalidateAppModule,
  localeModules,
  type AppModuleOptions,
  type RexAppBundle,
  type RexAppConfig,
} from "./app-module.ts";
import { REX_HOOKS, configHook } from "./hooks.ts";
import { createHookContext, rex } from "./plugin.ts";
import { scanApp } from "./scan.ts";
import {
  APP_MODULE_ID,
  MANIFEST_MODULE_ID,
  RESOLVED_APP_MODULE_ID,
  RESOLVED_MANIFEST_MODULE_ID,
} from "./virtual.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, "fixtures", "app");
const packageModules = join(here, "..", "..", "node_modules");
const coreEntry = join(here, "..", "index.ts");
const alias = [{ find: /^@sidioralabs\/rex$/, replacement: coreEntry }];
const brokenAlias = [
  ...alias,
  { find: /^@sidioralabs\/rex\/schema$/, replacement: join(here, "..", "schema", "index.ts") },
];
const fixture = (path: string) => normalizePath(join(fixtureRoot, path));
const SERVER_TIMEOUT_MS = 90_000;

const OPTIONS: AppModuleOptions = {
  name: "fixture",
  core: "/rex/index.ts",
  client: "/rex/client/index.ts",
  config: appModuleConfig({}),
  shellComponents: null,
  locales: [],
};

const temporary: string[] = [];

afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function temp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temporary.push(dir);
  return dir;
}

function outputOptionsHandler(plugin: Plugin) {
  const hook = plugin.outputOptions;
  const handler = typeof hook === "function" ? hook : hook?.handler;
  if (handler === undefined) throw new Error(`${plugin.name} declares no outputOptions hook`);
  return handler;
}

describe("localeModules", () => {
  it("lists the app's locale JSON files sorted by locale", () => {
    const app = temp("rex-app-locales-");
    mkdirSync(join(app, "locales", "fr"), { recursive: true });
    writeFileSync(join(app, "locales", "en.json"), "{}");
    writeFileSync(join(app, "locales", "de.json"), "{}");
    writeFileSync(join(app, "locales", "README.md"), "");
    expect(localeModules(app)).toEqual([
      { locale: "de", file: normalizePath(join(app, "locales", "de.json")) },
      { locale: "en", file: normalizePath(join(app, "locales", "en.json")) },
    ]);
    expect(localeModules(join(app, "missing"))).toEqual([]);
    expect(localeModules(fixture("app"))).toEqual([]);
  });
});

describe("appModuleConfig", () => {
  it("defaults to no fonts and no i18n and keeps what is configured", () => {
    expect(appModuleConfig({})).toEqual({ fonts: [], i18n: null });
    expect(appModuleConfig({ i18n: null })).toEqual({ fonts: [], i18n: null });
    const fonts = [{ family: "Inter", src: "/fonts/inter.woff2" }];
    const i18n = { locales: ["en", "de"], default: "en" };
    const config: RexAppConfig = appModuleConfig({ fonts, i18n });
    expect(config.fonts).toBe(fonts);
    expect(config.i18n).toBe(i18n);
  });
});

describe("generateAppModule", () => {
  const scan = scanApp(fixtureRoot);

  it("imports every declaration module and assembles the registry, manifest and bundle", () => {
    const code = generateAppModule(scan, OPTIONS);
    expect(parseSync("rex-app.js", code).errors).toEqual([]);
    const lines = code.split("\n");
    expect(lines[0]).toBe('import { RexError, createRegistry } from "/rex/index.ts";');
    expect(lines[1]).toBe('import { buildManifest } from "/rex/manifest/index.ts";');
    expect(code).toContain(
      `import * as entity0 from ${JSON.stringify(fixture("app/entities/note.ts"))};`,
    );
    expect(code).toContain(
      `import * as action0 from ${JSON.stringify(fixture("app/actions/add-note.ts"))};`,
    );
    expect(code).toContain(
      `import * as policy0 from ${JSON.stringify(fixture("app/policies/notes.ts"))};`,
    );
    expect(code).toContain(
      `import * as page0 from ${JSON.stringify(fixture("app/pages/home/page.ts"))};`,
    );
    expect(code).toContain(
      `import * as page1 from ${JSON.stringify(fixture("app/pages/note/page.ts"))};`,
    );
    expect(code).toContain('throw new RexError("REX462", "rex:app: " + file + " " + problem);');
    expect(code).toContain(
      'export const entities = Object.freeze([\n  ...rexDeclarations(entity0, "entity", "app/entities/note.ts"),\n]);',
    );
    expect(code).toContain(
      'export const actions = Object.freeze([\n  ...rexDeclarations(action0, "action", "app/actions/add-note.ts"),\n]);',
    );
    expect(code).toContain(
      'export const policies = Object.freeze([\n  ...rexDeclarations(policy0, "policy", "app/policies/notes.ts"),\n]);',
    );
    expect(code).toContain("export const flows = Object.freeze([]);");
    expect(code).toContain(
      "export const registry = createRegistry()\n  .register(...entities, ...actions, ...policies, ...flows, ...pages.map((entry) => entry.page))\n  .freeze();",
    );
    expect(code).toContain('export const manifest = buildManifest(registry, { app: "fixture" });');
    expect(code).toContain(
      "export const config = Object.freeze({ fonts: Object.freeze([]), i18n: null });",
    );
    expect(code).toContain(
      'export const app = Object.freeze({ name: "fixture", entities, actions, policies, flows, pages, registry, manifest });',
    );
    expect(code.endsWith("export default app;\n")).toBe(true);
    expect(code).not.toContain(MANIFEST_MODULE_ID);
    expect(code).not.toContain(OPTIONS.client);
  });

  it("loads each page's view, states, regions and overlays lazily into its page chunk", () => {
    const code = generateAppModule(scan, OPTIONS);
    const dynamic = [
      "app/pages/home/view.tsx",
      "app/pages/home/states.tsx",
      "app/pages/home/regions/composer/region.tsx",
      "app/pages/home/regions/list/region.tsx",
      "app/pages/home/overlays/NoteSheet.tsx",
    ]
      .map((file) => `import(${JSON.stringify(fixture(file))})`)
      .join(", ");
    expect(code).toContain(
      `rexPage("home", page0, "app/pages/home/page.ts", "page-home", () => Promise.all([${dynamic}]).then(([page0m0, page0m1, page0m2, page0m3, page0m4]) => ({`,
    );
    expect(code).toContain('    view: rexDefault(page0m0, "app/pages/home/view.tsx"),');
    expect(code).toContain("    states: page0m1,");
    expect(code).toContain(
      '    regions: { "composer": rexDefault(page0m2, "app/pages/home/regions/composer/region.tsx"), "list": rexDefault(page0m3, "app/pages/home/regions/list/region.tsx") },',
    );
    expect(code).toContain(
      '    overlays: { "NoteSheet": rexDefault(page0m4, "app/pages/home/overlays/NoteSheet.tsx") },',
    );
    expect(code).toContain('rexPage("note", page1, "app/pages/note/page.ts", "page-note", ');
    expect(code).toContain(
      '    regions: { "detail": rexDefault(page1m2, "app/pages/note/regions/detail/region.tsx") },',
    );
    expect(code).toContain("    overlays: {  },");
  });

  it("imports the prebuilt manifest for builds and the builder beside the core entry otherwise", () => {
    const prebuilt = generateAppModule(scan, {
      ...OPTIONS,
      core: "/opt/rex/dist/index.js",
      prebuiltManifest: true,
    });
    expect(parseSync("rex-app.js", prebuilt).errors).toEqual([]);
    expect(prebuilt.split("\n").slice(0, 2)).toEqual([
      'import { RexError, createRegistry } from "/opt/rex/dist/index.js";',
      `import rexManifest from ${JSON.stringify(MANIFEST_MODULE_ID)};`,
    ]);
    expect(prebuilt).toContain("export const manifest = rexManifest;");
    expect(prebuilt).not.toContain("buildManifest");

    const built = generateAppModule(scan, { ...OPTIONS, core: "/opt/rex/dist/index.js" });
    expect(built).toContain('import { buildManifest } from "/opt/rex/dist/manifest/index.js";');
    expect(built).not.toContain("rexManifest");
    expect(generateAppModule(scan, { ...OPTIONS, prebuiltManifest: false })).toBe(
      generateAppModule(scan, OPTIONS),
    );
  });
});

describe("the app manifest", { timeout: SERVER_TIMEOUT_MS }, () => {
  let manifest: Manifest;

  beforeAll(async () => {
    manifest = await buildAppManifest(fixtureRoot, { name: "fixture" }, { alias });
  });

  it("is built from the app root through a module loader", () => {
    expect(manifest.app).toEqual({ name: "fixture" });
    expect(manifest.entities.map((entry) => entry.id)).toEqual(["note"]);
    expect(manifest.actions.map((entry) => entry.id)).toEqual(["add-note"]);
    expect(manifest.policies.map((entry) => entry.id)).toEqual(["notes"]);
    expect(manifest.pages.map((entry) => [entry.id, entry.route])).toEqual([
      ["home", "/"],
      ["note", "/notes/:noteId"],
    ]);
  });

  it("serialises into a module whose default export is the manifest", async () => {
    const code = generateManifestModule(manifest);
    expect(code).toBe(`const manifest = ${JSON.stringify(manifest)};\nexport default manifest;\n`);
    const file = join(temp("rex-app-manifest-"), "manifest.mjs");
    writeFileSync(file, code);
    const loaded = (await import(pathToFileURL(file).href)) as { readonly default: Manifest };
    expect(loaded.default).toEqual(manifest);
  });
});

describe("appModuleHook", () => {
  it("is a pre plugin in the ordered hook list", () => {
    const plugin = appModuleHook(createHookContext());
    expect(plugin.name).toBe("rex:app");
    expect(plugin.enforce).toBe("pre");
    expect(REX_HOOKS).toContain(appModuleHook);
  });

  it("splits page chunks for client builds and keeps server builds whole", async () => {
    const client = createHookContext({ name: "fixture" });
    const clientPlugin = appModuleHook(client);
    await resolveConfig(
      {
        root: fixtureRoot,
        configFile: false,
        logLevel: "silent",
        plugins: [configHook(client), clientPlugin],
      },
      "build",
    );
    expect(client.state.root).toBe(normalizePath(fixtureRoot));
    const clientOptions = outputOptionsHandler(clientPlugin);
    const split = clientOptions.call(null as never, {});
    const splitting = split?.codeSplitting;
    if (typeof splitting !== "object" || splitting === null) {
      throw new Error(`expected code splitting groups, got ${String(splitting)}`);
    }
    expect(splitting.groups).toHaveLength(1);
    const group = splitting.groups?.[0];
    expect(group?.includeDependenciesRecursively).toBe(false);
    const name = group?.name as (moduleId: string) => string | null;
    expect(name(fixture("app/pages/home/view.tsx"))).toBe("page-home");
    expect(name(fixture("app/pages/home/page.ts"))).toBeNull();
    expect(name(fixture("app/actions/add-note.ts"))).toBeNull();
    expect(clientOptions.call(null as never, { codeSplitting: true })?.codeSplitting).toBeTypeOf(
      "object",
    );
    expect(clientOptions.call(null as never, { codeSplitting: false })).toBeNull();
    expect(clientOptions.call(null as never, { codeSplitting: { minSize: 1 } })).toBeNull();

    const server = createHookContext({ name: "fixture" });
    const serverPlugin = appModuleHook(server);
    await resolveConfig(
      {
        root: fixtureRoot,
        configFile: false,
        logLevel: "silent",
        plugins: [configHook(server), serverPlugin],
        build: { ssr: true },
      },
      "build",
    );
    expect(outputOptionsHandler(serverPlugin).call(null as never, {})).toEqual({
      codeSplitting: false,
    });
    expect(
      outputOptionsHandler(serverPlugin).call(null as never, { codeSplitting: false }),
    ).toBeNull();
  });
});

describe("on the dev server", { timeout: SERVER_TIMEOUT_MS }, () => {
  let vite: ViteDevServer;

  const loadBundle = async () =>
    (await vite.ssrLoadModule(APP_MODULE_ID)) as RexAppBundle & {
      readonly default: RexAppBundle;
    };
  const appNode = () => vite.environments.ssr.moduleGraph.getModuleById(RESOLVED_APP_MODULE_ID);

  beforeAll(async () => {
    vite = await createServer({
      root: fixtureRoot,
      configFile: false,
      logLevel: "silent",
      appType: "custom",
      resolve: { alias },
      server: { middlewareMode: true, hmr: false },
      plugins: rex({ name: "fixture" }),
    });
  });

  afterAll(async () => {
    await vite.close();
  });

  it("has no rex:app module to invalidate before the first load", () => {
    expect(appNode()).toBeUndefined();
    expect(invalidateAppModule(vite.environments.ssr)).toBe(false);
    expect(invalidateAppModule(vite.environments.client)).toBe(false);
  });

  it("invalidates the loaded rex:app module so the next load assembles a fresh bundle", async () => {
    const first = await loadBundle();
    expect((await loadBundle()).default).toBe(first.default);
    expect(appNode()?.transformResult).not.toBeNull();
    expect(invalidateAppModule(vite.environments.ssr)).toBe(true);
    expect(appNode()?.transformResult).toBeNull();
    const second = await loadBundle();
    expect(second.default).not.toBe(first.default);
    expect(second.pages.map((entry) => entry.id)).toEqual(["home", "note"]);
    const stamp = Date.now() + 1;
    expect(invalidateAppModule(vite.environments.ssr, stamp)).toBe(true);
    expect(appNode()?.lastHMRTimestamp).toBe(stamp);
    expect(appNode()?.transformResult).toBeNull();
  });

  it("invalidates rex:app in every environment when a folder appears or vanishes under app/", async () => {
    await loadBundle();
    expect(appNode()?.transformResult).not.toBeNull();
    vite.watcher.emit("addDir", join(fixtureRoot, "src", "pages"));
    vite.watcher.emit("add", join(fixtureRoot, "application", "pages", "home", "page.ts"));
    expect(appNode()?.transformResult).not.toBeNull();
    vite.watcher.emit("addDir", join(fixtureRoot, "app", "pages", "drafts"));
    expect(appNode()?.transformResult).toBeNull();
    await loadBundle();
    expect(appNode()?.transformResult).not.toBeNull();
    vite.watcher.emit("unlinkDir", join(fixtureRoot, "app"));
    expect(appNode()?.transformResult).toBeNull();
  });

  it("serves rex:manifest as the prebuilt manifest of the same app", async () => {
    const bundle = await loadBundle();
    const container = vite.environments.ssr.pluginContainer;
    expect((await container.resolveId(APP_MODULE_ID))?.id).toBe(RESOLVED_APP_MODULE_ID);
    expect((await container.resolveId(MANIFEST_MODULE_ID))?.id).toBe(RESOLVED_MANIFEST_MODULE_ID);
    const loaded = (await vite.ssrLoadModule(MANIFEST_MODULE_ID)) as { readonly default: Manifest };
    expect(loaded.default).toEqual(bundle.manifest);
    expect(loaded.default.app).toEqual({ name: "fixture" });
  });
});

describe("a broken app layout", { timeout: SERVER_TIMEOUT_MS }, () => {
  let root: string;
  let vite: ViteDevServer;

  beforeAll(async () => {
    root = normalizePath(realpathSync(temp("rex-app-broken-")));
    cpSync(fixtureRoot, root, { recursive: true });
    symlinkSync(packageModules, join(root, "node_modules"), "dir");
    mkdirSync(join(root, "app", "pages", "Home"));
    vite = await createServer({
      root,
      configFile: false,
      logLevel: "silent",
      appType: "custom",
      resolve: { alias: brokenAlias },
      optimizeDeps: { noDiscovery: true },
      server: { middlewareMode: true, hmr: false, watch: null },
      plugins: rex({ name: "fixture" }),
    });
  });

  afterAll(async () => {
    await vite.close();
  });

  it("fails the rex:app load with the REX460 scan error", async () => {
    const message =
      "REX460 app/pages/Home: a page folder is named after its page id (lowercase letters, digits, dot and dash)";
    await expect(vite.ssrLoadModule(APP_MODULE_ID)).rejects.toThrow(message);
    await expect(vite.ssrLoadModule(APP_MODULE_ID)).rejects.toMatchObject({
      plugin: "rex:app",
      message: expect.stringContaining(message) as string,
    });
    expect(
      vite.environments.ssr.moduleGraph.getModuleById(RESOLVED_APP_MODULE_ID)?.transformResult,
    ).toBeFalsy();
  });
});
