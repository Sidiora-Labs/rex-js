import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer, type AddressInfo } from "node:net";
import { getRequestListener } from "@hono/node-server";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod/mini";
import { action } from "../../core/action.ts";
import { actor } from "../../core/actor.ts";
import { page } from "../../core/page.ts";
import { always } from "../../core/policy.ts";
import { buildManifest, stableStringify } from "../../manifest/build.ts";
import { boolean } from "../../schema/index.ts";
import { createRexServer, type RegistryRouterClient } from "../app.ts";
import { memoryLedger } from "../audit.ts";
import {
  RUNTIME_MISSING_CODE,
  RuntimeMissingError,
  bunRuntime,
  startBunServer,
  type BunRuntime,
  type BunServeOptions,
  type BunServer,
} from "./bun.ts";
import * as runtime from "./runtime.ts";

const APP = "bun-adapter";

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

function rexApp() {
  return createRexServer({
    registry: source,
    ledger: memoryLedger(),
    actor: () => actor({ id: "alice" }),
    app: APP,
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

interface BunGlobalRecord {
  readonly runtime: BunRuntime;
  readonly served: BunServeOptions[];
  readonly stops: (boolean | undefined)[];
  listening: Promise<void>;
}

function bunGlobal(): BunGlobalRecord {
  const record: BunGlobalRecord = {
    served: [],
    stops: [],
    listening: Promise.resolve(),
    runtime: {
      serve(options) {
        record.served.push(options);
        let server: BunServer;
        const http = createHttpServer(
          getRequestListener((request: Request) => options.fetch(request, server)),
        );
        record.listening = new Promise((done, fail) => {
          http.once("error", fail);
          if (options.hostname === undefined) http.listen(options.port, () => done());
          else http.listen(options.port, options.hostname, () => done());
        });
        server = {
          port: options.port,
          hostname: options.hostname ?? "0.0.0.0",
          url: new URL(`http://${options.hostname ?? "localhost"}:${options.port}/`),
          stop: (closeActiveConnections) => {
            record.stops.push(closeActiveConnections);
            return new Promise<void>((done, fail) => {
              http.closeAllConnections();
              http.close((error) => (error ? fail(error) : done()));
            });
          },
        };
        return server;
      },
    },
  };
  return record;
}

const runtimeGlobals = globalThis as { Bun?: unknown };

afterEach(() => {
  delete runtimeGlobals.Bun;
});

describe("bunRuntime", () => {
  it("finds Bun only when the global exposes serve", () => {
    expect(bunRuntime()).toBeNull();
    runtimeGlobals.Bun = { version: "1.2.0" };
    expect(bunRuntime()).toBeNull();
    const bun = bunGlobal();
    runtimeGlobals.Bun = bun.runtime;
    expect(bunRuntime()).toBe(bun.runtime);
  });

  it("re-exports the runtime error of the adapter runtime module", () => {
    expect(RUNTIME_MISSING_CODE).toBe(runtime.RUNTIME_MISSING_CODE);
    expect(RuntimeMissingError).toBe(runtime.RuntimeMissingError);
  });
});

describe("startBunServer", () => {
  it("throws REX450 naming Bun and the entry when the global is absent", () => {
    let caught: unknown;
    try {
      void startBunServer(rexApp(), { port: 3000 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(RuntimeMissingError);
    const error = caught as RuntimeMissingError;
    expect(error.name).toBe("RuntimeMissingError");
    expect(error.code).toBe("REX450");
    expect(error.runtime).toBe("Bun");
    expect(error.message).toBe(
      "REX450 startBunServer: the Bun runtime global is absent, so there is no Bun.serve to hand the fetch handler to",
    );
  });

  it("rejects an invalid port with REX407 before handing anything to Bun.serve", () => {
    const bun = bunGlobal();
    runtimeGlobals.Bun = bun.runtime;
    for (const port of [-1, 65_536, 80.5, Number.NaN]) {
      expect(() => startBunServer(rexApp(), { port }), String(port)).toThrow(
        expect.objectContaining({ name: "RexError", code: "REX407" }),
      );
    }
    expect(bun.served).toEqual([]);
  });

  it("serves the Rex app through Bun.serve on the given host and port and stops it on close", async () => {
    const bun = bunGlobal();
    runtimeGlobals.Bun = bun.runtime;
    const port = await freePort();
    const running = await startBunServer(rexApp(), { port, hostname: "127.0.0.1" });
    try {
      await bun.listening;
      expect(bun.served).toHaveLength(1);
      const served = bun.served[0] as BunServeOptions;
      expect(served.port).toBe(port);
      expect(served.hostname).toBe("127.0.0.1");
      expect(running.port).toBe(port);
      expect(running.server.port).toBe(port);
      expect(running.url).toBe(`http://127.0.0.1:${port}`);
      const health = await fetch(`${running.url}/rex/health`);
      expect(health.status).toBe(200);
      expect(await health.json()).toEqual({ status: "ok" });
      const manifest = await fetch(`${running.url}/rex/manifest`);
      expect(await manifest.text()).toBe(stableStringify(buildManifest(source, { app: APP })));
      const client: RegistryRouterClient<typeof source> = createORPCClient(
        new RPCLink({ url: `${running.url}/rex/rpc`, headers: { origin: running.url } }),
      );
      await expect(client["toggle-dust"]({ hide: true })).resolves.toEqual({ hide: true });
    } finally {
      await running.close();
    }
    expect(bun.stops).toEqual([true]);
    await expect(fetch(`${running.url}/rex/health`)).rejects.toThrow();
  });

  it("leaves the hostname out of the Bun.serve options and reports localhost when none is given", async () => {
    const bun = bunGlobal();
    runtimeGlobals.Bun = bun.runtime;
    const port = await freePort();
    const running = await startBunServer(rexApp(), { port });
    try {
      await bun.listening;
      const served = bun.served[0] as BunServeOptions;
      expect(Object.keys(served).sort()).toEqual(["fetch", "port"]);
      expect(running.url).toBe(`http://localhost:${port}`);
      const health = await fetch(`http://127.0.0.1:${port}/rex/health`);
      expect(await health.json()).toEqual({ status: "ok" });
    } finally {
      await running.close();
    }
  });

  it("hands the Bun server to the app as the fetch environment", async () => {
    const bun = bunGlobal();
    runtimeGlobals.Bun = bun.runtime;
    const app = new Hono<{ Bindings: BunServer }>();
    app.get("/env", (c) => c.json({ port: c.env.port, hostname: c.env.hostname }));
    const port = await freePort();
    const running = await startBunServer(app, { port, hostname: "127.0.0.1" });
    try {
      await bun.listening;
      const served = bun.served[0] as BunServeOptions;
      const direct = await served.fetch(new Request("http://bun.test/env"), running.server);
      expect(await direct.json()).toEqual({ port, hostname: "127.0.0.1" });
      const response = await fetch(`${running.url}/env`);
      expect(await response.json()).toEqual({ port, hostname: "127.0.0.1" });
    } finally {
      await running.close();
    }
  });
});
