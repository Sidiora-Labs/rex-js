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
import {
  APP_MODULE_ID,
  ENTRY_MODULE_ID,
  RESOLVED_APP_MODULE_ID,
  RESOLVED_ENTRY_MODULE_ID,
  RexAppScanError,
  generateEntryModule,
  runtimePaths,
  runtimeStylesheets,
  scanApp,
  type RexAppBundle,
} from "./virtual.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, "fixtures", "app");
const coreEntry = join(here, "..", "index.ts");
const alias = [{ find: /^@sidioralabs\/rex$/, replacement: coreEntry }];
const fixture = (path: string) => normalizePath(join(fixtureRoot, path));

const BUNDLE_EXPORTS = [
  "actions",
  "app",
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
    expect(code).toContain('document.getElementById("root")');
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

describe("the client entry build", () => {
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
    expect(code).toContain('getElementById("root")');
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
  });
});

describe("rex() with the Vite dev server", () => {
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
    const [home, note] = bundle.pages;
    expect(home?.page.kind).toBe("page");
    expect(home?.page.id).toBe("home");
    expect(home?.page.actions.map((item) => item.id)).toEqual(["add-note"]);
    expect(home?.page.actions[0]).toBe(bundle.actions[0]);
    expect(typeof home?.view).toBe("function");
    expect(Object.keys(home?.states ?? {}).sort()).toEqual(HOME_STATE_EXPORTS);
    expect(Object.keys(home?.regions ?? {})).toEqual(["composer", "list"]);
    expect(typeof home?.regions.list).toBe("function");
    expect(Object.keys(home?.overlays ?? {})).toEqual(["NoteSheet"]);
    expect(typeof home?.overlays.NoteSheet).toBe("function");

    expect(note?.page.route).toBe("/notes/:noteId");
    expect(Object.keys(note?.states ?? {}).sort()).toEqual(
      (note?.page.states ?? [])
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
          'import { action, always, z } from "@sidioralabs/rex";',
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
