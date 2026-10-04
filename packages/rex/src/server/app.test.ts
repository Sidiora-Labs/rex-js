import { ORPCError, createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { describe, expect, it } from "vitest";
import { z } from "zod/mini";
import { action } from "../core/action.ts";
import { actor, anonymousActor, type Actor } from "../core/actor.ts";
import { page } from "../core/page.ts";
import { always } from "../core/policy.ts";
import { buildManifest, stableStringify } from "../manifest/build.ts";
import { MANIFEST_VERSION } from "../manifest/types.ts";
import { boolean, money, text } from "../schema/index.ts";
import {
  REX_SERVER_COMPOSITION,
  createRexServer,
  mountRexServer,
  type RegistryRouterClient,
} from "./app.ts";
import { memoryLedger } from "./audit.ts";
import { CONFIRM_HEADER } from "./context.ts";
import { REX_MIDDLEWARE } from "./middleware.ts";
import { CSP_HEADER, CSP_REPORT_ONLY_HEADER } from "./middleware/security.ts";
import { REX_ROUTES } from "./routes.ts";
import { HEALTH_PATH } from "./routes/health.ts";
import { MANIFEST_PATH } from "./routes/manifest.ts";

const ORIGIN = "http://rex.test";

const send = action("send", {
  input: z.object({ to: text({ min: 1 }), amount: money() }),
  output: z.object({ txId: text() }),
  policy: always(),
  effect: "irreversible",
  label: "Send",
  handler: (input) => ({ txId: `tx-${input.to}-${input.amount}` }),
});

const toggleDust = action("toggle-dust", {
  input: z.object({ hide: boolean() }),
  output: z.object({ hide: boolean(), by: text() }),
  policy: always(),
  effect: "reversible",
  label: "Hide dust",
  handler: (input, ctx) => ({ hide: input.hide, by: ctx.actor.id }),
});

const home = page("home", { route: "/", actions: [send, toggleDust], regions: ["balances"] });

const source = { entities: [], actions: [send, toggleDust], pages: [home], policies: [] };

const alice = actor({ id: "alice" });

function resolveActor(request: Request): Actor {
  return request.headers.get("authorization") === "Bearer alice" ? alice : anonymousActor;
}

interface ConfirmContext {
  readonly confirm?: string;
}

function clientFor(
  app: ReturnType<typeof createRexServer>,
): RegistryRouterClient<typeof source, ConfirmContext> {
  return createORPCClient(
    new RPCLink<ConfirmContext>({
      url: `${ORIGIN}/rex/rpc`,
      headers: ({ context }) => ({
        authorization: "Bearer alice",
        origin: ORIGIN,
        ...(context.confirm === undefined ? {} : { [CONFIRM_HEADER]: context.confirm }),
      }),
      fetch: async (request) => app.fetch(request),
    }),
  );
}

async function rejection(promise: Promise<unknown>): Promise<ORPCError<string, unknown>> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ORPCError);
    return error as ORPCError<string, unknown>;
  }
  throw new Error("expected the call to reject");
}

function rpcPost(origin?: string): RequestInit {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: "Bearer alice",
  };
  if (origin !== undefined) headers.origin = origin;
  return { method: "POST", headers, body: JSON.stringify({ json: { hide: true } }) };
}

describe("REX_SERVER_COMPOSITION", () => {
  it("composes the server from the middleware and the route installers", () => {
    expect(REX_SERVER_COMPOSITION.middleware).toBe(REX_MIDDLEWARE);
    expect(REX_SERVER_COMPOSITION.routes).toBe(REX_ROUTES);
    expect(REX_MIDDLEWARE.length).toBeGreaterThan(0);
    expect(REX_ROUTES.length).toBeGreaterThan(0);
  });
});

describe("createRexServer", () => {
  it("builds the manifest from the registry, naming the app when asked", async () => {
    const named = createRexServer({
      registry: source,
      ledger: memoryLedger(),
      actor: resolveActor,
      app: "demo",
    });
    const namedBody = await (await named.request(MANIFEST_PATH)).text();
    expect(namedBody).toBe(stableStringify(buildManifest(source, { app: "demo" })));
    expect((JSON.parse(namedBody) as { app: unknown }).app).toEqual({ name: "demo" });
    const unnamed = createRexServer({
      registry: source,
      ledger: memoryLedger(),
      actor: resolveActor,
    });
    const body = await (await unnamed.request(MANIFEST_PATH)).text();
    expect(body).toBe(stableStringify(buildManifest(source)));
    expect((JSON.parse(body) as { version: unknown }).version).toBe(MANIFEST_VERSION);
    expect(body).not.toBe(namedBody);
  });

  it("serves a prebuilt manifest as given instead of building one", async () => {
    const manifest = buildManifest(source, { app: "built" });
    const app = createRexServer({
      registry: source,
      ledger: memoryLedger(),
      actor: resolveActor,
      app: "ignored",
      manifest,
    });
    const body = await (await app.request(MANIFEST_PATH)).text();
    expect(body).toBe(stableStringify(manifest));
    expect((JSON.parse(body) as { app: unknown }).app).toEqual({ name: "built" });
  });

  it("refuses an actor resolver that is not a function with REX400", () => {
    for (const resolver of [alice, "alice", undefined, null]) {
      expect(
        () =>
          createRexServer({ registry: source, ledger: memoryLedger(), actor: resolver as never }),
        String(resolver),
      ).toThrow(
        expect.objectContaining({
          name: "RexError",
          code: "REX400",
          message: "REX400 createRexServer: actor must be a function from request to actor",
        }),
      );
    }
  });

  it("installs the middleware ahead of the routes", async () => {
    const ledger = memoryLedger();
    const app = createRexServer({ registry: source, ledger, actor: resolveActor });
    const health = await app.request(HEALTH_PATH);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
    expect(health.headers.get(CSP_HEADER)).toMatch(
      /^default-src 'self'; script-src 'self' 'nonce-[0-9a-f]{32}'/,
    );
    expect(health.headers.get("x-content-type-options")).toBe("nosniff");
    const refused = await app.request(`${ORIGIN}/rex/rpc/toggle-dust`, rpcPost());
    expect(refused.status).toBe(403);
    expect(await ledger.list()).toEqual([]);
    const accepted = await app.request(`${ORIGIN}/rex/rpc/toggle-dust`, rpcPost(ORIGIN));
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({ json: { hide: true, by: "alice" } });
    expect((await ledger.list()).map((record) => [record.actor, record.actionId])).toEqual([
      ["alice", "toggle-dust"],
    ]);
    expect((await app.request("/rex/nope")).status).toBe(404);
    expect((await app.request("/elsewhere")).status).toBe(404);
  });

  it("resolves the security and client options before mounting", async () => {
    expect(() =>
      createRexServer({
        registry: source,
        ledger: memoryLedger(),
        actor: resolveActor,
        security: { origins: ["https://partner.example/path"] },
      }),
    ).toThrow(/REX115/);
    expect(() =>
      createRexServer({
        registry: source,
        ledger: memoryLedger(),
        actor: resolveActor,
        client: { apiOrigin: "ftp://api.example" },
      }),
    ).toThrow(/REX121/);
    const app = createRexServer({
      registry: source,
      ledger: memoryLedger(),
      actor: resolveActor,
      security: { csp: "strict", headers: { "x-frame-options": "DENY" } },
      client: { apiOrigin: "https://api.example" },
    });
    const response = await app.request(HEALTH_PATH);
    expect(response.headers.get(CSP_HEADER)).toContain("connect-src 'self' https://api.example");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    const off = createRexServer({
      registry: source,
      ledger: memoryLedger(),
      actor: resolveActor,
      security: { csp: "off" },
    });
    const bare = await off.request(HEALTH_PATH);
    expect(bare.headers.get(CSP_HEADER)).toBeNull();
    expect(bare.headers.get(CSP_REPORT_ONLY_HEADER)).toBeNull();
    expect(bare.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("passes confirmTtlMs on to the action router", async () => {
    expect(() =>
      createRexServer({
        registry: source,
        ledger: memoryLedger(),
        actor: resolveActor,
        confirmTtlMs: 0,
      }),
    ).toThrow(expect.objectContaining({ name: "RexError", code: "REX400" }));
    const brief = clientFor(
      createRexServer({
        registry: source,
        ledger: memoryLedger(),
        actor: resolveActor,
        confirmTtlMs: 1,
      }),
    );
    const input = { to: "bob", amount: "2" };
    const expiring = await brief._confirm({ action: "send", input });
    await new Promise((done) => setTimeout(done, 5));
    const expired = await rejection(brief.send(input, { context: { confirm: expiring.token } }));
    expect(expired.code).toBe("PRECONDITION_REQUIRED");
    expect(expired.status).toBe(428);
    expect(expired.message).toContain("the confirm token has expired");

    const lasting = clientFor(
      createRexServer({ registry: source, ledger: memoryLedger(), actor: resolveActor }),
    );
    const confirmation = await lasting._confirm({ action: "send", input });
    await new Promise((done) => setTimeout(done, 5));
    await expect(
      lasting.send(input, { context: { confirm: confirmation.token } }),
    ).resolves.toEqual({ txId: "tx-bob-2" });
  });
});

describe("mountRexServer", () => {
  it("mounts a prebuilt manifest and serves it byte for byte with the options as given", async () => {
    const ledger = memoryLedger();
    const manifest = buildManifest(source, { app: "demo" });
    const server = mountRexServer({
      registry: source,
      ledger,
      actor: resolveActor,
      manifest,
      security: { csp: "report", headers: { "x-frame-options": "SAMEORIGIN" } },
    });
    const response = await server.request(MANIFEST_PATH);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(stableStringify(manifest));
    expect(response.headers.get(CSP_HEADER)).toBeNull();
    expect(response.headers.get(CSP_REPORT_ONLY_HEADER)).toMatch(/'nonce-[0-9a-f]{32}'/);
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    await expect(clientFor(server)["toggle-dust"]({ hide: false })).resolves.toEqual({
      hide: false,
      by: "alice",
    });
    expect((await ledger.list()).map((record) => record.outcome)).toEqual(["ok"]);
  });

  it("refuses a manifest that is not a version 1 Rex manifest with REX400", () => {
    for (const manifest of [undefined, null, "manifest", { version: 2 }, { pages: [] }]) {
      expect(
        () =>
          mountRexServer({
            registry: source,
            ledger: memoryLedger(),
            actor: resolveActor,
            manifest: manifest as never,
          }),
        JSON.stringify(manifest),
      ).toThrow(
        expect.objectContaining({
          name: "RexError",
          code: "REX400",
          message: `REX400 createRexServer: manifest must be a version ${MANIFEST_VERSION} Rex manifest as written by rex build`,
        }),
      );
    }
  });

  it("checks the actor resolver before the manifest", () => {
    expect(() =>
      mountRexServer({
        registry: source,
        ledger: memoryLedger(),
        actor: "nobody" as never,
        manifest: {} as never,
      }),
    ).toThrow(
      expect.objectContaining({
        code: "REX400",
        message: expect.stringContaining("actor must be a function"),
      }),
    );
  });
});
