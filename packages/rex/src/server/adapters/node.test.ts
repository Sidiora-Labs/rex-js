import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createNetServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod/mini";
import { definePageModules, view } from "../../client/page.tsx";
import { action } from "../../core/action.ts";
import { actor } from "../../core/actor.ts";
import { page } from "../../core/page.ts";
import { always } from "../../core/policy.ts";
import { createRegistry } from "../../core/registry.ts";
import { buildManifest, stableStringify } from "../../manifest/build.ts";
import { boolean } from "../../schema/index.ts";
import { createRexServer } from "../app.ts";
import { memoryLedger } from "../audit.ts";
import { RENDER_KIND_HEADER, RENDER_PAGE_HEADER } from "../routes/render.ts";
import { createRexRenderer, registerPageRenderer } from "../ssr.ts";
import { ACCEPT_CH, ACCEPT_CH_HEADER } from "./client-hints.ts";
import {
  API_PREFIX,
  INDEX_FILE,
  createNodeApp,
  isApiPath,
  isPageRoutePath,
  startNodeServer,
} from "./node.ts";

const APP = "node-adapter";
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
  states: ["ready"],
});

const source = { entities: [], actions: [toggleDust], pages: [portfolio], policies: [] };
const alice = actor({ id: "alice" });

function rexApp() {
  return createRexServer({ registry: source, ledger: memoryLedger(), actor: () => alice, app: APP });
}

let clientDir: string;

beforeAll(() => {
  clientDir = mkdtempSync(join(tmpdir(), "rex-node-adapter-"));
  mkdirSync(join(clientDir, "assets"));
  mkdirSync(join(clientDir, "rex"));
  writeFileSync(join(clientDir, INDEX_FILE), INDEX_HTML);
  writeFileSync(join(clientDir, "assets", "app.js"), APP_JS);
  writeFileSync(join(clientDir, "rex", "health"), "shadowed");
});

afterAll(() => {
  rmSync(clientDir, { recursive: true, force: true });
});

describe("path classification", () => {
  it("treats /rex and its subpaths as the API and extensionless paths as page routes", () => {
    expect(API_PREFIX).toBe("/rex");
    expect(INDEX_FILE).toBe("index.html");
    expect(isApiPath("/rex")).toBe(true);
    expect(isApiPath("/rex/")).toBe(true);
    expect(isApiPath("/rex/rpc/send")).toBe(true);
    expect(isApiPath("/rexy")).toBe(false);
    expect(isApiPath("/")).toBe(false);
    expect(isPageRoutePath("/")).toBe(true);
    expect(isPageRoutePath("/portfolio/acc-1")).toBe(true);
    expect(isPageRoutePath("/v1.2/overview")).toBe(true);
    expect(isPageRoutePath("/assets/app.js")).toBe(false);
    expect(isPageRoutePath("/favicon.ico")).toBe(false);
  });
});

describe("createNodeApp", () => {
  it("refuses a client directory that is missing or has no index.html with REX406", () => {
    const app = rexApp();
    expect(() => createNodeApp(app, join(clientDir, "nope"))).toThrow(
      expect.objectContaining({
        name: "RexError",
        code: "REX406",
        message: expect.stringContaining("is not a directory"),
      }),
    );
    expect(() => createNodeApp(app, join(clientDir, "assets"))).toThrow(
      expect.objectContaining({
        name: "RexError",
        code: "REX406",
        message: expect.stringContaining(`has no ${INDEX_FILE}`),
      }),
    );
  });

  it("serves index.html for page routes, files for assets and leaves /rex to the API", async () => {
    const outer = createNodeApp(rexApp(), clientDir);
    const fallback = await outer.request("/portfolio/acc-1?act=toggle-dust");
    expect(fallback.status).toBe(200);
    expect(fallback.headers.get("content-type")).toContain("text/html");
    expect(fallback.headers.get(ACCEPT_CH_HEADER)).toBe(ACCEPT_CH);
    expect(await fallback.text()).toBe(INDEX_HTML);
    const head = await outer.request("/portfolio/acc-1", { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    const asset = await outer.request("/assets/app.js");
    expect(asset.status).toBe(200);
    expect(asset.headers.get(ACCEPT_CH_HEADER)).toBeNull();
    expect(await asset.text()).toBe(APP_JS);
    expect((await outer.request("/assets/missing.js")).status).toBe(404);
    const health = await outer.request("/rex/health");
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
    const manifest = await outer.request("/rex/manifest");
    expect(await manifest.text()).toBe(stableStringify(buildManifest(source, { app: APP })));
    const posted = await outer.request("/portfolio/acc-1", { method: "POST" });
    expect(posted.status).toBe(404);
    expect(await posted.text()).not.toBe(INDEX_HTML);
  });

  it("answers page routes from a registered page renderer and keeps serving the client files", async () => {
    const registry = createRegistry().register(toggleDust, portfolio).freeze();
    const unregister = registerPageRenderer(
      registry,
      createRexRenderer({
        bundle: {
          registry,
          manifest: buildManifest(registry, { app: APP }),
          pages: [
            definePageModules({
              page: portfolio,
              view: view<{ account: string }>(({ params }) =>
                createElement("p", null, `Holdings of ${params.account}`),
              ),
              states: {},
            }),
          ],
        },
      }),
    );
    try {
      const outer = createNodeApp(
        createRexServer({ registry, ledger: memoryLedger(), actor: () => alice, app: APP }),
        clientDir,
      );
      const rendered = await outer.request("/portfolio/acc-1", {
        headers: { accept: "text/html" },
      });
      expect(rendered.status).toBe(200);
      expect(rendered.headers.get(RENDER_KIND_HEADER)).toBe("page");
      expect(rendered.headers.get(RENDER_PAGE_HEADER)).toBe("portfolio");
      const html = await rendered.text();
      expect(html).not.toBe(INDEX_HTML);
      expect(html).toContain("Holdings of acc-1");
      const missing = await outer.request("/nowhere", { headers: { accept: "text/html" } });
      expect(missing.status).toBe(404);
      expect(missing.headers.get(RENDER_KIND_HEADER)).toBe("not-found");
      expect(await missing.text()).not.toBe(INDEX_HTML);
      const asset = await outer.request("/assets/app.js");
      expect(asset.headers.get(RENDER_KIND_HEADER)).toBeNull();
      expect(await asset.text()).toBe(APP_JS);
    } finally {
      unregister();
    }
  });
});

describe("startNodeServer", () => {
  it("validates the port with REX407 before touching the client directory", () => {
    for (const port of [-1, 65_536, 1.5]) {
      expect(
        () => startNodeServer(rexApp(), { port, clientDir: join(clientDir, "nope") }),
        String(port),
      ).toThrow(expect.objectContaining({ name: "RexError", code: "REX407" }));
    }
    expect(() => startNodeServer(rexApp(), { port: 0, clientDir: join(clientDir, "nope") })).toThrow(
      expect.objectContaining({ name: "RexError", code: "REX406" }),
    );
  });

  it("listens on an ephemeral port, reports localhost without a hostname and releases the socket on close", async () => {
    const running = await startNodeServer(rexApp(), { port: 0, clientDir });
    try {
      expect(running.port).toBeGreaterThan(0);
      expect(running.url).toBe(`http://localhost:${running.port}`);
      expect(running.server.listening).toBe(true);
      const health = await fetch(`http://127.0.0.1:${running.port}/rex/health`);
      expect(await health.json()).toEqual({ status: "ok" });
      const fallback = await fetch(`http://127.0.0.1:${running.port}/portfolio/acc-1`);
      expect(fallback.headers.get(ACCEPT_CH_HEADER)).toBe(ACCEPT_CH);
      expect(await fallback.text()).toBe(INDEX_HTML);
    } finally {
      await running.close();
    }
    expect(running.server.listening).toBe(false);
    await expect(fetch(`http://127.0.0.1:${running.port}/rex/health`)).rejects.toThrow();
  });

  it("binds the given hostname into the reported url", async () => {
    const running = await startNodeServer(rexApp(), { port: 0, clientDir, hostname: "127.0.0.1" });
    try {
      expect(running.url).toBe(`http://127.0.0.1:${running.port}`);
      expect((await fetch(`${running.url}/rex/health`)).status).toBe(200);
    } finally {
      await running.close();
    }
  });

  it("rejects when the port is already taken", async () => {
    const taken = createNetServer();
    await new Promise<void>((done, fail) => {
      taken.once("error", fail);
      taken.listen(0, "127.0.0.1", () => done());
    });
    const { port } = taken.address() as AddressInfo;
    try {
      await expect(
        startNodeServer(rexApp(), { port, clientDir, hostname: "127.0.0.1" }),
      ).rejects.toThrow(expect.objectContaining({ code: "EADDRINUSE" }));
    } finally {
      await new Promise<void>((done) => taken.close(() => done()));
    }
  });
});
