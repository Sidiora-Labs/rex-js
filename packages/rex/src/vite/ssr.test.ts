import { existsSync } from "node:fs";
import { createServer as createHttpServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Hono } from "hono";
import { createServer, normalizePath, parseSync, type Plugin, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RexDocumentAssets } from "../server/ssr.ts";
import { DENSITY_HEADER } from "./dev-server.ts";
import { REX_HOOKS } from "./hooks.ts";
import { CSP_NONCE_META_PROPERTY } from "./nonce.ts";
import { createHookContext, rex } from "./plugin.ts";
import {
  DEV_DOCUMENT_TEMPLATE,
  RENDER_MODULE_ID,
  RESOLVED_RENDER_MODULE_ID,
  devAssets,
  devHeadHtml,
  generateRenderModule,
  isDocumentRequest,
  renderModulePlugin,
  ssrHook,
  ssrRuntimePath,
} from "./ssr.ts";
import { APP_MODULE_ID, ENTRY_MODULE_ID, ROOT_ELEMENT_ID } from "./virtual.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, "fixtures", "app");
const coreEntry = join(here, "..", "index.ts");
const alias = [{ find: /^@sidioralabs\/rex$/, replacement: coreEntry }];
const SSR = "/opt/rex/dist/server/ssr.js";
const SERVER_TIMEOUT_MS = 90_000;

const ASSETS: RexDocumentAssets = {
  scripts: ["/assets/index.js"],
  stylesheets: ["/assets/index.css"],
  preloads: ["/assets/shared.js"],
  pages: { home: { stylesheets: ["/assets/page-home.css"], preloads: ["/assets/page-home.js"] } },
};

function loadHandler(plugin: Plugin) {
  const hook = plugin.load;
  const handler = typeof hook === "function" ? hook : hook?.handler;
  if (handler === undefined) throw new Error(`${plugin.name} declares no load hook`);
  return handler;
}

describe("ssrRuntimePath", () => {
  it("points at the server renderer beside the plugin and at the built file for dist", () => {
    const runtime = ssrRuntimePath();
    expect(runtime).toBe(normalizePath(join(here, "..", "server", "ssr.ts")));
    expect(existsSync(runtime)).toBe(true);
    expect(ssrRuntimePath(pathToFileURL("/opt/rex/dist/vite/index.js").href)).toBe(SSR);
    expect(ssrRuntimePath(pathToFileURL("/opt/rex/src/vite/index.ts").href)).toBe(
      "/opt/rex/src/server/ssr.ts",
    );
  });
});

describe("generateRenderModule", () => {
  it("creates the renderer from the app bundle, the assets and the configured fonts", () => {
    const code = generateRenderModule({ ssr: SSR, assets: ASSETS });
    expect(parseSync("render.js", code).errors).toEqual([]);
    expect(code).toBe(
      [
        `import { createRexRenderer, registerPageRenderer } from ${JSON.stringify(SSR)};`,
        `import app, { config } from ${JSON.stringify(APP_MODULE_ID)};`,
        "",
        `export const assets = ${JSON.stringify(ASSETS)};`,
        `export const renderer = createRexRenderer({ bundle: app, assets, rootElement: ${JSON.stringify(ROOT_ELEMENT_ID)}, fonts: config.fonts });`,
        "registerPageRenderer(app.registry, renderer);",
        "export default renderer;",
        "",
      ].join("\n"),
    );
  });

  it("targets a custom root element", () => {
    const code = generateRenderModule({ ssr: SSR, assets: ASSETS, rootElement: "app" });
    expect(code).toContain('rootElement: "app"');
    expect(code).not.toContain(`rootElement: ${JSON.stringify(ROOT_ELEMENT_ID)}`);
  });
});

describe("the dev document", () => {
  it("extracts the inner head of the transformed template", () => {
    expect(DEV_DOCUMENT_TEMPLATE).toContain(`<div id="${ROOT_ELEMENT_ID}"></div>`);
    expect(DEV_DOCUMENT_TEMPLATE).toContain("<head></head>");
    expect(devHeadHtml(DEV_DOCUMENT_TEMPLATE)).toBe("");
    expect(
      devHeadHtml(
        '<!doctype html><html><head>\n  <meta charset="utf-8">\n  <script type="module" src="/@vite/client"></script>\n</head><body><div id="root"></div></body></html>',
      ),
    ).toBe('<meta charset="utf-8">\n  <script type="module" src="/@vite/client"></script>');
    expect(devHeadHtml('<HEAD lang="en"><title>x</title></HEAD>')).toBe("<title>x</title>");
    expect(devHeadHtml("<html><body></body></html>")).toBe("");
    expect(devHeadHtml("<head><title>open")).toBe("");
  });

  it("describes the dev assets as the entry module plus the transformed head", () => {
    const assets = devAssets('<meta name="x">');
    expect(assets).toEqual({
      scripts: [ENTRY_MODULE_ID],
      stylesheets: [],
      preloads: [],
      pages: {},
      head: '<meta name="x">',
    });
    expect(Object.isFrozen(assets)).toBe(true);
    expect(Object.isFrozen(assets.scripts)).toBe(true);
    expect(Object.isFrozen(assets.pages)).toBe(true);
  });
});

describe("isDocumentRequest", () => {
  const html = { accept: "text/html,application/xhtml+xml,*/*;q=0.8" };

  it("accepts GET and HEAD navigations for html", () => {
    expect(isDocumentRequest({ method: "GET", url: "/", headers: html })).toBe(true);
    expect(isDocumentRequest({ method: "HEAD", url: "/notes/1?x=1", headers: html })).toBe(true);
    expect(isDocumentRequest({ method: "GET", url: "/notes/1?density=agent", headers: html })).toBe(
      true,
    );
    expect(isDocumentRequest({ method: "GET", url: "/a.b/c", headers: html })).toBe(true);
  });

  it("refuses other methods, API paths, Vite internals, files and non-html accepts", () => {
    expect(isDocumentRequest({ method: "POST", url: "/", headers: html })).toBe(false);
    expect(isDocumentRequest({ url: "/", headers: html })).toBe(false);
    expect(isDocumentRequest({ method: "GET", headers: html })).toBe(false);
    expect(isDocumentRequest({ method: "GET", url: "/rex/rpc/send", headers: html })).toBe(false);
    expect(isDocumentRequest({ method: "GET", url: "/rex", headers: html })).toBe(false);
    expect(isDocumentRequest({ method: "GET", url: "/@vite/client", headers: html })).toBe(false);
    expect(isDocumentRequest({ method: "GET", url: "/@rex/entry", headers: html })).toBe(false);
    expect(isDocumentRequest({ method: "GET", url: "/__inspect/", headers: html })).toBe(false);
    expect(
      isDocumentRequest({ method: "GET", url: "/node_modules/react/index.js", headers: html }),
    ).toBe(false);
    expect(isDocumentRequest({ method: "GET", url: "/favicon.ico", headers: html })).toBe(false);
    expect(
      isDocumentRequest({ method: "GET", url: "/app/pages/home/view.tsx?t=1", headers: html }),
    ).toBe(false);
    expect(
      isDocumentRequest({ method: "GET", url: "/", headers: { accept: "application/json" } }),
    ).toBe(false);
    expect(isDocumentRequest({ method: "GET", url: "/", headers: {} })).toBe(false);
  });
});

describe("renderModulePlugin", () => {
  it("resolves rex:render and generates the module from the assets source", async () => {
    const plugin = renderModulePlugin(async () => ASSETS, SSR);
    expect(plugin.name).toBe("rex:render");
    expect(plugin.enforce).toBe("pre");
    const load = loadHandler(plugin);
    expect(await load.call(null as never, RESOLVED_RENDER_MODULE_ID)).toBe(
      generateRenderModule({ ssr: SSR, assets: ASSETS }),
    );
    expect(await load.call(null as never, RENDER_MODULE_ID)).toBeNull();
    expect(await load.call(null as never, "\0rex:app")).toBeNull();
    const defaults = renderModulePlugin(() => devAssets(""));
    expect(await loadHandler(defaults).call(null as never, RESOLVED_RENDER_MODULE_ID)).toBe(
      generateRenderModule({ ssr: ssrRuntimePath(), assets: devAssets("") }),
    );
  });

  it("is paired with the rex:ssr plugin by the ordered hook", () => {
    const plugins = ssrHook(createHookContext());
    expect(plugins.map((plugin) => [plugin.name, plugin.enforce])).toEqual([
      ["rex:render", "pre"],
      ["rex:ssr", "pre"],
    ]);
    expect(REX_HOOKS).toContain(ssrHook);
    expect(RESOLVED_RENDER_MODULE_ID).toBe(`\0${RENDER_MODULE_ID}`);
  });
});

describe("on the dev server", { timeout: SERVER_TIMEOUT_MS }, () => {
  let vite: ViteDevServer;
  let http: Server;
  let base: string;

  const server = new Hono().all("*", (c) =>
    c.text(`hono:${c.req.method}:${c.req.path}:${c.req.header(DENSITY_HEADER) ?? "-"}`),
  );

  beforeAll(async () => {
    vite = await createServer({
      root: fixtureRoot,
      configFile: false,
      logLevel: "silent",
      appType: "custom",
      resolve: { alias },
      server: { middlewareMode: true, hmr: false, watch: null },
      plugins: rex({ name: "fixture", server }),
    });
    http = createHttpServer(vite.middlewares);
    await new Promise<void>((done) => http.listen(0, "127.0.0.1", done));
    base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((done) => http.close(() => done()));
    await vite.close();
  });

  it("evaluates rex:render against the app bundle with the transformed dev head", async () => {
    const container = vite.environments.ssr.pluginContainer;
    expect((await container.resolveId(RENDER_MODULE_ID))?.id).toBe(RESOLVED_RENDER_MODULE_ID);
    const loaded = (await vite.ssrLoadModule(RENDER_MODULE_ID)) as {
      readonly assets: RexDocumentAssets;
      readonly renderer: { readonly render: unknown };
      readonly default: unknown;
    };
    expect(loaded.assets.scripts).toEqual([ENTRY_MODULE_ID]);
    expect(loaded.assets.stylesheets).toEqual([]);
    expect(loaded.assets.preloads).toEqual([]);
    expect(loaded.assets.pages).toEqual({});
    const head = loaded.assets.head ?? "";
    expect(head).toContain(`property="${CSP_NONCE_META_PROPERTY}"`);
    expect(head).toContain("/@vite/client");
    expect(head).not.toMatch(/<\/?head/i);
    expect(head).toBe(head.trim());
    expect(typeof loaded.renderer.render).toBe("function");
    expect(loaded.default).toBe(loaded.renderer);
  });

  it("hands document navigations to the configured server with the density forwarded", async () => {
    const page = await fetch(`${base}/notes/1`, { headers: { accept: "text/html,*/*;q=0.8" } });
    expect(page.status).toBe(200);
    expect(await page.text()).toBe("hono:GET:/notes/1:-");

    const dense = await fetch(`${base}/?density=agent`, { headers: { accept: "text/html" } });
    expect(await dense.text()).toBe("hono:GET:/:agent");

    const head = await fetch(`${base}/`, { method: "HEAD", headers: { accept: "text/html" } });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
  });

  it("leaves non-document requests to the rest of the middleware stack", async () => {
    for (const [url, init] of [
      ["/notes/1", { headers: { accept: "application/json" } }],
      ["/favicon.ico", { headers: { accept: "text/html" } }],
      ["/", { method: "POST", headers: { accept: "text/html" } }],
      ["/app/pages/home/view.tsx", { headers: { accept: "text/html" } }],
    ] as const) {
      const response = await fetch(`${base}${url}`, init);
      expect(await response.text(), url).not.toContain("hono:");
    }
    const api = await fetch(`${base}/rex/echo`, { headers: { accept: "text/html" } });
    expect(await api.text()).toBe("hono:GET:/rex/echo:-");
  });
});
