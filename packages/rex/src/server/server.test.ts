import { ORPCError, createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { beforeEach, describe, expect, expectTypeOf, it } from "vitest";
import { action } from "../core/action.ts";
import { actor, anonymousActor, type Actor } from "../core/actor.ts";
import { entity } from "../core/entity.ts";
import { flow } from "../core/flow.ts";
import { memoryJournal } from "../core/journal.ts";
import { page } from "../core/page.ts";
import { always, never, policy } from "../core/policy.ts";
import { createRegistry } from "../core/registry.ts";
import { boolean, id, money, ref, text } from "../schema/index.ts";
import { z } from "zod/mini";
import { buildManifest, stableStringify } from "../manifest/build.ts";
import { REX_ACTOR_HEADER, REX_DENSITY_HEADER } from "../core/protocol.ts";
import {
  ACTOR_HEADER,
  CONFIRM_HEADER,
  DENSITY_HEADER,
  HEALTH_PATH,
  MANIFEST_PATH,
  FLOW_RPC_PREFIX,
  CSP_REPORT_ONLY_HEADER,
  createRexContext,
  createRexServer,
  memoryLedger,
  mountRexServer,
  requestNonce,
  CSP_HEADER,
  type FlowRouter,
  type Ledger,
  type RegistryRouterClient,
} from "./index.ts";
import type { RouterClient } from "@orpc/server";

const ORIGIN = "http://rex.test";
const LOCAL_ORIGIN = "http://localhost";

const wallet = policy("wallet", {
  permissions: ["send"],
  resolve: (subject) => subject.permissions.filter((permission) => permission === "send"),
});

const account = entity("account", {
  fields: { id: id(), name: text({ min: 1 }), balance: money() },
  label: (record) => record.name,
});

const send = action("send", {
  input: z.object({ to: ref("contact"), amount: money() }),
  output: z.object({ txId: text() }),
  policy: wallet.requires({ unlocked: true, permissions: ["send"] }),
  effect: "irreversible",
  label: "Send",
  shortcut: "mod+enter",
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

const purge = action("purge", {
  input: z.object({}),
  output: z.object({}),
  policy: never(),
  effect: "reversible",
  handler: () => ({}),
});

const portfolio = page("portfolio", {
  route: "/",
  actions: [toggleDust, purge],
  regions: ["balances"],
});

const sendPage = page("send", {
  route: "/send",
  actions: [send],
  chrome: { back: "portfolio" },
  recovery: "portfolio",
});

const source = {
  entities: [account],
  actions: [send, toggleDust, purge],
  pages: [portfolio, sendPage],
  policies: [wallet],
};

const actors: Record<string, Actor> = {
  alice: actor({ id: "alice", permissions: ["send"], attributes: { unlocked: true } }),
  carol: actor({ id: "carol", permissions: ["send"], attributes: { unlocked: false } }),
};

function resolveActor(request: Request): Actor {
  const name = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  return actors[name] ?? anonymousActor;
}

interface TestClientContext {
  readonly confirm?: string;
}

function clientFor(
  app: ReturnType<typeof createRexServer>,
  as: string,
  density?: string,
): RegistryRouterClient<typeof source, TestClientContext> {
  const link = new RPCLink<TestClientContext>({
    url: "http://rex.test/rex/rpc",
    headers: ({ context }) => ({
      authorization: `Bearer ${as}`,
      origin: ORIGIN,
      ...(density === undefined ? {} : { [DENSITY_HEADER]: density }),
      ...(context.confirm === undefined ? {} : { [CONFIRM_HEADER]: context.confirm }),
    }),
    fetch: async (request) => app.fetch(request),
  });
  return createORPCClient(link);
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

describe("createRexServer", () => {
  let ledger: Ledger;
  let app: ReturnType<typeof createRexServer>;

  beforeEach(() => {
    ledger = memoryLedger();
    app = createRexServer({ registry: source, ledger, actor: resolveActor, app: "demo" });
  });

  it("serves the deterministic manifest at GET /rex/manifest", async () => {
    const response = await app.request(MANIFEST_PATH);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const body = await response.text();
    expect(body).toBe(stableStringify(buildManifest(source, { app: "demo" })));
    const manifest = JSON.parse(body) as ReturnType<typeof buildManifest>;
    expect(manifest.app).toEqual({ name: "demo" });
    expect(manifest.pages.map((declared) => [declared.id, declared.route])).toEqual([
      ["portfolio", "/"],
      ["send", "/send"],
    ]);
    expect(manifest.actions.map((declared) => declared.id)).toEqual([
      "purge",
      "send",
      "toggle-dust",
    ]);
    expect(await (await app.request(MANIFEST_PATH)).text()).toBe(body);
  });

  it("sets the resolved actor and density headers on the manifest response", async () => {
    expect(ACTOR_HEADER).toBe(REX_ACTOR_HEADER);
    expect(DENSITY_HEADER).toBe(REX_DENSITY_HEADER);
    const response = await app.request(MANIFEST_PATH, {
      headers: { authorization: "Bearer alice", [DENSITY_HEADER]: "agent" },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get(REX_DENSITY_HEADER)).toBe("agent");
    const encoded = response.headers.get(REX_ACTOR_HEADER);
    expect(encoded).not.toBeNull();
    expect(encoded).toBe(encodeURIComponent(encoded === null ? "" : decodeURIComponent(encoded)));
    expect(JSON.parse(decodeURIComponent(encoded ?? ""))).toEqual({
      id: "alice",
      roles: [],
      permissions: ["send"],
      attributes: { unlocked: true },
    });
    const anonymous = await app.request(MANIFEST_PATH);
    expect(anonymous.headers.get(REX_DENSITY_HEADER)).toBeNull();
    expect(JSON.parse(decodeURIComponent(anonymous.headers.get(REX_ACTOR_HEADER) ?? ""))).toEqual({
      id: "anonymous",
      roles: [],
      permissions: [],
      attributes: {},
    });
    const invalid = await app.request(MANIFEST_PATH, { headers: { [DENSITY_HEADER]: "compact" } });
    expect(invalid.status).toBe(400);
  });

  it("serves the same manifest from a frozen registry", async () => {
    const registry = createRegistry()
      .register(account, wallet, send, toggleDust, purge, portfolio, sendPage)
      .freeze();
    const fromRegistry = createRexServer({ registry, ledger, actor: resolveActor, app: "demo" });
    expect(await (await fromRegistry.request(MANIFEST_PATH)).text()).toBe(
      await (await app.request(MANIFEST_PATH)).text(),
    );
  });

  it("answers GET /rex/health", async () => {
    const response = await app.request(HEALTH_PATH);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("runs an allowed action over RPC for the resolved actor and audits it", async () => {
    const client = clientFor(app, "alice");
    expectTypeOf(client["toggle-dust"]).parameter(0).toEqualTypeOf<{ hide: boolean }>();
    await expect(client["toggle-dust"]({ hide: true })).resolves.toEqual({
      hide: true,
      by: "alice",
    });
    const records = await ledger.list();
    expect(records.map((record) => [record.actor, record.actionId, record.outcome])).toEqual([
      ["alice", "toggle-dust", "ok"],
    ]);
  });

  it("returns FORBIDDEN with the policy reason for a forbidden action", async () => {
    const purged = await rejection(clientFor(app, "alice").purge({}));
    expect(purged.code).toBe("FORBIDDEN");
    expect(purged.status).toBe(403);
    expect(purged.data).toEqual({ action: "purge", reason: "never" });
    const lockedSend = await rejection(clientFor(app, "carol").send({ to: "bob", amount: "1" }));
    expect(lockedSend.code).toBe("FORBIDDEN");
    expect(lockedSend.data).toEqual({ action: "send", reason: "locked" });
    const anonymous = await rejection(clientFor(app, "nobody").send({ to: "bob", amount: "1" }));
    expect(anonymous.data).toEqual({ action: "send", reason: "locked" });
    expect((await ledger.list({ outcome: "FORBIDDEN" })).map((record) => record.actor)).toEqual([
      "alice",
      "carol",
      "anonymous",
    ]);
  });

  it("carries the confirm token header through to irreversible actions", async () => {
    const client = clientFor(app, "alice");
    const missing = await rejection(client.send({ to: "bob", amount: "2" }));
    expect(missing.code).toBe("PRECONDITION_REQUIRED");
    expect(missing.status).toBe(428);
    const confirmation = await client._confirm({
      action: "send",
      input: { to: "bob", amount: "2" },
    });
    await expect(
      client.send({ to: "bob", amount: "2" }, { context: { confirm: confirmation.token } }),
    ).resolves.toEqual({ txId: "tx-bob-2" });
  });

  describe("density", () => {
    it("copies the x-rex-density header into the context", async () => {
      const agent = await createRexContext(
        new Request("http://rex.test/rex/rpc/send", {
          headers: {
            [DENSITY_HEADER]: "agent",
            authorization: "Bearer alice",
            [CONFIRM_HEADER]: "abc",
          },
        }),
        resolveActor,
      );
      expect(agent).toEqual({ actor: actors.alice, density: "agent", confirm: "abc" });
      const plain = await createRexContext(
        new Request("http://rex.test/rex/rpc/send"),
        resolveActor,
      );
      expect(plain).toEqual({ actor: anonymousActor, density: "default" });
    });

    it("seeds the context nonce from the request so the CSP header and SSR share it", async () => {
      const request = new Request(`${ORIGIN}/rex/manifest`);
      const context = await createRexContext(request, resolveActor);
      expect(context.nonce).toMatch(/^[0-9a-f]{32}$/);
      expect(context.nonce).toBe(requestNonce(request));
      expect((await createRexContext(request, resolveActor)).nonce).toBe(context.nonce);
      const other = await createRexContext(new Request(`${ORIGIN}/rex/manifest`), resolveActor);
      expect(other.nonce).not.toBe(context.nonce);
      const response = await app.fetch(request);
      expect(response.headers.get(CSP_HEADER)).toContain(`'nonce-${context.nonce}'`);
    });

    it("echoes the resolved density on RPC responses", async () => {
      let observed: string | null = null;
      const link = new RPCLink({
        url: "http://rex.test/rex/rpc",
        headers: { authorization: "Bearer alice", [DENSITY_HEADER]: "agent", origin: ORIGIN },
        fetch: async (request) => {
          const response = await app.fetch(request);
          observed = response.headers.get(DENSITY_HEADER);
          return response;
        },
      });
      const client: RegistryRouterClient<typeof source> = createORPCClient(link);
      await client["toggle-dust"]({ hide: false });
      expect(observed).toBe("agent");
      await clientFor(app, "alice")["toggle-dust"]({ hide: false });
    });

    it("rejects an unknown density with 400 before any action runs", async () => {
      const response = await app.request("/rex/rpc/toggle-dust", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [DENSITY_HEADER]: "compact",
          origin: LOCAL_ORIGIN,
        },
        body: JSON.stringify({ json: { hide: true } }),
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        code: "BAD_REQUEST",
        message: 'REX321 x-rex-density must be one of default, agent, received "compact"',
      });
      expect(await ledger.list()).toEqual([]);
      await expect(
        clientFor(app, "alice", "compact")["toggle-dust"]({ hide: true }),
      ).rejects.toThrow();
    });
  });

  it("returns 404 for unknown procedures and paths", async () => {
    const response = await app.request("/rex/rpc/nope", {
      method: "POST",
      headers: { "content-type": "application/json", origin: LOCAL_ORIGIN },
      body: JSON.stringify({ json: {} }),
    });
    expect(response.status).toBe(404);
    expect((await app.request("/rex/unknown")).status).toBe(404);
  });

  it("sends x-rex-density on the manifest response only when the request carried it", async () => {
    const plain = await app.request(MANIFEST_PATH);
    expect(plain.status).toBe(200);
    expect(plain.headers.has(REX_DENSITY_HEADER)).toBe(false);
    const fallback = await app.request(MANIFEST_PATH, { headers: { [DENSITY_HEADER]: "default" } });
    expect(fallback.headers.get(REX_DENSITY_HEADER)).toBe("default");
  });

  it("mounts the registry flows at /rex/flow with the resolved actor", async () => {
    const review = flow("review", {
      steps: [
        { action: toggleDust, input: () => ({ hide: true }) },
        { approval: "sign-off", label: "Sign off", approvers: wallet.can("send") },
      ],
      journal: memoryJournal(),
    });
    const server = createRexServer({
      registry: { ...source, flows: [review] },
      ledger,
      actor: resolveActor,
    });
    const flows = (as: string): RouterClient<FlowRouter> =>
      createORPCClient(
        new RPCLink({
          url: `http://rex.test${FLOW_RPC_PREFIX}`,
          headers: { authorization: `Bearer ${as}`, origin: ORIGIN },
          fetch: async (request) => server.fetch(request),
        }),
      );
    expect(await flows("alice").status({ flow: "review", instance: "one" })).toEqual({
      flow: "review",
      instance: "one",
      status: "idle",
      gate: null,
      completed: 0,
    });
    const paused = await flows("alice").start({ flow: "review", instance: "one" });
    expect(paused).toMatchObject({ status: "paused", gate: { id: "sign-off", label: "Sign off" } });
    const denied = await rejection(
      flows("nobody").decide({ flow: "review", instance: "one", decision: "approve" }),
    );
    expect(denied.code).toBe("FORBIDDEN");
    const approved = await flows("alice").decide({
      flow: "review",
      instance: "one",
      decision: "approve",
    });
    expect(approved).toMatchObject({ status: "completed", gate: null, completed: 2 });
  });
});

describe("mountRexServer", () => {
  const PARTNER = "https://partner.example";

  it("serves a prebuilt manifest with resolved security and client options as given", async () => {
    const ledger = memoryLedger();
    const manifest = buildManifest(source, { app: "demo" });
    const server = mountRexServer({
      registry: source,
      ledger,
      actor: resolveActor,
      manifest,
      security: {
        csp: "report",
        origins: [PARTNER],
        headers: { "x-frame-options": "DENY" },
        secretNames: [],
      },
      client: { apiOrigin: "https://api.example" },
    });
    const response = await server.request(MANIFEST_PATH);
    expect(await response.text()).toBe(stableStringify(manifest));
    expect(response.headers.get(CSP_HEADER)).toBeNull();
    expect(response.headers.get(CSP_REPORT_ONLY_HEADER)).toContain(
      "connect-src 'self' https://api.example",
    );
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    const partner: RegistryRouterClient<typeof source> = createORPCClient(
      new RPCLink({
        url: `${ORIGIN}/rex/rpc`,
        headers: { authorization: "Bearer alice", origin: PARTNER },
        fetch: async (request) => server.fetch(request),
      }),
    );
    await expect(partner["toggle-dust"]({ hide: true })).resolves.toEqual({
      hide: true,
      by: "alice",
    });
    expect((await ledger.list()).map((record) => record.actionId)).toEqual(["toggle-dust"]);
  });

  it("refuses a manifest that rex build did not write", () => {
    expect(() =>
      mountRexServer({
        registry: source,
        ledger: memoryLedger(),
        actor: resolveActor,
        manifest: {} as ReturnType<typeof buildManifest>,
      }),
    ).toThrow(/REX400/);
  });

  it("leaves config validation to createRexServer", () => {
    expect(() =>
      createRexServer({
        registry: source,
        ledger: memoryLedger(),
        actor: resolveActor,
        security: { origins: [`${PARTNER}/path`] },
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
  });
});
