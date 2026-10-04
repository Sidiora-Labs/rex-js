import { createServer as createHttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { getRequestListener, type Http2Bindings, type HttpBindings } from "@hono/node-server";
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
  denoRuntime,
  startDenoServer,
  type DenoHttpServer,
  type DenoNetAddr,
  type DenoRuntime,
  type DenoServeHandler,
  type DenoServeHandlerInfo,
  type DenoServeOptions,
} from "./deno.ts";
import * as runtime from "./runtime.ts";

const APP = "deno-adapter";

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

interface DenoServeCall {
  readonly options: DenoServeOptions;
  readonly handler: DenoServeHandler;
}

interface DenoGlobalRecord {
  readonly runtime: DenoRuntime;
  readonly served: DenoServeCall[];
  shutdowns: number;
}

function denoGlobal(): DenoGlobalRecord {
  const record: DenoGlobalRecord = {
    served: [],
    shutdowns: 0,
    runtime: {
      serve(options, handler) {
        record.served.push({ options, handler });
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
        const listening = (): void => options.onListen?.(addr());
        if (options.hostname === undefined) http.listen(options.port, listening);
        else http.listen(options.port, options.hostname, listening);
        const server: DenoHttpServer = {
          get addr() {
            return addr();
          },
          finished,
          shutdown: () => {
            record.shutdowns += 1;
            return new Promise<void>((done, fail) => {
              http.closeAllConnections();
              http.close((error) => {
                finish();
                return error ? fail(error) : done();
              });
            });
          },
        };
        return server;
      },
    },
  };
  return record;
}

const runtimeGlobals = globalThis as { Deno?: unknown };

afterEach(() => {
  delete runtimeGlobals.Deno;
});

describe("denoRuntime", () => {
  it("finds Deno only when the global exposes serve", () => {
    expect(denoRuntime()).toBeNull();
    runtimeGlobals.Deno = { version: { deno: "2.0.0" } };
    expect(denoRuntime()).toBeNull();
    const deno = denoGlobal();
    runtimeGlobals.Deno = deno.runtime;
    expect(denoRuntime()).toBe(deno.runtime);
  });

  it("re-exports the runtime error of the adapter runtime module", () => {
    expect(RUNTIME_MISSING_CODE).toBe(runtime.RUNTIME_MISSING_CODE);
    expect(RuntimeMissingError).toBe(runtime.RuntimeMissingError);
  });
});

describe("startDenoServer", () => {
  it("throws REX450 naming Deno and the entry when the global is absent", () => {
    let caught: unknown;
    try {
      void startDenoServer(rexApp(), { port: 3000 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(RuntimeMissingError);
    const error = caught as RuntimeMissingError;
    expect(error.name).toBe("RuntimeMissingError");
    expect(error.code).toBe("REX450");
    expect(error.runtime).toBe("Deno");
    expect(error.message).toBe(
      "REX450 startDenoServer: the Deno runtime global is absent, so there is no Deno.serve to hand the fetch handler to",
    );
  });

  it("rejects an invalid port with REX407 before handing anything to Deno.serve", () => {
    const deno = denoGlobal();
    runtimeGlobals.Deno = deno.runtime;
    for (const port of [-1, 65_536, 80.5, Number.NaN]) {
      expect(() => startDenoServer(rexApp(), { port }), String(port)).toThrow(
        expect.objectContaining({ name: "RexError", code: "REX407" }),
      );
    }
    expect(deno.served).toEqual([]);
  });

  it("resolves once Deno reports the listening address and shuts the server down on close", async () => {
    const deno = denoGlobal();
    runtimeGlobals.Deno = deno.runtime;
    const running = await startDenoServer(rexApp(), { port: 0, hostname: "127.0.0.1" });
    try {
      expect(deno.served).toHaveLength(1);
      const served = deno.served[0] as DenoServeCall;
      expect(served.options.port).toBe(0);
      expect(served.options.hostname).toBe("127.0.0.1");
      expect(typeof served.options.onListen).toBe("function");
      expect(running.port).toBeGreaterThan(0);
      expect(running.port).toBe(running.server.addr.port);
      expect(running.url).toBe(`http://127.0.0.1:${running.port}`);
      const health = await fetch(`${running.url}/rex/health`);
      expect(health.status).toBe(200);
      expect(await health.json()).toEqual({ status: "ok" });
      const manifest = await fetch(`${running.url}/rex/manifest`);
      expect(await manifest.text()).toBe(stableStringify(buildManifest(source, { app: APP })));
      const client: RegistryRouterClient<typeof source> = createORPCClient(
        new RPCLink({ url: `${running.url}/rex/rpc`, headers: { origin: running.url } }),
      );
      await expect(client["toggle-dust"]({ hide: false })).resolves.toEqual({ hide: false });
    } finally {
      await running.close();
    }
    expect(deno.shutdowns).toBe(1);
    await running.server.finished;
    await expect(fetch(`${running.url}/rex/health`)).rejects.toThrow();
  });

  it("leaves the hostname out of the Deno.serve options and reports localhost when none is given", async () => {
    const deno = denoGlobal();
    runtimeGlobals.Deno = deno.runtime;
    const running = await startDenoServer(rexApp(), { port: 0 });
    try {
      const served = deno.served[0] as DenoServeCall;
      expect(Object.keys(served.options).sort()).toEqual(["onListen", "port"]);
      expect(running.url).toBe(`http://localhost:${running.port}`);
      const health = await fetch(`http://127.0.0.1:${running.port}/rex/health`);
      expect(await health.json()).toEqual({ status: "ok" });
    } finally {
      await running.close();
    }
  });

  it("hands the Deno handler info to the app as the fetch environment", async () => {
    const deno = denoGlobal();
    runtimeGlobals.Deno = deno.runtime;
    const app = new Hono<{ Bindings: DenoServeHandlerInfo }>();
    app.get("/env", (c) => c.json({ remoteAddr: c.env.remoteAddr }));
    const running = await startDenoServer(app, { port: 0, hostname: "127.0.0.1" });
    try {
      const served = deno.served[0] as DenoServeCall;
      const info: DenoServeHandlerInfo = {
        remoteAddr: { transport: "tcp", hostname: "10.0.0.7", port: 4321 },
      };
      const direct = await served.handler(new Request("http://deno.test/env"), info);
      expect(await direct.json()).toEqual({ remoteAddr: info.remoteAddr });
      const response = await fetch(`${running.url}/env`);
      const { remoteAddr } = (await response.json()) as { remoteAddr: DenoNetAddr };
      expect(remoteAddr.transport).toBe("tcp");
      expect(remoteAddr.hostname).toBe("127.0.0.1");
      expect(remoteAddr.port).toBeGreaterThan(0);
    } finally {
      await running.close();
    }
  });
});
