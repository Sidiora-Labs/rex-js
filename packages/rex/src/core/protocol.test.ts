// @vitest-environment happy-dom
import { RPCHandler } from "@orpc/server/fetch";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { useAct, type ActHandle, type ActResult } from "../client/act.ts";
import { createRexApp, type RexFetch } from "../client/app.tsx";
import * as clientContext from "../client/context.ts";
import { useActor } from "../client/context.ts";
import { createOutcomeStore, OutcomeProvider, type OutcomeStore } from "../client/outcome.ts";
import { RESERVED_QUERY_KEYS as ROUTER_RESERVED_QUERY_KEYS, RexRoutes } from "../client/router.tsx";
import { buildManifest } from "../manifest/build.ts";
import { memoryLedger, type Ledger } from "../server/audit.ts";
import * as serverContext from "../server/context.ts";
import { createRexContext, createRexServer } from "../server/index.ts";
import * as serverIndex from "../server/index.ts";
import { buildActionRouter } from "../server/router.ts";
import { action } from "./action.ts";
import { actor, anonymousActor, type Actor } from "./actor.ts";
import { page } from "./page.ts";
import { policy } from "./policy.ts";
import {
  CONFIRM_PROCEDURE,
  RESERVED_QUERY_KEYS,
  TEXT_DIRECTIONS,
  REX_ACTOR_HEADER,
  REX_CONFIRM_HEADER,
  REX_DENSITY_HEADER,
  REX_MANIFEST_PATH,
  REX_RPC_PREFIX,
  isReservedQueryKey,
} from "./protocol.ts";
import { createRegistry } from "./registry.ts";
import { money, text } from "../schema/index.ts";
import { z } from "zod/mini";

const wallet = policy("wallet", {
  permissions: ["send"],
  resolve: (subject) => subject.permissions.filter((permission) => permission === "send"),
});

const send = action("send", {
  input: z.object({ to: text({ min: 1 }), amount: money() }),
  output: z.object({ txId: text() }),
  policy: wallet.can("send"),
  effect: "irreversible",
  label: "Send",
  handler: (input) => ({ txId: `tx-${input.to}-${input.amount}` }),
});

const home = page("home", { route: "/", actions: [send] });

const registry = createRegistry().register(wallet, send, home).freeze();
const manifest = buildManifest(registry);
const alice = actor({ id: "alice", permissions: ["send"] });

interface Mounted {
  readonly handle: { current: ActHandle<typeof send> | null };
  readonly store: OutcomeStore;
}

function Probe({ handle }: { readonly handle: { current: ActHandle<typeof send> | null } }) {
  const subject = useActor();
  const sendHandle = useAct(send);
  handle.current = sendHandle;
  return createElement(
    "div",
    null,
    createElement("p", { "data-testid": "actor" }, subject.id),
    createElement("button", { type: "button", ...sendHandle.controlProps }, "Send"),
  );
}

function mount(fetch: RexFetch, provided: Actor | null): Mounted {
  const handle: { current: ActHandle<typeof send> | null } = { current: null };
  const store = createOutcomeStore();
  const RexApp = createRexApp(
    provided === null
      ? { registry, fetch, baseUrl: "http://rex.test" }
      : { registry, manifest, actor: provided, fetch, baseUrl: "http://rex.test" },
  );
  const memory = memoryLocation({ path: "/" });
  render(
    createElement(
      OutcomeProvider,
      { store },
      createElement(
        RexApp,
        null,
        createElement(Router, {
          hook: memory.hook,
          children: createElement(RexRoutes, { render: () => createElement(Probe, { handle }) }),
        }),
      ),
    ),
  );
  return { handle, store };
}

function current(mounted: Mounted): ActHandle<typeof send> {
  const found = mounted.handle.current;
  if (found === null) throw new Error("the probe has not rendered");
  return found;
}

function toRequest(input: Request | string | URL, init?: RequestInit): Request {
  return input instanceof Request ? input : new Request(input, init);
}

afterEach(() => {
  cleanup();
});

describe("wire protocol constants", () => {
  it("names one confirm procedure, the headers, the paths and the reserved query keys", () => {
    expect(CONFIRM_PROCEDURE).toBe("_confirm");
    expect(REX_CONFIRM_HEADER).toBe("x-rex-confirm");
    expect(REX_ACTOR_HEADER).toBe("x-rex-actor");
    expect(REX_DENSITY_HEADER).toBe("x-rex-density");
    expect(REX_RPC_PREFIX).toBe("/rex/rpc");
    expect(REX_MANIFEST_PATH).toBe("/rex/manifest");
    expect([...RESERVED_QUERY_KEYS]).toEqual([
      "act",
      "input",
      "draft",
      "density",
      "locale",
      "devtools",
    ]);
    expect(isReservedQueryKey("act")).toBe(true);
    expect(isReservedQueryKey("locale")).toBe(true);
    expect(isReservedQueryKey("devtools")).toBe(true);
    expect([...TEXT_DIRECTIONS]).toEqual(["ltr", "rtl"]);
    expect(isReservedQueryKey("amount")).toBe(false);
  });

  it("is the value both the client and the server use", () => {
    expect(clientContext.CONFIRM_PROCEDURE).toBe(CONFIRM_PROCEDURE);
    expect(clientContext.CONFIRM_HEADER).toBe(REX_CONFIRM_HEADER);
    expect(clientContext.ACTOR_HEADER).toBe(REX_ACTOR_HEADER);
    expect(clientContext.DENSITY_HEADER).toBe(REX_DENSITY_HEADER);
    expect(clientContext.REX_RPC_PATH).toBe(REX_RPC_PREFIX);
    expect(clientContext.REX_MANIFEST_PATH).toBe(REX_MANIFEST_PATH);
    expect(serverIndex.CONFIRM_PROCEDURE).toBe(CONFIRM_PROCEDURE);
    expect(serverContext.CONFIRM_HEADER).toBe(REX_CONFIRM_HEADER);
    expect(serverContext.DENSITY_HEADER).toBe(REX_DENSITY_HEADER);
    expect(serverIndex.ACTOR_HEADER).toBe(REX_ACTOR_HEADER);
    expect(serverIndex.RPC_PREFIX).toBe(REX_RPC_PREFIX);
    expect(serverIndex.MANIFEST_PATH).toBe(REX_MANIFEST_PATH);
    expect([...ROUTER_RESERVED_QUERY_KEYS]).toEqual([...RESERVED_QUERY_KEYS]);
    expect(Object.keys(buildActionRouter(registry, { ledger: memoryLedger() }))).toContain(
      CONFIRM_PROCEDURE,
    );
  });
});

describe("client confirm path against the server confirm procedure", () => {
  it("runs an irreversible action through useAct against a real RPCHandler from buildActionRouter", async () => {
    const ledger: Ledger = memoryLedger();
    const handler = new RPCHandler(buildActionRouter(registry, { ledger }));
    const requests: string[] = [];
    const fetch: RexFetch = async (input, init) => {
      const request = toRequest(input, init);
      const path = decodeURIComponent(new URL(request.url).pathname);
      const token = request.headers.get(REX_CONFIRM_HEADER);
      requests.push(token === null ? path : `${path} +token`);
      const context = await createRexContext(request, () => alice);
      const { matched, response } = await handler.handle(request, {
        prefix: REX_RPC_PREFIX,
        context,
      });
      return matched ? response : new Response("not found", { status: 404 });
    };
    const mounted = mount(fetch, alice);
    expect(current(mounted).allowed).toBe(true);

    let result: ActResult<typeof send> | undefined;
    await act(async () => {
      result = await current(mounted).run({ to: "bob", amount: "4.20" });
    });
    expect(result).toEqual({ ok: true, output: { txId: "tx-bob-4.20" } });
    expect(requests).toEqual([
      `${REX_RPC_PREFIX}/${CONFIRM_PROCEDURE}`,
      `${REX_RPC_PREFIX}/send +token`,
    ]);
    expect(mounted.store.get("home")).toMatchObject({ actionId: "send", ok: true });
    expect(
      (await ledger.list()).map((record) => [record.actor, record.actionId, record.outcome]),
    ).toEqual([["alice", "send", "ok"]]);

    let grant = "";
    await act(async () => {
      grant = (await current(mounted).requestConfirm({ to: "bob", amount: "1" })).token;
    });
    let mismatch: ActResult<typeof send> | undefined;
    await act(async () => {
      mismatch = await current(mounted).run({ to: "bob", amount: "2" }, { confirmToken: grant });
    });
    expect(mismatch).toMatchObject({ ok: false, code: "PRECONDITION_REQUIRED" });
    let reused: ActResult<typeof send> | undefined;
    await act(async () => {
      reused = await current(mounted).run({ to: "bob", amount: "1" }, { confirmToken: grant });
    });
    expect(reused).toMatchObject({ ok: false, code: "PRECONDITION_REQUIRED" });
    expect(
      (await ledger.list({ outcome: "PRECONDITION_REQUIRED" })).map((record) => record.actionId),
    ).toEqual(["send", "send"]);
  });

  it("reads the actor from the manifest response of createRexServer and confirms as that actor", async () => {
    const ledger: Ledger = memoryLedger();
    const server = createRexServer({
      registry,
      ledger,
      actor: (request) =>
        request.headers.get("authorization") === "Bearer alice" ? alice : anonymousActor,
    });
    const fetch: RexFetch = async (input, init) => {
      const request = toRequest(input, init);
      const headers = new Headers(request.headers);
      headers.set("authorization", "Bearer alice");
      headers.set(REX_DENSITY_HEADER, "agent");
      const body = request.method === "GET" ? null : await request.text();
      const forwarded = new Request(request.url, { method: request.method, headers, body });
      if (request.method !== "GET") forwarded.headers.set("origin", new URL(request.url).origin);
      return server.fetch(forwarded);
    };
    const mounted = mount(fetch, null);
    await waitFor(() => expect(screen.getByTestId("actor").textContent).toBe("alice"));
    const button = screen.getByRole("button", { name: "Send" });
    expect(button.getAttribute("data-rex")).toBe("home/send");
    expect(button.getAttribute("data-rex-allowed")).toBe("true");

    let result: ActResult<typeof send> | undefined;
    await act(async () => {
      result = await current(mounted).run({ to: "carol", amount: "9" });
    });
    expect(result).toEqual({ ok: true, output: { txId: "tx-carol-9" } });
    expect(
      (await ledger.list()).map((record) => [record.actor, record.actionId, record.outcome]),
    ).toEqual([["alice", "send", "ok"]]);
  });
});
