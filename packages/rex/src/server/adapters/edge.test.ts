import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { Hono, type ExecutionContext } from "hono";
import { describe, expect, it } from "vitest";
import { z } from "zod/mini";
import { action } from "../../core/action.ts";
import { actor } from "../../core/actor.ts";
import { page } from "../../core/page.ts";
import { always } from "../../core/policy.ts";
import { buildManifest, stableStringify } from "../../manifest/build.ts";
import { boolean } from "../../schema/index.ts";
import { type RegistryRouterClient } from "../app.ts";
import { memoryLedger } from "../audit.ts";
import { CSP_HEADER, CSP_REPORT_ONLY_HEADER } from "../middleware/security.ts";
import { createEdgeHandler, createEdgeServer, type EdgeHandler } from "./edge.ts";

const APP = "edge-adapter";
const ORIGIN = "https://edge.test";

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
const alice = actor({ id: "alice" });

function rpcClient(edge: EdgeHandler): RegistryRouterClient<typeof source> {
  return createORPCClient(
    new RPCLink({
      url: `${ORIGIN}/rex/rpc`,
      headers: { origin: ORIGIN },
      fetch: (request) => edge.fetch(request),
    }),
  );
}

describe("createEdgeHandler", () => {
  it("refuses an app without a fetch method with REX400", () => {
    for (const app of [{}, null, undefined, { fetch: "later" }]) {
      expect(() => createEdgeHandler(app as never), JSON.stringify(app)).toThrow(
        expect.objectContaining({
          name: "RexError",
          code: "REX400",
          message: "REX400 createEdgeHandler: app must have a fetch(request) method",
        }),
      );
    }
  });

  it("always answers with a promise, even when the app answers synchronously", async () => {
    const sync = new Hono();
    sync.get("/sync", (c) => c.text("sync"));
    const request = new Request(`${ORIGIN}/sync`);
    expect(sync.fetch(request)).toBeInstanceOf(Response);
    const pending = createEdgeHandler(sync).fetch(request);
    expect(pending).toBeInstanceOf(Promise);
    const response = await pending;
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("sync");
  });

  it("forwards the request, the bindings and the execution context to the app", async () => {
    const waited: Promise<unknown>[] = [];
    const executionCtx: ExecutionContext = {
      waitUntil: (promise) => {
        waited.push(promise);
      },
      passThroughOnException: () => undefined,
      props: {},
    };
    const app = new Hono<{ Bindings: { readonly region: string } }>();
    app.get("/probe", (c) => {
      c.executionCtx.waitUntil(Promise.resolve("flushed"));
      return c.json({ region: c.env.region, path: c.req.path, accept: c.req.header("accept") });
    });
    const handler = createEdgeHandler(app);
    const response = await handler.fetch(
      new Request(`${ORIGIN}/probe`, { headers: { accept: "application/json" } }),
      { region: "eu" },
      executionCtx,
    );
    expect(await response.json()).toEqual({
      region: "eu",
      path: "/probe",
      accept: "application/json",
    });
    expect(waited).toHaveLength(1);
    await expect(waited[0]).resolves.toBe("flushed");
    expect((await handler.fetch(new Request(`${ORIGIN}/missing`))).status).toBe(404);
  });
});

describe("createEdgeServer", () => {
  it("mounts the prebuilt manifest and answers Rex requests from the fetch handler", async () => {
    const ledger = memoryLedger();
    const manifest = buildManifest(source, { app: APP });
    const edge = createEdgeServer({ registry: source, ledger, actor: () => alice, manifest });
    expect(typeof edge.fetch).toBe("function");
    const health = await edge.fetch(new Request(`${ORIGIN}/rex/health`));
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
    const served = await edge.fetch(new Request(`${ORIGIN}/rex/manifest`));
    expect(served.status).toBe(200);
    expect(await served.text()).toBe(stableStringify(manifest));
    expect(served.headers.get(CSP_HEADER)).toMatch(/script-src 'self' 'nonce-[0-9a-f]{32}'/);
    await expect(rpcClient(edge)["toggle-dust"]({ hide: false })).resolves.toEqual({ hide: false });
    expect(
      (await ledger.list()).map((record) => [record.actor, record.actionId, record.outcome]),
    ).toEqual([["alice", "toggle-dust", "ok"]]);
    expect((await edge.fetch(new Request(`${ORIGIN}/rex/unknown`))).status).toBe(404);
  });

  it("applies the security options as given", async () => {
    const edge = createEdgeServer({
      registry: source,
      ledger: memoryLedger(),
      actor: () => alice,
      manifest: buildManifest(source, { app: APP }),
      security: { csp: "report", headers: { "x-frame-options": "DENY" } },
      client: { apiOrigin: "https://api.example" },
    });
    const response = await edge.fetch(new Request(`${ORIGIN}/rex/health`));
    expect(response.headers.get(CSP_HEADER)).toBeNull();
    expect(response.headers.get(CSP_REPORT_ONLY_HEADER)).toContain(
      "connect-src 'self' https://api.example",
    );
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("refuses a manifest rex build did not write and an actor that is not a function", () => {
    expect(() =>
      createEdgeServer({
        registry: source,
        ledger: memoryLedger(),
        actor: () => alice,
        manifest: { version: 2 } as never,
      }),
    ).toThrow(
      expect.objectContaining({
        name: "RexError",
        code: "REX400",
        message: expect.stringContaining("manifest must be a version 1 Rex manifest"),
      }),
    );
    expect(() =>
      createEdgeServer({
        registry: source,
        ledger: memoryLedger(),
        actor: alice as never,
        manifest: buildManifest(source, { app: APP }),
      }),
    ).toThrow(
      expect.objectContaining({
        name: "RexError",
        code: "REX400",
        message: expect.stringContaining("actor must be a function"),
      }),
    );
  });
});
