import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono/tiny";
import { describe, expect, it } from "vitest";
import { z } from "zod/mini";
import { action } from "../../core/action.ts";
import { actor, anonymousActor, type Actor } from "../../core/actor.ts";
import { always, can } from "../../core/policy.ts";
import { REX_RPC_PREFIX } from "../../core/protocol.ts";
import { buildManifest, stableStringify } from "../../manifest/build.ts";
import { boolean, text } from "../../schema/index.ts";
import { type RegistryRouterClient, type RexServerSetup } from "../app.ts";
import { memoryLedger, type Ledger } from "../audit.ts";
import { DENSITY_HEADER } from "../context.ts";
import {
  RPC_PREFIX as EXPORTED_RPC_PREFIX,
  installRpcRoute as exportedInstallRpcRoute,
} from "../index.ts";
import { buildActionRouter } from "../router.ts";
import { REX_ROUTES } from "../routes.ts";
import { RPC_PREFIX, installRpcRoute } from "./rpc.ts";

const APP = "rpc-route";
const ORIGIN = "http://rex.test";

const toggleDust = action("toggle-dust", {
  input: z.object({ hide: boolean() }),
  output: z.object({ hide: boolean(), by: text() }),
  policy: always(),
  effect: "reversible",
  handler: (input, ctx) => ({ hide: input.hide, by: ctx.actor.id }),
});

const send = action("send", {
  input: z.object({ to: text({ min: 1 }) }),
  output: z.object({ to: text() }),
  policy: can("send"),
  effect: "reversible",
  handler: (input) => ({ to: input.to }),
});

const registry = { entities: [], actions: [toggleDust, send], pages: [], policies: [] };
const alice = actor({ id: "alice", permissions: ["send"] });

function resolveActor(request: Request): Actor {
  return request.headers.get("authorization") === "Bearer alice" ? alice : anonymousActor;
}

function mount(ledger: Ledger) {
  const manifest = buildManifest(registry, { app: APP });
  const setup: RexServerSetup = {
    options: { registry, ledger, actor: resolveActor, app: APP, manifest },
    handler: new RPCHandler(buildActionRouter(registry, { ledger })),
    manifestBody: stableStringify(manifest),
  };
  const app = new Hono();
  installRpcRoute(app, setup);
  return app;
}

function clientFor(
  app: ReturnType<typeof mount>,
  headers: Readonly<Record<string, string>>,
  observe: (response: Response) => void = () => {},
): RegistryRouterClient<typeof registry> {
  return createORPCClient(
    new RPCLink({
      url: `${ORIGIN}${RPC_PREFIX}`,
      headers,
      fetch: async (request) => {
        const response = await app.fetch(request);
        observe(response);
        return response;
      },
    }),
  );
}

describe("installRpcRoute", () => {
  it("runs the matched procedure for the resolved actor and echoes the density on the response", async () => {
    expect(RPC_PREFIX).toBe(REX_RPC_PREFIX);
    expect(REX_ROUTES).toContain(installRpcRoute);
    expect(exportedInstallRpcRoute).toBe(installRpcRoute);
    expect(EXPORTED_RPC_PREFIX).toBe(RPC_PREFIX);
    const ledger = memoryLedger();
    const app = mount(ledger);
    const densities: (string | null)[] = [];
    const client = clientFor(app, { authorization: "Bearer alice" }, (response) => {
      densities.push(response.headers.get(DENSITY_HEADER));
    });
    await expect(client["toggle-dust"]({ hide: true })).resolves.toEqual({
      hide: true,
      by: "alice",
    });
    expect(densities).toEqual(["default"]);
    const records = await ledger.list();
    expect(records.map((record) => [record.actor, record.actionId, record.outcome])).toEqual([
      ["alice", "toggle-dust", "ok"],
    ]);
  });

  it("passes the x-rex-density header into the context and back out, refusing unknown values with 400", async () => {
    const ledger = memoryLedger();
    const app = mount(ledger);
    const densities: (string | null)[] = [];
    const agent = clientFor(app, { [DENSITY_HEADER]: "agent" }, (response) => {
      densities.push(response.headers.get(DENSITY_HEADER));
    });
    await expect(agent["toggle-dust"]({ hide: false })).resolves.toEqual({
      hide: false,
      by: "anonymous",
    });
    expect(densities).toEqual(["agent"]);
    const invalid = await app.request(`${RPC_PREFIX}/toggle-dust`, {
      method: "POST",
      headers: { "content-type": "application/json", [DENSITY_HEADER]: "compact" },
      body: JSON.stringify({ json: { hide: true } }),
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({
      code: "BAD_REQUEST",
      message: 'REX321 x-rex-density must be one of default, agent, received "compact"',
    });
    expect(invalid.headers.has(DENSITY_HEADER)).toBe(false);
    expect((await ledger.list()).map((record) => record.outcome)).toEqual(["ok"]);
  });

  it("falls through to the following handlers when no procedure matches the path", async () => {
    const ledger = memoryLedger();
    const app = mount(ledger);
    app.all(`${RPC_PREFIX}/*`, (c) => c.json({ fallthrough: c.req.path }, 404));
    const response = await app.request(`${RPC_PREFIX}/nope`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ json: {} }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ fallthrough: "/rex/rpc/nope" });
    expect(response.headers.has(DENSITY_HEADER)).toBe(false);
    expect((await app.request("/rex/other")).status).toBe(404);
    expect(await ledger.list()).toEqual([]);
  });

  it("enforces the action policy for the resolved actor through the real router", async () => {
    const ledger = memoryLedger();
    const app = mount(ledger);
    await expect(clientFor(app, {}).send({ to: "bob" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
      data: { action: "send", reason: "missing-permission:send" },
    });
    await expect(
      clientFor(app, { authorization: "Bearer alice" }).send({ to: "bob" }),
    ).resolves.toEqual({ to: "bob" });
    expect((await ledger.list()).map((record) => [record.actor, record.outcome])).toEqual([
      ["anonymous", "FORBIDDEN"],
      ["alice", "ok"],
    ]);
  });
});
