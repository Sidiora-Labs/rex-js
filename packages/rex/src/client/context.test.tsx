import { createORPCClient } from "@orpc/client";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { action } from "../core/action.ts";
import { actor } from "../core/actor.ts";
import { page } from "../core/page.ts";
import { always } from "../core/policy.ts";
import {
  CONFIRM_PROCEDURE as PROTOCOL_CONFIRM_PROCEDURE,
  REX_ACTOR_HEADER,
  REX_CONFIRM_HEADER,
  REX_DENSITY_HEADER,
  REX_MANIFEST_PATH as PROTOCOL_MANIFEST_PATH,
  REX_RPC_PREFIX,
} from "../core/protocol.ts";
import { createRegistry } from "../core/registry.ts";
import { money, text } from "../schema/index.ts";
import { z } from "zod/mini";
import { buildManifest } from "../manifest/build.ts";
import { memoryLedger } from "../server/audit.ts";
import { createRexServer } from "../server/index.ts";
import { createRexLink, type RexFetch } from "./app.tsx";
import {
  ACTOR_HEADER,
  API_CREDENTIALS,
  CONFIRM_HEADER,
  CONFIRM_PROCEDURE,
  DENSITY_HEADER,
  REX_MANIFEST_PATH,
  REX_RPC_PATH,
  RexRuntimeContext,
  apiFetch,
  credentialedFetch,
  procedureOf,
  useActor,
  useManifest,
  useRegistry,
  useRexClient,
  useRexRuntime,
  type RexClient,
  type RexRuntime,
} from "./context.ts";

const echo = action("echo", {
  input: z.object({ text: text({ min: 1 }) }),
  output: z.object({ echoed: text() }),
  policy: always(),
  effect: "read",
  label: "Echo",
  handler: (input) => ({ echoed: input.text.toUpperCase() }),
});

const send = action("send", {
  input: z.object({ amount: money() }),
  output: z.object({ receipt: text() }),
  policy: always(),
  effect: "irreversible",
  handler: (input) => ({ receipt: `r-${input.amount}` }),
});

const home = page("home", { route: "/", actions: [echo, send], states: ["ready"] });

const registry = createRegistry().register(echo, send, home).freeze();
const manifest = buildManifest(registry, { app: "probe" });
const ada = actor({ id: "ada", permissions: ["view"] });

interface Setup {
  readonly fetch: RexFetch;
  readonly client: RexClient;
  readonly runtime: RexRuntime;
}

function setup(): Setup {
  const server = createRexServer({ registry, ledger: memoryLedger(), actor: () => ada, app: "probe" });
  const fetch: RexFetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    if (request.method !== "GET" && !request.headers.has("origin")) {
      request.headers.set("origin", new URL(request.url).origin);
    }
    return server.fetch(request);
  };
  const client = createORPCClient<RexClient>(createRexLink("http://rex.test", fetch));
  const runtime: RexRuntime = {
    registry,
    manifest,
    actor: ada,
    client,
    density: "agent",
    baseUrl: "http://rex.test",
    fetch,
  };
  return { fetch, client, runtime };
}

afterEach(() => {
  cleanup();
});

describe("client protocol names", () => {
  it("re-exports the protocol constants under their client names", () => {
    expect(REX_RPC_PATH).toBe(REX_RPC_PREFIX);
    expect(REX_MANIFEST_PATH).toBe(PROTOCOL_MANIFEST_PATH);
    expect(CONFIRM_PROCEDURE).toBe(PROTOCOL_CONFIRM_PROCEDURE);
    expect(ACTOR_HEADER).toBe(REX_ACTOR_HEADER);
    expect(DENSITY_HEADER).toBe(REX_DENSITY_HEADER);
    expect(CONFIRM_HEADER).toBe(REX_CONFIRM_HEADER);
    expect(API_CREDENTIALS).toBe("include");
    expect(RexRuntimeContext.displayName).toBe("RexRuntime");
    expect(typeof apiFetch).toBe("function");
  });
});

describe("credentialedFetch", () => {
  it("sends cookies with every request while keeping the caller's init", async () => {
    const { fetch } = setup();
    const calls: { input: string; init: RequestInit | undefined }[] = [];
    const fetching = credentialedFetch((input, init) => {
      calls.push({ input: input instanceof Request ? input.url : String(input), init });
      return fetch(input, init);
    });
    const health = await fetching("http://rex.test/rex/health", {
      method: "GET",
      headers: { accept: "application/json" },
    });
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
    const manifestResponse = await fetching(new URL("http://rex.test/rex/manifest"));
    expect(manifestResponse.status).toBe(200);
    expect(calls).toEqual([
      {
        input: "http://rex.test/rex/health",
        init: { method: "GET", headers: { accept: "application/json" }, credentials: "include" },
      },
      { input: "http://rex.test/rex/manifest", init: { credentials: "include" } },
    ]);
  });
});

describe("procedureOf", () => {
  it("returns the client's procedure for an action and for the confirm procedure", async () => {
    const { client } = setup();
    expect(await procedureOf(client, "echo")({ text: "hello" })).toEqual({ echoed: "HELLO" });
    expect(await procedureOf(client, CONFIRM_PROCEDURE)({ action: "send", input: { amount: "1" } })).toMatchObject({
      action: "send",
      token: expect.any(String),
      expiresAt: expect.any(String),
    });
  });

  it("throws REX308 when the client has no such procedure", () => {
    const client: RexClient = {};
    expect(() => procedureOf(client, "echo")).toThrow(
      'REX308 rex: the oRPC client has no procedure "echo"',
    );
  });
});

describe("runtime hooks", () => {
  it("read the runtime provided to the context", () => {
    const { client, runtime } = setup();
    function Probe() {
      const whole = useRexRuntime();
      const pageIds = useRegistry()
        .pages.map((declared) => declared.id)
        .join("+");
      return (
        <p data-testid="probe">
          {[
            useManifest().app.name,
            useActor().id,
            pageIds,
            String(useRexClient() === client),
            String(whole === runtime),
            String(whole.density),
            String(whole.baseUrl),
          ].join(" ")}
        </p>
      );
    }
    render(
      <RexRuntimeContext.Provider value={runtime}>
        <Probe />
      </RexRuntimeContext.Provider>,
    );
    expect(screen.getByTestId("probe").textContent).toBe(
      "probe ada home true true agent http://rex.test",
    );
  });

  it("throw REX306 outside the RexApp runtime", () => {
    function Outside() {
      useRexRuntime();
      return null;
    }
    function Selector() {
      useRegistry();
      return null;
    }
    const original = console.error;
    console.error = () => {};
    try {
      const message =
        "REX306 rex: this hook must be called inside the RexApp returned by createRexApp()";
      expect(() => render(<Outside />)).toThrow(message);
      cleanup();
      expect(() => render(<Selector />)).toThrow(message);
    } finally {
      console.error = original;
    }
  });
});
