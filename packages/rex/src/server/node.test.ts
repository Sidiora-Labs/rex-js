import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createElement } from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SSR_ATTRIBUTE } from "../client/hydrate.ts";
import { view, type LazyPageModuleSet, type LoadedPageModules } from "../client/page.tsx";
import { action } from "../core/action.ts";
import { actor } from "../core/actor.ts";
import { page, type AnyPage } from "../core/page.ts";
import { always } from "../core/policy.ts";
import { createRegistry } from "../core/registry.ts";
import { boolean } from "../core/schema.ts";
import { z } from "zod/mini";
import { STATE_EXPORT_NAMES } from "../core/states.ts";
import { buildManifest, stableStringify } from "../manifest/build.ts";
import { createRexServer, memoryLedger, type RegistryRouterClient } from "./index.ts";
import { isApiPath, isPageRoutePath, startNodeServer, type RunningNodeServer } from "./adapters/node.ts";
import { RENDER_KIND_HEADER, RENDER_PAGE_HEADER } from "./routes/render.ts";
import { createRexRenderer, registerPageRenderer } from "./ssr.ts";

const INDEX_HTML = '<!doctype html><html><body><div id="root"></div></body></html>';
const APP_JS = 'console.log("rex");';

const toggleDust = action("toggle-dust", {
  input: z.object({ hide: boolean() }),
  output: z.object({ hide: boolean() }),
  policy: always(),
  effect: "reversible",
  handler: (input) => ({ hide: input.hide }),
});

const portfolio = page("portfolio", {
  route: "/portfolio/:account",
  params: z.object({ account: z.string() }),
  actions: [toggleDust],
});

const source = { entities: [], actions: [toggleDust], pages: [portfolio], policies: [] };

describe("startNodeServer", () => {
  let clientDir: string;
  let running: RunningNodeServer;

  beforeAll(async () => {
    clientDir = mkdtempSync(join(tmpdir(), "rex-node-"));
    mkdirSync(join(clientDir, "assets"));
    mkdirSync(join(clientDir, "rex"));
    writeFileSync(join(clientDir, "index.html"), INDEX_HTML);
    writeFileSync(join(clientDir, "assets", "app.js"), APP_JS);
    writeFileSync(join(clientDir, "rex", "health"), "shadowed");
    const app = createRexServer({
      registry: source,
      ledger: memoryLedger(),
      actor: () => actor({ id: "alice" }),
      app: "node-test",
    });
    running = await startNodeServer(app, { port: 0, clientDir, hostname: "127.0.0.1" });
  });

  afterAll(async () => {
    await running.close();
    rmSync(clientDir, { recursive: true, force: true });
  });

  it("listens on an ephemeral port", () => {
    expect(running.port).toBeGreaterThan(0);
    expect(running.url).toBe(`http://127.0.0.1:${running.port}`);
  });

  it("serves client assets from clientDir", async () => {
    const response = await fetch(`${running.url}/assets/app.js`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("javascript");
    expect(await response.text()).toBe(APP_JS);
  });

  it("serves index.html at the root and as the fallback for page routes", async () => {
    for (const path of ["/", "/portfolio/acc-1", "/send", "/portfolio/acc-1?act=toggle-dust"]) {
      const response = await fetch(`${running.url}${path}`);
      expect(response.status, path).toBe(200);
      expect(response.headers.get("content-type"), path).toContain("text/html");
      expect(await response.text(), path).toBe(INDEX_HTML);
    }
  });

  it("returns 404 for a missing asset instead of the page fallback", async () => {
    const response = await fetch(`${running.url}/assets/missing.js`);
    expect(response.status).toBe(404);
    expect(await response.text()).not.toBe(INDEX_HTML);
  });

  it("leaves /rex/* to the API even when clientDir has a matching file", async () => {
    const health = await fetch(`${running.url}/rex/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
    const manifest = await fetch(`${running.url}/rex/manifest`);
    expect(await manifest.text()).toBe(
      stableStringify(buildManifest(source, { app: "node-test" })),
    );
    const unknown = await fetch(`${running.url}/rex/unknown`);
    expect(unknown.status).toBe(404);
    expect(await unknown.text()).not.toBe(INDEX_HTML);
  });

  it("runs actions over RPC through the node server", async () => {
    const client: RegistryRouterClient<typeof source> = createORPCClient(
      new RPCLink({ url: `${running.url}/rex/rpc`, headers: { origin: running.url } }),
    );
    await expect(client["toggle-dust"]({ hide: true })).resolves.toEqual({ hide: true });
  });

  it("does not serve the page fallback for non-GET requests", async () => {
    const response = await fetch(`${running.url}/portfolio/acc-1`, { method: "POST" });
    expect(response.status).toBe(404);
  });

  it("refuses a missing client directory or index.html", async () => {
    const app = createRexServer({
      registry: source,
      ledger: memoryLedger(),
      actor: () => actor({ id: "alice" }),
    });
    expect(() => startNodeServer(app, { port: 0, clientDir: join(clientDir, "nope") })).toThrow(
      "is not a directory",
    );
    expect(() => startNodeServer(app, { port: 0, clientDir: join(clientDir, "assets") })).toThrow(
      "has no index.html",
    );
    expect(() => startNodeServer(app, { port: -1, clientDir })).toThrow(expect.objectContaining({ name: "RexError", code: "REX407" }));
  });

  it("classifies API and page route paths", () => {
    expect(isApiPath("/rex")).toBe(true);
    expect(isApiPath("/rex/rpc/send")).toBe(true);
    expect(isApiPath("/rexy")).toBe(false);
    expect(isPageRoutePath("/portfolio/acc-1")).toBe(true);
    expect(isPageRoutePath("/assets/app.js")).toBe(false);
  });
});

describe("startNodeServer close", () => {
  it("stops accepting connections after close", async () => {
    const clientDir = mkdtempSync(join(tmpdir(), "rex-node-close-"));
    writeFileSync(join(clientDir, "index.html"), INDEX_HTML);
    const app = createRexServer({
      registry: source,
      ledger: memoryLedger(),
      actor: () => actor({ id: "alice" }),
    });
    const server = await startNodeServer(app, { port: 0, clientDir, hostname: "127.0.0.1" });
    expect((await fetch(`${server.url}/rex/health`)).status).toBe(200);
    await server.close();
    await expect(fetch(`${server.url}/rex/health`)).rejects.toThrow();
    rmSync(clientDir, { recursive: true, force: true });
  });
});

function statesFor(label: string): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Object.values(STATE_EXPORT_NAMES).map((name) => [
      name,
      () => createElement("p", null, `${label}: ${name}`),
    ]),
  );
}

function lazySet(declared: AnyPage, loaded: LoadedPageModules): LazyPageModuleSet {
  return Object.freeze({
    page: declared,
    chunk: `page-${declared.id}`,
    load: () => Promise.resolve(loaded),
  });
}

describe("startNodeServer with a registered page renderer", () => {
  const ledger = memoryLedger();
  const registry = createRegistry().register(toggleDust, portfolio).freeze();
  const PortfolioView = view<{ account: string }>(({ params }) =>
    createElement("p", null, `Holdings of ${params.account}`),
  );
  let clientDir: string;
  let running: RunningNodeServer;

  beforeAll(async () => {
    clientDir = mkdtempSync(join(tmpdir(), "rex-node-ssr-"));
    mkdirSync(join(clientDir, "assets"));
    writeFileSync(join(clientDir, "index.html"), INDEX_HTML);
    writeFileSync(join(clientDir, "assets", "app.js"), APP_JS);
    registerPageRenderer(
      registry,
      createRexRenderer({
        bundle: {
          registry,
          manifest: buildManifest(registry, { app: "node-ssr" }),
          pages: [lazySet(portfolio, { view: PortfolioView, states: statesFor("Portfolio") })],
        },
      }),
    );
    const app = createRexServer({
      registry,
      ledger,
      actor: () => actor({ id: "alice" }),
      app: "node-ssr",
    });
    running = await startNodeServer(app, { port: 0, clientDir, hostname: "127.0.0.1" });
  });

  afterAll(async () => {
    await running.close();
    rmSync(clientDir, { recursive: true, force: true });
  });

  it("renders page routes on the server instead of serving index.html", async () => {
    const response = await fetch(`${running.url}/portfolio/acc-1`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get(RENDER_KIND_HEADER)).toBe("page");
    expect(response.headers.get(RENDER_PAGE_HEADER)).toBe("portfolio");
    const html = await response.text();
    expect(html).not.toBe(INDEX_HTML);
    expect(html).toContain(SSR_ATTRIBUTE);
    expect(html).toContain("Holdings of acc-1");
  });

  it("answers an unknown page route with the server-rendered 404 and no index.html fallback", async () => {
    for (const path of ["/", "/nowhere"]) {
      const response = await fetch(`${running.url}${path}`);
      expect(response.status, path).toBe(404);
      expect(response.headers.get(RENDER_KIND_HEADER), path).toBe("not-found");
      expect(await response.text(), path).not.toBe(INDEX_HTML);
    }
  });

  it("still serves client assets first and leaves /rex/* to the API", async () => {
    const asset = await fetch(`${running.url}/assets/app.js`);
    expect(asset.status).toBe(200);
    expect(await asset.text()).toBe(APP_JS);
    expect((await fetch(`${running.url}/assets/missing.js`)).status).toBe(404);
    const health = await fetch(`${running.url}/rex/health`);
    expect(await health.json()).toEqual({ status: "ok" });
  });
});
