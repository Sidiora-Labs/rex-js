import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer, type AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import { getRequestListener, type Http2Bindings, type HttpBindings } from "@hono/node-server";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createElement } from "react";
import { build } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import { action } from "../../core/action.ts";
import { actor } from "../../core/actor.ts";
import { REX_ERRORS_DOCS_BASE } from "../../core/errors.ts";
import { REX_ERROR_DOCS, errorHint } from "../../core/errors.docs.ts";
import { page } from "../../core/page.ts";
import { createRegistry } from "../../core/registry.ts";
import { definePageModules, view } from "../../client/page.tsx";
import { always } from "../../core/policy.ts";
import { boolean } from "../../schema/index.ts";
import { z } from "zod/mini";
import { buildManifest, stableStringify } from "../../manifest/build.ts";
import { createRexServer, memoryLedger, type RegistryRouterClient } from "../index.ts";
import { createRexRenderer, registerPageRenderer } from "../ssr.ts";
import * as legacyNode from "../node.ts";
import {
  startBunServer,
  type BunFetchHandler,
  type BunRuntime,
  type BunServeOptions,
  type BunServer,
} from "./bun.ts";
import {
  startDenoServer,
  type DenoHttpServer,
  type DenoNetAddr,
  type DenoRuntime,
  type DenoServeHandler,
  type DenoServeOptions,
} from "./deno.ts";
import { createEdgeHandler, type EdgeHandler } from "./edge.ts";
import { EDGE_APP, source as edgeSource } from "./fixtures/edge-worker.ts";
import * as nodeAdapter from "./node.ts";
import {
  ACCEPT_CH,
  ACCEPT_CH_HEADER,
  CLIENT_HINT_VARY,
  applyClientHints,
  isDocumentResponse,
  withClientHints,
} from "./client-hints.ts";
import { RUNTIME_MISSING_CODE, RuntimeMissingError } from "./runtime.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..", "..", "..");
const BUNDLE_TIMEOUT_MS = 120_000;
const INDEX_HTML = '<!doctype html><html><body><div id="root"></div></body></html>';

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

function rexApp(app: string) {
  return createRexServer({
    registry: source,
    ledger: memoryLedger(),
    actor: () => actor({ id: "alice" }),
    app,
  });
}

function rpcClient(url: string, fetchImpl?: (request: Request) => Promise<Response>) {
  const headers = { origin: new URL(url).origin };
  const client: RegistryRouterClient<typeof source> = createORPCClient(
    new RPCLink(
      fetchImpl === undefined
        ? { url, headers }
        : { url, headers, fetch: (request) => fetchImpl(request) },
    ),
  );
  return client;
}

async function expectRexAnswers(url: string, app: string): Promise<void> {
  const health = await fetch(`${url}/rex/health`);
  expect(health.status).toBe(200);
  expect(await health.json()).toEqual({ status: "ok" });
  const manifest = await fetch(`${url}/rex/manifest`);
  expect(await manifest.text()).toBe(stableStringify(buildManifest(source, { app })));
  await expect(rpcClient(`${url}/rex/rpc`)["toggle-dust"]({ hide: true })).resolves.toEqual({
    hide: true,
  });
}

function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createNetServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as AddressInfo;
      probe.close((error) => (error ? reject(error) : resolvePort(port)));
    });
  });
}

function remoteAddrOf(incoming: {
  readonly socket: {
    readonly remoteAddress?: string | undefined;
    readonly remotePort?: number | undefined;
  };
}): DenoNetAddr {
  return {
    transport: "tcp",
    hostname: incoming.socket.remoteAddress ?? "",
    port: incoming.socket.remotePort ?? 0,
  };
}

interface BunGlobalRecord {
  readonly runtime: BunRuntime;
  readonly served: BunServeOptions[];
  listening: Promise<void>;
}

function bunGlobal(): BunGlobalRecord {
  const record: BunGlobalRecord = {
    served: [],
    listening: Promise.resolve(),
    runtime: {
      serve(options) {
        record.served.push(options);
        const hostname = options.hostname ?? "0.0.0.0";
        let server: BunServer;
        const http = createHttpServer(
          getRequestListener((request: Request) => options.fetch(request, server)),
        );
        record.listening = new Promise((done, fail) => {
          http.once("error", fail);
          http.listen(options.port, hostname, () => done());
        });
        server = {
          port: options.port,
          hostname,
          url: new URL(`http://${hostname}:${options.port}/`),
          stop: () =>
            new Promise<void>((done, fail) => {
              http.closeAllConnections();
              http.close((error) => (error ? fail(error) : done()));
            }),
        };
        return server;
      },
    },
  };
  return record;
}

interface DenoGlobalRecord {
  readonly runtime: DenoRuntime;
  readonly served: { options: DenoServeOptions; handler: DenoServeHandler }[];
}

function denoGlobal(): DenoGlobalRecord {
  const record: DenoGlobalRecord = {
    served: [],
    runtime: {
      serve(options, handler) {
        record.served.push({ options, handler });
        const hostname = options.hostname ?? "0.0.0.0";
        const http = createHttpServer(
          getRequestListener((request: Request, env: HttpBindings | Http2Bindings) =>
            handler(request, { remoteAddr: remoteAddrOf(env.incoming) }),
          ),
        );
        let finish: () => void = () => undefined;
        const finished = new Promise<void>((done) => {
          finish = done;
        });
        const addr = (): DenoNetAddr => {
          const info = http.address() as AddressInfo;
          return { transport: "tcp", hostname: info.address, port: info.port };
        };
        http.listen(options.port, hostname, () => options.onListen?.(addr()));
        const server: DenoHttpServer = {
          get addr() {
            return addr();
          },
          finished,
          shutdown: () =>
            new Promise<void>((done, fail) => {
              http.closeAllConnections();
              http.close((error) => {
                finish();
                return error ? fail(error) : done();
              });
            }),
        };
        return server;
      },
    },
  };
  return record;
}

const runtimeGlobals = globalThis as { Bun?: unknown; Deno?: unknown };

afterEach(() => {
  delete runtimeGlobals.Bun;
  delete runtimeGlobals.Deno;
});

describe("node adapter", () => {
  it("is re-exported from rex/server/node unchanged", () => {
    expect(legacyNode.startNodeServer).toBe(nodeAdapter.startNodeServer);
    expect(legacyNode.createNodeApp).toBe(nodeAdapter.createNodeApp);
    expect(legacyNode.createPrerenderedNodeApp).toBe(nodeAdapter.createNodeApp);
    expect(legacyNode.isApiPath).toBe(nodeAdapter.isApiPath);
    expect(legacyNode.isPageRoutePath).toBe(nodeAdapter.isPageRoutePath);
  });

  it("serves the Rex app and the client directory over a real socket", async () => {
    const clientDir = mkdtempSync(join(tmpdir(), "rex-adapter-node-"));
    writeFileSync(join(clientDir, "index.html"), INDEX_HTML);
    const running = await nodeAdapter.startNodeServer(rexApp("node-adapter"), {
      port: 0,
      clientDir,
      hostname: "127.0.0.1",
    });
    try {
      await expectRexAnswers(running.url, "node-adapter");
      expect(await (await fetch(`${running.url}/portfolio/acc-1`)).text()).toBe(INDEX_HTML);
    } finally {
      await running.close();
      rmSync(clientDir, { recursive: true, force: true });
    }
  });
});

describe("bun adapter", () => {
  it("throws REX450 naming Bun when the Bun global is absent", () => {
    expect(runtimeGlobals.Bun).toBeUndefined();
    let caught: unknown;
    try {
      void startBunServer(rexApp("bun-adapter"), { port: 0 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(RuntimeMissingError);
    const error = caught as RuntimeMissingError;
    expect(error.code).toBe(RUNTIME_MISSING_CODE);
    expect(error.code).toBe("REX450");
    expect(error.runtime).toBe("Bun");
    expect(error.message).toMatch(/^REX450 startBunServer: the Bun runtime global is absent/);
    expect(error.docs).toBe(`${REX_ERRORS_DOCS_BASE}/REX450`);
    expect(error.hint).toBeNull();
    expect(errorHint(error)).toBe(REX_ERROR_DOCS.REX450.hint);
    expect(errorHint(error)).toContain("bun");
  });

  it("hands the Rex fetch handler to Bun.serve when the global exists", async () => {
    const bun = bunGlobal();
    runtimeGlobals.Bun = bun.runtime;
    const port = await freePort();
    const app = rexApp("bun-adapter");
    const running = await startBunServer(app, { port, hostname: "127.0.0.1" });
    try {
      await bun.listening;
      expect(bun.served).toHaveLength(1);
      const served = bun.served[0] as BunServeOptions;
      expect(served.port).toBe(port);
      expect(served.hostname).toBe("127.0.0.1");
      expect(running.server.port).toBe(port);
      expect(running.port).toBe(port);
      expect(running.url).toBe(`http://127.0.0.1:${port}`);
      const handler: BunFetchHandler = served.fetch;
      const direct = await handler(new Request("http://bun.test/rex/health"), running.server);
      expect(await direct.json()).toEqual({ status: "ok" });
      await expectRexAnswers(running.url, "bun-adapter");
    } finally {
      await running.close();
    }
    await expect(fetch(`${running.url}/rex/health`)).rejects.toThrow();
  });

  it("validates the port once the runtime is present", () => {
    runtimeGlobals.Bun = bunGlobal().runtime;
    expect(() => startBunServer(rexApp("bun-adapter"), { port: 70_000 })).toThrow(
      expect.objectContaining({ name: "RexError", code: "REX407" }),
    );
  });
});

describe("deno adapter", () => {
  it("throws REX450 naming Deno when the Deno global is absent", () => {
    expect(runtimeGlobals.Deno).toBeUndefined();
    let caught: unknown;
    try {
      void startDenoServer(rexApp("deno-adapter"), { port: 0 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(RuntimeMissingError);
    const error = caught as RuntimeMissingError;
    expect(error.code).toBe("REX450");
    expect(error.runtime).toBe("Deno");
    expect(error.message).toMatch(/^REX450 startDenoServer: the Deno runtime global is absent/);
    expect(error.hint).toBeNull();
    expect(errorHint(error)).toBe(REX_ERROR_DOCS.REX450.hint);
    expect(errorHint(error)).toContain("deno");
  });

  it("hands the Rex fetch handler to Deno.serve when the global exists", async () => {
    const deno = denoGlobal();
    runtimeGlobals.Deno = deno.runtime;
    const running = await startDenoServer(rexApp("deno-adapter"), {
      port: 0,
      hostname: "127.0.0.1",
    });
    try {
      expect(deno.served).toHaveLength(1);
      const served = deno.served[0] as { options: DenoServeOptions; handler: DenoServeHandler };
      expect(served.options.port).toBe(0);
      expect(served.options.hostname).toBe("127.0.0.1");
      expect(running.port).toBeGreaterThan(0);
      expect(running.port).toBe(running.server.addr.port);
      expect(running.url).toBe(`http://127.0.0.1:${running.port}`);
      const direct = await served.handler(new Request("http://deno.test/rex/health"), {
        remoteAddr: { transport: "tcp", hostname: "127.0.0.1", port: 1 },
      });
      expect(await direct.json()).toEqual({ status: "ok" });
      await expectRexAnswers(running.url, "deno-adapter");
    } finally {
      await running.close();
    }
    await running.server.finished;
    await expect(fetch(`${running.url}/rex/health`)).rejects.toThrow();
  });
});

const EDGE_WEB_GLOBALS = [
  "Request",
  "Response",
  "Headers",
  "URL",
  "URLSearchParams",
  "ReadableStream",
  "WritableStream",
  "TransformStream",
  "TextEncoder",
  "TextDecoder",
  "TextEncoderStream",
  "TextDecoderStream",
  "CompressionStream",
  "DecompressionStream",
  "Blob",
  "File",
  "FormData",
  "AbortController",
  "AbortSignal",
  "Event",
  "EventTarget",
  "DOMException",
  "crypto",
  "performance",
  "structuredClone",
  "atob",
  "btoa",
  "fetch",
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "queueMicrotask",
  "console",
] as const;

const NODE_GLOBALS = ["process", "Buffer", "require", "module", "global", "setImmediate", "__dirname"];

async function bundleEdgeWorker(): Promise<string> {
  const result = await build({
    root: packageRoot,
    configFile: false,
    logLevel: "silent",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    build: {
      write: false,
      minify: false,
      lib: {
        entry: join(here, "fixtures", "edge-worker.ts"),
        formats: ["iife"],
        name: "RexEdgeWorker",
        fileName: "edge-worker",
      },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunks = outputs
    .flatMap((output) => ("output" in output ? output.output : []))
    .filter((item) => item.type === "chunk");
  expect(chunks).toHaveLength(1);
  return chunks.map((chunk) => chunk.code).join("\n");
}

describe("edge adapter", { timeout: BUNDLE_TIMEOUT_MS }, () => {
  it("exports the Hono fetch handler and answers Request objects in process", async () => {
    const handler = createEdgeHandler(rexApp("edge-in-process"));
    const health = await handler.fetch(new Request("https://edge.test/rex/health"));
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
    const missing = await handler.fetch(new Request("https://edge.test/rex/unknown"));
    expect(missing.status).toBe(404);
    expect(() => createEdgeHandler({} as never)).toThrow(expect.objectContaining({ name: "RexError", code: "REX400" }));
  });

  it("runs the bundled worker against Request objects in a realm with no node globals", async () => {
    const code = await bundleEdgeWorker();
    const sandbox: Record<string, unknown> = {};
    for (const name of EDGE_WEB_GLOBALS) sandbox[name] = (globalThis as Record<string, unknown>)[name];
    const realm = createContext(sandbox);
    for (const name of NODE_GLOBALS) {
      expect(runInContext(`typeof ${name}`, realm), name).toBe("undefined");
    }
    runInContext(code, realm);
    const worker = (realm as { RexEdgeWorker?: { default?: EdgeHandler } }).RexEdgeWorker;
    const handler = worker?.default;
    expect(typeof handler?.fetch).toBe("function");
    const edge = handler as EdgeHandler;

    const health = await edge.fetch(new Request("https://edge.test/rex/health"));
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });

    const manifest = await edge.fetch(new Request("https://edge.test/rex/manifest"));
    expect(manifest.status).toBe(200);
    expect(await manifest.text()).toBe(
      stableStringify(buildManifest(edgeSource, { app: EDGE_APP })),
    );

    const unknown = await edge.fetch(new Request("https://edge.test/rex/unknown"));
    expect(unknown.status).toBe(404);

    const client = rpcClient("https://edge.test/rex/rpc", (request) => edge.fetch(request));
    await expect(client["toggle-dust"]({ hide: true })).resolves.toEqual({ hide: true });
    await expect(client["toggle-dust"]({ hide: false })).resolves.toEqual({ hide: false });
  });
});

const PHONE_HINTS = { "sec-ch-ua-mobile": "?1", "sec-ch-viewport-width": "390" } as const;
const hintedPage = page("hinted", { route: "/", chrome: { title: "Hinted" }, states: ["ready"] });
const hintedRegistry = createRegistry().register(hintedPage).freeze();
registerPageRenderer(
  hintedRegistry,
  createRexRenderer({
    bundle: {
      registry: hintedRegistry,
      manifest: buildManifest(hintedRegistry, { app: "hinted" }),
      pages: [
        definePageModules({
          page: hintedPage,
          view: view(() => createElement("p", null, "Hinted body")),
          states: {},
        }),
      ],
    },
  }),
);

function hintedApp() {
  return createRexServer({
    registry: hintedRegistry,
    ledger: memoryLedger(),
    actor: () => actor({ id: "alice" }),
    app: "hinted",
  });
}

async function expectPhoneDocument(response: Response): Promise<void> {
  expect(response.status).toBe(200);
  expect(response.headers.get(ACCEPT_CH_HEADER)).toBe(ACCEPT_CH);
  const html = await response.text();
  expect(html).toMatch(
    /<html lang="en" data-rex-screen="phone" data-rex-pointer="coarse" data-rex-density="comfortable">/,
  );
  expect(html).toContain('data-rex-nav-form="dock"');
  expect(html).toContain("Hinted body");
}

describe("client hints", () => {
  it("adds Accept-CH and merges Vary on document responses only", () => {
    const headers = new Headers({ vary: "Origin, sec-ch-ua-mobile" });
    applyClientHints(headers);
    expect(headers.get(ACCEPT_CH_HEADER)).toBe("Sec-CH-UA-Mobile, Sec-CH-Viewport-Width");
    expect(headers.get("vary")).toBe("Origin, sec-ch-ua-mobile, Sec-CH-Viewport-Width");
    expect(CLIENT_HINT_VARY).toEqual(["Sec-CH-UA-Mobile", "Sec-CH-Viewport-Width"]);
    expect(isDocumentResponse(new Response("", { headers: { "content-type": "text/html; charset=utf-8" } }))).toBe(true);
    expect(isDocumentResponse(Response.json({ ok: true }))).toBe(false);
    const hinted = withClientHints(new Response("<p>x</p>", { status: 201 }));
    expect(hinted.status).toBe(201);
    expect(hinted.headers.get(ACCEPT_CH_HEADER)).toBe(ACCEPT_CH);
  });

  it("sends Accept-CH with the node adapter's index.html fallback", async () => {
    const clientDir = mkdtempSync(join(tmpdir(), "rex-adapter-hints-"));
    writeFileSync(join(clientDir, "index.html"), INDEX_HTML);
    const running = await nodeAdapter.startNodeServer(rexApp("node-hints"), {
      port: 0,
      clientDir,
      hostname: "127.0.0.1",
    });
    try {
      const response = await fetch(`${running.url}/portfolio/acc-1`, { headers: PHONE_HINTS });
      expect(response.headers.get(ACCEPT_CH_HEADER)).toBe(ACCEPT_CH);
      expect(await response.text()).toBe(INDEX_HTML);
      const health = await fetch(`${running.url}/rex/health`);
      expect(health.headers.get(ACCEPT_CH_HEADER)).toBeNull();
    } finally {
      await running.close();
      rmSync(clientDir, { recursive: true, force: true });
    }
  });

  it("passes the hint headers through the node adapter to the server-rendered document", async () => {
    const clientDir = mkdtempSync(join(tmpdir(), "rex-adapter-hints-ssr-"));
    writeFileSync(join(clientDir, "index.html"), INDEX_HTML);
    const running = await nodeAdapter.startNodeServer(hintedApp(), {
      port: 0,
      clientDir,
      hostname: "127.0.0.1",
    });
    try {
      await expectPhoneDocument(await fetch(`${running.url}/`, { headers: PHONE_HINTS }));
    } finally {
      await running.close();
      rmSync(clientDir, { recursive: true, force: true });
    }
  });

  it("passes the hint headers through the bun, deno and edge adapters", async () => {
    await expectPhoneDocument(
      await createEdgeHandler(hintedApp()).fetch(
        new Request("https://edge.test/", { headers: PHONE_HINTS }),
      ),
    );

    const bun = bunGlobal();
    runtimeGlobals.Bun = bun.runtime;
    const bunServer = await startBunServer(hintedApp(), {
      port: await freePort(),
      hostname: "127.0.0.1",
    });
    try {
      await bun.listening;
      await expectPhoneDocument(await fetch(`${bunServer.url}/`, { headers: PHONE_HINTS }));
    } finally {
      await bunServer.close();
    }

    const deno = denoGlobal();
    runtimeGlobals.Deno = deno.runtime;
    const denoServer = await startDenoServer(hintedApp(), { port: 0, hostname: "127.0.0.1" });
    try {
      await expectPhoneDocument(await fetch(`${denoServer.url}/`, { headers: PHONE_HINTS }));
    } finally {
      await denoServer.close();
    }
  });
});
