import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createNetServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod/mini";
import { definePageModules, view } from "../../client/page.tsx";
import { ActionForm } from "../../client/form.tsx";
import { action } from "../../core/action.ts";
import { actor, anonymousActor } from "../../core/actor.ts";
import { page } from "../../core/page.ts";
import { always, can } from "../../core/policy.ts";
import { createRegistry } from "../../core/registry.ts";
import { buildManifest, stableStringify } from "../../manifest/build.ts";
import { boolean } from "../../schema/index.ts";
import { createRexServer } from "../app.ts";
import { memoryLedger } from "../audit.ts";
import { RENDER_KIND_HEADER, RENDER_PAGE_HEADER } from "../routes/render.ts";
import { createRexRenderer, registerPageRenderer, screenFromRequest } from "../ssr.ts";
import {
  createStaticCache,
  memoryStaticStore,
  registerStaticCache,
  renderPrerenderedHtml,
} from "./static-cache.ts";
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
  return createRexServer({
    registry: source,
    ledger: memoryLedger(),
    actor: () => alice,
    app: APP,
  });
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
  it("routes explicit and encoded index aliases through document policy and security", async () => {
    const member = actor({ id: "member", permissions: ["read-secret"] });
    const secret = page("secret", {
      route: "/secret",
      render: "ssg",
      policy: can("read-secret"),
      actions: [toggleDust],
    });
    const home = page("home", { route: "/", render: "ssg" });
    const registry = createRegistry().register(secret, home, toggleDust).freeze();
    const renderer = createRexRenderer({
      bundle: {
        registry,
        manifest: buildManifest(registry, { app: APP }),
        pages: [secret, home].map((declared) =>
          definePageModules({
            page: declared,
            view: view(() =>
              createElement(
                "div",
                null,
                createElement(
                  "p",
                  null,
                  declared === secret ? "Protected report" : "Home document",
                ),
                declared === secret ? createElement(ActionForm, { action: toggleDust }) : null,
              ),
            ),
            states: {
              Loading: () => createElement("p", null, "Loading document"),
              Empty: () => createElement("p", null, "Empty document"),
              Stale: () => createElement("p", null, "Stale document"),
              Partial: () => createElement("p", null, "Partial document"),
              Offline: () => createElement("p", null, "Offline document"),
              PermissionDenied: () => createElement("p", null, "Document access denied"),
              RecoverableError: () => createElement("p", null, "Document failed"),
              TerminalError: () => createElement("p", null, "Document unavailable"),
            },
          }),
        ),
      },
    });
    const rendered = await renderPrerenderedHtml(
      renderer,
      new URL("http://localhost/secret"),
      member,
    );
    const cache = createStaticCache({
      pages: [
        {
          path: "/secret",
          page: secret.id,
          render: "ssg",
          revalidate: null,
          file: "secret/index.html",
          generatedAt: Date.now(),
        },
      ],
      store: memoryStaticStore([["/secret", rendered.html]]),
      screen: screenFromRequest,
    });
    const unregisterRenderer = registerPageRenderer(registry, renderer);
    const unregisterCache = registerStaticCache(registry, cache);
    mkdirSync(join(clientDir, "secret"), { recursive: true });
    mkdirSync(join(clientDir, "orphan"), { recursive: true });
    writeFileSync(join(clientDir, "secret", INDEX_FILE), rendered.html);
    writeFileSync(join(clientDir, "orphan", INDEX_FILE), "Unregistered private artifact");
    const observedUrls: string[] = [];
    const outer = createNodeApp(
      createRexServer({
        registry,
        ledger: memoryLedger(),
        app: APP,
        actor: (request) => {
          observedUrls.push(request.url);
          return request.headers.get("authorization") === "Bearer member" ? member : anonymousActor;
        },
      }),
      clientDir,
    );
    try {
      for (const path of ["/secret/index.html", "/secret/%69ndex%2ehtml", "/%73ecret/index.html"]) {
        for (const method of ["GET", "HEAD"]) {
          const denied = await outer.request(`${path}?audit=retained`, { method });
          expect(denied.status).toBe(403);
          expect(denied.headers.get(RENDER_KIND_HEADER)).toBe("denied");
          expect(await denied.text()).not.toContain("Protected report");
        }
        const nonces = new Set<string>();
        for (let attempt = 0; attempt < 2; attempt++) {
          const allowed = await outer.request(`${path}?audit=retained`, {
            headers: { authorization: "Bearer member" },
          });
          expect(allowed.status).toBe(200);
          expect(allowed.headers.get("cache-control")).toBe("no-store");
          const nonce = allowed.headers
            .get("content-security-policy")
            ?.match(/'nonce-([^']+)'/)?.[1];
          expect(nonce).toBeTruthy();
          nonces.add(nonce as string);
          const html = await allowed.text();
          expect(html).toContain("Protected report");
          expect(html).toContain(`nonce="${nonce}"`);
          expect(html).not.toContain("rex-prerender-nonce");
          expect(allowed.headers.get("set-cookie")).toContain("rex-csrf=");
          expect(html).toMatch(/name="_csrf"[^>]*value="[0-9a-f]+"/);
        }
        expect(nonces.size).toBe(2);
        const head = await outer.request(path, {
          method: "HEAD",
          headers: { authorization: "Bearer member" },
        });
        expect(head.status).toBe(200);
        expect(await head.text()).toBe("");
      }
      expect(observedUrls).toContain("http://localhost/secret?audit=retained");
      for (const path of ["/orphan/index.html", "/orphan/%69ndex.html"]) {
        const missing = await outer.request(path);
        expect(missing.status).toBe(404);
        expect(await missing.text()).not.toContain("Unregistered private artifact");
      }
      const root = await outer.request("/%69ndex.html");
      expect(root.status).toBe(200);
      expect(await root.text()).toContain("Home document");
      expect(await (await outer.request("/assets/app.js")).text()).toBe(APP_JS);
      const noRenderer = createNodeApp(rexApp(), clientDir);
      const orphan = await noRenderer.request("/orphan/index.html");
      expect(orphan.status).toBe(404);
      expect(await orphan.text()).not.toContain("Unregistered private artifact");
    } finally {
      unregisterCache();
      unregisterRenderer();
    }
  });

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
    expect(() =>
      startNodeServer(rexApp(), { port: 0, clientDir: join(clientDir, "nope") }),
    ).toThrow(expect.objectContaining({ name: "RexError", code: "REX406" }));
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
