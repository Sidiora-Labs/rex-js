import { existsSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import { createServer as createHttpServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { build, createServer, normalizePath, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stateExportName } from "../core/states.ts";
import { DENSITY_HEADER, isApiPath, rex } from "./index.ts";
import { loadRexConfig } from "../cli/config.ts";
import { configPluginOptions } from "../cli/load.ts";
import { chunkBudgets, resolveBudgets } from "./budgets.ts";
import {
  PAGE_BUDGET_KB,
  chunkTable,
  formatChunkTable,
  pageChunkGroups,
  pageIdOfModule,
} from "./split.ts";
import {
  APP_MODULE_ID,
  ENTRY_MODULE_ID,
  PAGE_CHUNK_PREFIX,
  RESOLVED_APP_MODULE_ID,
  RESOLVED_ENTRY_MODULE_ID,
  RESOLVED_MANIFEST_MODULE_ID,
  RexAppScanError,
  generateEntryModule,
  runtimePaths,
  runtimeStylesheets,
  scanApp,
  type RexAppBundle,
  type RexAppConfig,
} from "./virtual.ts";

const VITE_TEST_TIMEOUT_MS = 20_000;
const DEMO_BUILD_TIMEOUT_MS = 240_000;
const DEVTOOLS_BUILD_TIMEOUT_MS = 120_000;
const here = dirname(fileURLToPath(import.meta.url));
const demoRoot = join(here, "..", "..", "..", "..", "examples", "demo");
const fixtureRoot = join(here, "fixtures", "app");
const coreEntry = join(here, "..", "index.ts");
const alias = [{ find: /^@sidioralabs\/rex$/, replacement: coreEntry }];
const fixture = (path: string) => normalizePath(join(fixtureRoot, path));
const MANIFEST_BUILDERS = /\/src\/manifest\/(build|json-schema|sidecar\.schema)\.ts$/;

const BUNDLE_EXPORTS = [
  "actions",
  "app",
  "config",
  "default",
  "entities",
  "flows",
  "manifest",
  "pages",
  "policies",
  "registry",
];

const HOME_STATE_EXPORTS = [
  "Empty",
  "Loading",
  "Offline",
  "Partial",
  "PermissionDenied",
  "RecoverableError",
  "Stale",
  "TerminalError",
];

describe("scanApp", () => {
  it("maps the page folder convention without barrels", () => {
    const scan = scanApp(fixtureRoot);
    expect(scan.root).toBe(normalizePath(fixtureRoot));
    expect(scan.appDir).toBe(fixture("app"));
    expect(scan.entities).toEqual([fixture("app/entities/note.ts")]);
    expect(scan.actions).toEqual([fixture("app/actions/add-note.ts")]);
    expect(scan.policies).toEqual([fixture("app/policies/notes.ts")]);
    expect(scan.flows).toEqual([]);
    expect(scan.pages.map((entry) => entry.id)).toEqual(["home", "note"]);
    const [home, note] = scan.pages;
    expect(home).toEqual({
      id: "home",
      dir: fixture("app/pages/home"),
      page: fixture("app/pages/home/page.ts"),
      view: fixture("app/pages/home/view.tsx"),
      states: fixture("app/pages/home/states.tsx"),
      regions: [
        { name: "composer", file: fixture("app/pages/home/regions/composer/region.tsx") },
        { name: "list", file: fixture("app/pages/home/regions/list/region.tsx") },
      ],
      overlays: [{ name: "NoteSheet", file: fixture("app/pages/home/overlays/NoteSheet.tsx") }],
    });
    expect(note?.regions.map((region) => region.name)).toEqual(["detail"]);
    expect(note?.overlays).toEqual([]);
  });

  it("is deterministic across calls", () => {
    expect(scanApp(fixtureRoot)).toEqual(scanApp(fixtureRoot));
  });

  it("refuses a root without an app directory", () => {
    expect(() => scanApp(join(fixtureRoot, "app", "pages"))).toThrow(RexAppScanError);
  });

  it("generates the client entry that loads the stylesheets and mounts the assembled app", () => {
    const client = runtimePaths().client;
    const code = generateEntryModule({ client });
    const tokens = normalizePath(join(here, "..", "client", "tokens.css"));
    const density = normalizePath(join(here, "..", "client", "agent", "density.css"));
    expect(runtimeStylesheets(client)).toEqual([tokens, density]);
    const lines = code.split("\n");
    expect(lines[0]).toBe(`import ${JSON.stringify(tokens)};`);
    expect(lines[1]).toBe(`import ${JSON.stringify(density)};`);
    expect(code).toContain(`import { createRexEntry } from ${JSON.stringify(client)};`);
    expect(code).toContain(`import app from "${APP_MODULE_ID}";`);
    expect(code).toContain("const RexEntry = createRexEntry(app);");
    expect(code).toContain(
      "createRoot(container).render(createElement(StrictMode, null, createElement(RexEntry)));",
    );
    expect(code).toContain('const container = findRootElement("root");');
    for (const file of [tokens, density]) expect(existsSync(file)).toBe(true);
  });

  it("points the runtime at the package entries next to the plugin", () => {
    expect(runtimePaths()).toEqual({
      core: normalizePath(coreEntry),
      client: normalizePath(join(here, "..", "client", "index.ts")),
    });
    expect(runtimePaths("file:///opt/rex/dist/vite/index.js")).toEqual({
      core: "/opt/rex/dist/index.js",
      client: "/opt/rex/dist/client/index.js",
    });
  });
});

describe("rex() with the Vite build API", () => {
  it("builds the rex:app virtual module from the fixture app", async () => {
    const result = await build({
      root: fixtureRoot,
      configFile: false,
      logLevel: "silent",
      resolve: { alias },
      plugins: [rex({ name: "fixture" })],
      build: {
        ssr: true,
        write: false,
        minify: false,
        rolldownOptions: { input: APP_MODULE_ID },
      },
    });
    const outputs = Array.isArray(result) ? result : [result];
    const chunks = outputs.flatMap((output) =>
      "output" in output ? output.output.filter((item) => item.type === "chunk") : [],
    );
    const entry = chunks.find((chunk) => chunk.isEntry);
    expect(entry).toBeDefined();
    expect([...(entry?.exports ?? [])].sort()).toEqual(BUNDLE_EXPORTS);
    const modules = chunks.flatMap((chunk) => chunk.moduleIds.map(normalizePath));
    expect(modules).toContain(RESOLVED_APP_MODULE_ID);
    expect(modules).toContain(RESOLVED_MANIFEST_MODULE_ID);
    expect(modules.filter((id) => MANIFEST_BUILDERS.test(id))).toEqual([]);
    for (const file of [
      "app/entities/note.ts",
      "app/policies/notes.ts",
      "app/actions/add-note.ts",
      "app/pages/home/page.ts",
      "app/pages/home/view.tsx",
      "app/pages/home/states.tsx",
      "app/pages/home/regions/list/region.tsx",
      "app/pages/home/regions/list/parts/NoteRow.tsx",
      "app/pages/home/regions/composer/region.tsx",
      "app/pages/home/overlays/NoteSheet.tsx",
      "app/pages/note/page.ts",
      "app/pages/note/view.tsx",
      "app/pages/note/states.tsx",
      "app/pages/note/regions/detail/region.tsx",
    ]) {
      expect(modules).toContain(fixture(file));
    }
  });
});

describe("the client entry build", { timeout: VITE_TEST_TIMEOUT_MS }, () => {
  it("bundles /@rex/entry into a client that mounts the shell, the agent surfaces and the stylesheets", async () => {
    const result = await build({
      root: fixtureRoot,
      configFile: false,
      logLevel: "silent",
      resolve: { alias },
      plugins: [rex({ name: "fixture" })],
      build: { write: false, minify: false },
    });
    const outputs = Array.isArray(result) ? result : [result];
    const items = outputs.flatMap((output) => ("output" in output ? output.output : []));
    const chunks = items.filter((item) => item.type === "chunk");
    const entry = chunks.find((chunk) => chunk.isEntry);
    expect(entry).toBeDefined();
    const modules = chunks.flatMap((chunk) => chunk.moduleIds.map(normalizePath));
    expect(modules).toContain(RESOLVED_ENTRY_MODULE_ID);
    expect(modules).toContain(RESOLVED_APP_MODULE_ID);
    expect(modules).toContain(RESOLVED_MANIFEST_MODULE_ID);
    expect(modules.filter((id) => MANIFEST_BUILDERS.test(id))).toEqual([]);
    expect(modules).not.toContain(normalizePath(join(here, "..", "core", "config.ts")));
    for (const file of [
      "shell.tsx",
      "app.tsx",
      "agent/confirm.tsx",
      "agent/outcome.tsx",
      "agent/sidecar.tsx",
      "agent/palette.tsx",
      "agent/shortcuts.ts",
      "agent/url-invoke.ts",
      "agent/density.ts",
    ]) {
      expect(modules).toContain(normalizePath(join(here, "..", "client", file)));
    }
    const code = chunks.map((chunk) => chunk.code).join("\n");
    expect(code).toContain("data-rex-shell");
    expect(code).toContain("application/rex+json");
    expect(code).toContain('findRootElement("root")');
    const css = items
      .filter((item) => item.type === "asset" && item.fileName.endsWith(".css"))
      .map((item) => (item.type === "asset" ? String(item.source) : ""))
      .join("\n");
    const tokenRule = css.indexOf("--rex-space-1");
    const densityRule = css.indexOf("animation-delay");
    expect(tokenRule).toBeGreaterThanOrEqual(0);
    expect(densityRule).toBeGreaterThan(tokenRule);
    const html = items.find((item) => item.type === "asset" && item.fileName === "index.html");
    expect(html?.type === "asset" ? String(html.source) : "").toContain(entry?.fileName ?? "-");

    const pageChunks = chunks.filter((chunk) => chunk.name.startsWith("page-"));
    expect(pageChunks.map((chunk) => chunk.name).sort()).toEqual(["page-home", "page-note"]);
    const home = pageChunks.find((chunk) => chunk.name === "page-home");
    expect(home?.isEntry).toBe(false);
    expect(home?.moduleIds.map(normalizePath)).toEqual(
      expect.arrayContaining([
        fixture("app/pages/home/view.tsx"),
        fixture("app/pages/home/states.tsx"),
        fixture("app/pages/home/regions/list/region.tsx"),
        fixture("app/pages/home/regions/list/parts/NoteRow.tsx"),
        fixture("app/pages/home/overlays/NoteSheet.tsx"),
      ]),
    );
    expect(home?.moduleIds.map(normalizePath)).not.toContain(fixture("app/pages/home/page.ts"));
    expect(entry?.moduleIds.map(normalizePath)).not.toContain(fixture("app/pages/home/view.tsx"));
    expect(entry?.dynamicImports.length).toBeGreaterThanOrEqual(2);
    for (const chunk of pageChunks) {
      const pageId = chunk.name.slice(PAGE_CHUNK_PREFIX.length);
      const outside = chunk.moduleIds
        .map(normalizePath)
        .filter((id) => pageIdOfModule(id, fixture("app")) !== pageId);
      expect(outside, `${chunk.name} holds only modules under app/pages/${pageId}`).toEqual([]);
    }
    expect(modules).toContain(normalizePath(join(here, "..", "client", "shell.tsx")));
    const shared = chunks.filter((chunk) => !chunk.name.startsWith(PAGE_CHUNK_PREFIX));
    expect(
      shared.flatMap((chunk) => chunk.moduleIds).some((id) => id.includes("/node_modules/react")),
    ).toBe(true);

    const rows = chunkTable(items);
    const pageRows = rows.filter((row) => row.name.startsWith("page-"));
    expect(pageRows.map((row) => [row.name, row.budget, row.over])).toEqual([
      ["page-home", PAGE_BUDGET_KB, false],
      ["page-note", PAGE_BUDGET_KB, false],
    ]);
    for (const row of rows) {
      expect(row.gzip).toBeGreaterThan(0);
      expect(row.raw).toBeGreaterThanOrEqual(row.gzip);
    }
    const table = formatChunkTable(rows);
    expect(table.split("\n")[0]).toMatch(/^chunk\s+raw\s+gzip\s+budget$/);
    expect(table).toMatch(/^page-home\s+[\d.]+ KB\s+[\d.]+ KB\s+50 KB$/m);
    expect(table).toMatch(/^page-note\s+[\d.]+ KB\s+[\d.]+ KB\s+50 KB$/m);
    const over = chunkTable(items, { page: 0.01 }).filter((row) => row.over);
    expect(over.map((row) => row.name)).toEqual(["page-home", "page-note"]);
    expect(formatChunkTable(over)).toContain("0.01 KB OVER");
  });

  it("assigns page folder modules except page.ts to the page chunk", () => {
    const appPath = fixture("app");
    const [group, ...rest] = pageChunkGroups(appPath);
    expect(rest).toEqual([]);
    expect(group?.includeDependenciesRecursively).toBe(false);
    expect(group?.name(fixture("app/pages/home/view.tsx"))).toBe("page-home");
    expect(group?.name(fixture("app/components/ui/button.tsx"))).toBeNull();
    expect(group?.name(normalizePath(join(here, "..", "client", "shell.tsx")))).toBeNull();
    expect(pageIdOfModule(fixture("app/pages/home/view.tsx"), appPath)).toBe("home");
    expect(pageIdOfModule(fixture("app/pages/home/regions/list/parts/NoteRow.tsx"), appPath)).toBe(
      "home",
    );
    expect(pageIdOfModule(fixture("app/pages/home/page.ts"), appPath)).toBeNull();
    expect(pageIdOfModule(fixture("app/actions/add-note.ts"), appPath)).toBeNull();
  });
});

describe("the demo client build", { timeout: DEMO_BUILD_TIMEOUT_MS }, () => {
  it("keeps every demo page chunk to its page folder and under the page budget", async () => {
    const loaded = await loadRexConfig(demoRoot);
    const result = await build({
      root: demoRoot,
      configFile: false,
      logLevel: "silent",
      plugins: rex(configPluginOptions(loaded.read)),
      build: { write: false, manifest: true },
    });
    const outputs = Array.isArray(result) ? result : [result];
    const items = outputs.flatMap((output) => ("output" in output ? output.output : []));
    const chunks = items.filter((item) => item.type === "chunk");
    const appPath = normalizePath(join(demoRoot, "app"));
    const pageChunks = chunks.filter((chunk) => chunk.name.startsWith(PAGE_CHUNK_PREFIX));
    expect(pageChunks.map((chunk) => chunk.name).sort()).toEqual([
      "page-portfolio",
      "page-send",
    ]);
    for (const chunk of pageChunks) {
      const pageId = chunk.name.slice(PAGE_CHUNK_PREFIX.length);
      const outside = chunk.moduleIds
        .map(normalizePath)
        .filter((id) => pageIdOfModule(id, appPath) !== pageId);
      expect(outside, `${chunk.name} holds only modules under app/pages/${pageId}`).toEqual([]);
    }
    const budgets = chunkBudgets(resolveBudgets(loaded.read));
    const rows = chunkTable(items, budgets);
    const pageRows = rows.filter((row) => row.name.startsWith(PAGE_CHUNK_PREFIX));
    expect(pageRows.map((row) => [row.name, row.budget])).toEqual([
      ["page-portfolio", budgets.page],
      ["page-send", budgets.page],
    ]);
    for (const row of pageRows) {
      expect(row.gzip, `${row.name}\n${formatChunkTable(rows)}`).toBeLessThanOrEqual(
        budgets.page * 1024,
      );
      expect(row.over).toBe(false);
    }
    expect(rows.filter((row) => row.over)).toEqual([]);
  });
});

describe("the devtools in client builds", { timeout: DEVTOOLS_BUILD_TIMEOUT_MS }, () => {
  const devtoolsDir = normalizePath(join(here, "..", "client", "devtools"));
  const devtoolsSlot = normalizePath(join(here, "..", "client", "shell", "devtools-slot.tsx"));

  async function buildClient(nodeEnv: string, devtools?: boolean) {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = nodeEnv;
    try {
      const result = await build({
        root: fixtureRoot,
        configFile: false,
        logLevel: "silent",
        resolve: { alias },
        plugins: [rex(devtools === undefined ? { name: "fixture" } : { name: "fixture", devtools })],
        build: { write: false, minify: false },
      });
      const outputs = Array.isArray(result) ? result : [result];
      const chunks = outputs
        .flatMap((output) => ("output" in output ? output.output : []))
        .filter((item) => item.type === "chunk");
      return {
        modules: chunks.flatMap((chunk) => chunk.moduleIds.map(normalizePath)),
        code: chunks.map((chunk) => chunk.code).join("\n"),
      };
    } finally {
      process.env.NODE_ENV = previous;
    }
  }

  const devtoolsModules = (modules: readonly string[]) =>
    modules.filter((id) => id.startsWith(`${devtoolsDir}/`) || id === devtoolsSlot);

  it("leaves the devtools module out of the production bundle", async () => {
    const { modules, code } = await buildClient("production");
    expect(modules).toContain(normalizePath(join(here, "..", "client", "shell.tsx")));
    expect(devtoolsModules(modules)).toEqual([]);
    expect(code).not.toContain("data-rex-devtools");
    expect(code).not.toContain("rex-devtools");
  });

  it("bundles the devtools in development and drops them when devtools is false", async () => {
    const development = await buildClient("development");
    expect(devtoolsModules(development.modules)).toEqual(
      expect.arrayContaining([
        `${devtoolsDir}/devtools.tsx`,
        `${devtoolsDir}/provider.tsx`,
        `${devtoolsDir}/panels.tsx`,
        devtoolsSlot,
      ]),
    );
    expect(development.code).toContain("data-rex-devtools");

    const disabled = await buildClient("development", false);
    expect(devtoolsModules(disabled.modules)).toEqual([]);
    expect(disabled.code).not.toContain("data-rex-devtools");
  });
});

describe("rex() with the Vite dev server", { timeout: VITE_TEST_TIMEOUT_MS }, () => {
  let vite: ViteDevServer;
  let http: Server;
  let base: string;
  let sourceArgument: unknown = null;

  const api = new Hono()
    .get("/rex/echo", (c) =>
      c.json({ path: c.req.path, density: c.req.header(DENSITY_HEADER) ?? null }),
    )
    .post("/rex/echo", async (c) => c.json({ body: await c.req.json<unknown>() }))
    .all("*", (c) => c.text(`hono:${c.req.path}`, 404));

  const loadBundle = async () =>
    (await vite.ssrLoadModule(APP_MODULE_ID)) as RexAppBundle & {
      readonly app: RexAppBundle;
      readonly config: RexAppConfig;
      readonly default: RexAppBundle;
    };

  beforeAll(async () => {
    vite = await createServer({
      root: fixtureRoot,
      configFile: false,
      logLevel: "silent",
      appType: "custom",
      resolve: { alias },
      server: { middlewareMode: true, hmr: false },
      plugins: [
        rex({
          name: "fixture",
          server: (server) => {
            sourceArgument = server;
            return api;
          },
        }),
      ],
    });
    http = createHttpServer(vite.middlewares);
    await new Promise<void>((done) => http.listen(0, "127.0.0.1", done));
    base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((done) => http.close(() => done()));
    await vite.close();
  });

  it("exports the typed app bundle from rex:app", async () => {
    const bundle = await loadBundle();
    expect(Object.keys(bundle).sort()).toEqual(BUNDLE_EXPORTS);
    expect(bundle.config).toEqual({ fonts: [], i18n: null });
    expect(Object.isFrozen(bundle.config)).toBe(true);
    expect(bundle.default).toBe(bundle.app);
    expect(bundle.app.name).toBe("fixture");
    expect(bundle.app.registry).toBe(bundle.registry);
    expect(bundle.app.manifest).toBe(bundle.manifest);
    expect(Object.isFrozen(bundle.app)).toBe(true);

    expect(bundle.entities.map((item) => item.id)).toEqual(["note"]);
    expect(bundle.actions.map((item) => item.id)).toEqual(["add-note"]);
    expect(bundle.policies.map((item) => item.id)).toEqual(["notes"]);
    expect(bundle.flows).toEqual([]);

    expect(bundle.pages.map((entry) => entry.id)).toEqual(["home", "note"]);
    const [homeEntry, noteEntry] = bundle.pages;
    expect(homeEntry?.page.kind).toBe("page");
    expect(homeEntry?.page.id).toBe("home");
    expect(homeEntry?.page.actions.map((item) => item.id)).toEqual(["add-note"]);
    expect(homeEntry?.page.actions[0]).toBe(bundle.actions[0]);
    expect(homeEntry?.chunk).toBe("page-home");
    expect(noteEntry?.chunk).toBe("page-note");
    expect(Object.keys(homeEntry ?? {}).sort()).toEqual(["chunk", "id", "load", "page"]);
    const home = await homeEntry?.load();
    expect(await homeEntry?.load()).toBe(home);
    expect(typeof home?.view).toBe("function");
    expect(Object.keys(home?.states ?? {}).sort()).toEqual(HOME_STATE_EXPORTS);
    expect(Object.keys(home?.regions ?? {})).toEqual(["composer", "list"]);
    expect(typeof home?.regions.list).toBe("function");
    expect(Object.keys(home?.overlays ?? {})).toEqual(["NoteSheet"]);
    expect(typeof home?.overlays.NoteSheet).toBe("function");

    const note = await noteEntry?.load();
    expect(noteEntry?.page.route).toBe("/notes/:noteId");
    expect(Object.keys(note?.states ?? {}).sort()).toEqual(
      (noteEntry?.page.states ?? [])
        .filter((state) => state !== "ready")
        .map(stateExportName)
        .sort(),
    );
    expect(Object.keys(note?.regions ?? {})).toEqual(["detail"]);
    expect(note?.overlays).toEqual({});
  });

  it("registers every declaration and derives the manifest from the registry", async () => {
    const bundle = await loadBundle();
    expect(bundle.registry.pages.map((item) => item.id)).toEqual(["home", "note"]);
    expect(bundle.registry.get("action", "add-note")).toBe(bundle.actions[0]);
    expect(bundle.manifest.app).toEqual({ name: "fixture" });
    expect(bundle.manifest.entities.map((item) => item.id)).toEqual(["note"]);
    expect(bundle.manifest.policies).toEqual([{ id: "notes", permissions: ["notes.write"] }]);
    expect(
      bundle.manifest.pages.map((item) => ({
        id: item.id,
        route: item.route,
        regions: item.regions,
        overlays: item.overlays.map((overlay) => overlay.id),
        actions: item.actions,
        back: item.chrome.back,
      })),
    ).toEqual([
      {
        id: "home",
        route: "/",
        regions: ["list", "composer"],
        overlays: ["NoteSheet"],
        actions: ["add-note"],
        back: null,
      },
      {
        id: "note",
        route: "/notes/:noteId",
        regions: ["detail"],
        overlays: [],
        actions: [],
        back: "home",
      },
    ]);
  });

  it("resolves /@rex/entry to the generated client entry", async () => {
    const container = vite.environments.client.pluginContainer;
    const resolved = await container.resolveId(ENTRY_MODULE_ID);
    expect(resolved?.id).toBe(RESOLVED_ENTRY_MODULE_ID);
    const loaded = await container.load(RESOLVED_ENTRY_MODULE_ID);
    const code = typeof loaded === "string" ? loaded : loaded?.code;
    expect(code).toBe(generateEntryModule({ client: runtimePaths().client }));
    expect((await container.resolveId(APP_MODULE_ID))?.id).toBe(RESOLVED_APP_MODULE_ID);
  });

  it("invalidates rex:app when a file is added or removed under app/", async () => {
    const extra = join(fixtureRoot, "app", "actions", "archive-note.ts");
    const graph = vite.environments.ssr.moduleGraph;
    try {
      await loadBundle();
      expect(graph.getModuleById(RESOLVED_APP_MODULE_ID)?.transformResult).not.toBeNull();

      vite.watcher.emit("add", join(fixtureRoot, "index.html"));
      expect(graph.getModuleById(RESOLVED_APP_MODULE_ID)?.transformResult).not.toBeNull();

      await writeFile(
        extra,
        [
          'import { action, always } from "@sidioralabs/rex";',
          'import { z } from "zod/mini";',
          "",
          'export const archiveNote = action("archive-note", {',
          "  input: z.object({}),",
          "  output: z.object({ archived: z.boolean() }),",
          "  policy: always(),",
          '  effect: "irreversible",',
          "  handler: () => ({ archived: true }),",
          "});",
          "",
        ].join("\n"),
      );
      vite.watcher.emit("add", extra);
      expect(graph.getModuleById(RESOLVED_APP_MODULE_ID)?.transformResult).toBeNull();
      const added = await loadBundle();
      expect(added.actions.map((item) => item.id)).toEqual(["add-note", "archive-note"]);
      expect(added.manifest.actions.map((item) => item.id)).toEqual(["add-note", "archive-note"]);

      await unlink(extra);
      vite.watcher.emit("unlink", extra);
      expect(graph.getModuleById(RESOLVED_APP_MODULE_ID)?.transformResult).toBeNull();
      const removed = await loadBundle();
      expect(removed.actions.map((item) => item.id)).toEqual(["add-note"]);
    } finally {
      if (existsSync(extra)) await unlink(extra);
    }
  });

  it("mounts the provided Hono app under /rex and forwards the density header", async () => {
    const response = await fetch(`${base}/rex/echo`, { headers: { [DENSITY_HEADER]: "agent" } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ path: "/rex/echo", density: "agent" });
    expect((sourceArgument as ViteDevServer).config).toBe(vite.config);

    const fromQuery = await fetch(`${base}/rex/echo?density=agent`);
    expect(await fromQuery.json()).toEqual({ path: "/rex/echo", density: "agent" });

    const plain = await fetch(`${base}/rex/echo`);
    expect(await plain.json()).toEqual({ path: "/rex/echo", density: null });

    const posted = await fetch(`${base}/rex/echo`, {
      method: "POST",
      headers: { "content-type": "application/json", [DENSITY_HEADER]: "default" },
      body: JSON.stringify({ id: "send" }),
    });
    expect(await posted.json()).toEqual({ body: { id: "send" } });

    const missing = await fetch(`${base}/rex/missing`);
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe("hono:/rex/missing");

    const outside = await fetch(`${base}/rexotic`);
    expect(await outside.text()).not.toContain("hono:");
  });

  it("recognises only the /rex prefix as the API", () => {
    expect(isApiPath("/rex")).toBe(true);
    expect(isApiPath("/rex/rpc/send")).toBe(true);
    expect(isApiPath("/rex?density=agent")).toBe(true);
    expect(isApiPath("/rexotic")).toBe(false);
    expect(isApiPath("/@rex/entry")).toBe(false);
    expect(isApiPath(undefined)).toBe(false);
  });
});
