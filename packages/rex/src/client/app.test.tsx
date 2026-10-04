import { os } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { action } from "../core/action.ts";
import { actor, anonymousActor } from "../core/actor.ts";
import { page } from "../core/page.ts";
import { always, policy } from "../core/policy.ts";
import { createRegistry } from "../core/registry.ts";
import { text, z } from "../core/schema.ts";
import { buildManifest } from "../manifest/build.ts";
import type { Manifest } from "../manifest/types.ts";
import {
  checkManifest,
  createRexApp,
  decodeActorHeader,
  encodeActorHeader,
  parseManifest,
  RexStartupError,
  type RexFetch,
} from "./app.tsx";
import {
  ACTOR_HEADER,
  DENSITY_HEADER,
  REX_MANIFEST_PATH,
  REX_RPC_PATH,
  procedureOf,
  useActor,
  useManifest,
  useRegistry,
  useRexClient,
  useRexRuntime,
} from "./context.ts";

const wallet = policy("wallet", {
  permissions: ["view", "send"],
  resolve: (subject) => subject.permissions.filter((p) => p === "view" || p === "send"),
});

const echo = action("echo", {
  input: z.object({ text: text({ min: 1 }) }),
  output: z.object({ echoed: text() }),
  policy: always(),
  effect: "read",
  label: "Echo",
  handler: (input) => ({ echoed: input.text.toUpperCase() }),
});

const home = page("home", {
  route: "/",
  policy: wallet.can("view"),
  actions: [echo],
  regions: ["main"],
});

const registry = createRegistry().register(wallet, echo, home).freeze();
const manifest = buildManifest(registry, { app: "probe" });

const signedIn = actor({ id: "ada", roles: ["owner"], permissions: ["view", "send"] });

const rpc = new RPCHandler({
  [echo.id]: os
    .input(echo.input)
    .output(echo.output)
    .handler(({ input }) => echo.handler(input, { actor: signedIn })),
});

interface Server {
  readonly fetch: RexFetch;
  readonly requests: string[];
}

function server(body: unknown = manifest, headers: Record<string, string> = {}): Server {
  const requests: string[] = [];
  const fetch: RexFetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    requests.push(`${request.method} ${url.pathname}`);
    if (url.pathname === REX_MANIFEST_PATH) {
      return new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json", ...headers },
      });
    }
    if (url.pathname.startsWith(`${REX_RPC_PATH}/`)) {
      const { matched, response } = await rpc.handle(request, {
        prefix: REX_RPC_PATH,
        context: {},
      });
      if (matched) return response;
    }
    return new Response("not found", { status: 404 });
  };
  return { fetch, requests };
}

function Probe() {
  const appManifest = useManifest();
  const current = useActor();
  const declared = useRegistry();
  const client = useRexClient();
  const { density } = useRexRuntime();
  const [result, setResult] = useState("none");
  return (
    <div>
      <p data-testid="app">{appManifest.app.name}</p>
      <p data-testid="actor">{current.id}</p>
      <p data-testid="permissions">{current.permissions.join(",")}</p>
      <p data-testid="pages">{declared.pages.map((p) => p.id).join(",")}</p>
      <p data-testid="density">{density ?? "none"}</p>
      <p data-testid="result">{result}</p>
      <button
        type="button"
        onClick={() => {
          void procedureOf(client, echo.id)({ text: "hello" }).then((output) =>
            setResult(JSON.stringify(output)),
          );
        }}
      >
        call
      </button>
    </div>
  );
}

afterEach(() => {
  cleanup();
});

describe("createRexApp", () => {
  it("reads the manifest and the actor header at startup and resolves every hook", async () => {
    const { fetch, requests } = server(manifest, {
      [ACTOR_HEADER]: encodeActorHeader(signedIn),
      [DENSITY_HEADER]: "agent",
    });
    const RexApp = createRexApp({ registry, fetch, baseUrl: "http://rex.test" });
    render(
      <RexApp>
        <Probe />
      </RexApp>,
    );
    expect(screen.getByRole("status").textContent).toBe("Loading app");
    await waitFor(() => expect(screen.getByTestId("app").textContent).toBe("probe"));
    expect(screen.getByTestId("actor").textContent).toBe("ada");
    expect(screen.getByTestId("permissions").textContent).toBe("view,send");
    expect(screen.getByTestId("pages").textContent).toBe("home");
    expect(screen.getByTestId("density").textContent).toBe("agent");
    expect(requests).toEqual([`GET ${REX_MANIFEST_PATH}`]);
  });

  it("falls back to the anonymous actor when the manifest response carries no actor", async () => {
    const { fetch } = server();
    const RexApp = createRexApp({ registry, fetch, baseUrl: "http://rex.test" });
    render(
      <RexApp>
        <Probe />
      </RexApp>,
    );
    await waitFor(() => expect(screen.getByTestId("actor").textContent).toBe(anonymousActor.id));
    expect(screen.getByTestId("density").textContent).toBe("none");
  });

  it("calls actions through the oRPC client over RPCLink at /rex/rpc", async () => {
    const { fetch, requests } = server(manifest, { [ACTOR_HEADER]: encodeActorHeader(signedIn) });
    const RexApp = createRexApp({ registry, fetch, baseUrl: "http://rex.test" });
    render(
      <RexApp>
        <Probe />
      </RexApp>,
    );
    await waitFor(() => expect(screen.getByTestId("app").textContent).toBe("probe"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "call" }));
    });
    await waitFor(() =>
      expect(screen.getByTestId("result").textContent).toBe(JSON.stringify({ echoed: "HELLO" })),
    );
    expect(requests).toEqual([`GET ${REX_MANIFEST_PATH}`, `POST ${REX_RPC_PATH}/echo`]);
  });

  it("renders immediately without fetching when the manifest and actor are provided", () => {
    const { fetch, requests } = server();
    const RexApp = createRexApp({
      registry,
      manifest,
      actor: signedIn,
      fetch,
      baseUrl: "http://rex.test",
    });
    render(
      <RexApp>
        <Probe />
      </RexApp>,
    );
    expect(screen.getByTestId("app").textContent).toBe("probe");
    expect(screen.getByTestId("actor").textContent).toBe("ada");
    expect(requests).toEqual([]);
  });

  it("shows a startup error when the served manifest disagrees with the registry, then retries", async () => {
    const stale: Manifest = { ...manifest, actions: [] };
    let body: unknown = stale;
    const requests: string[] = [];
    const fetch: RexFetch = async (input) => {
      requests.push(String(input instanceof Request ? input.url : input));
      return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
    };
    const RexApp = createRexApp({ registry, fetch, baseUrl: "http://rex.test" });
    render(
      <RexApp>
        <Probe />
      </RexApp>,
    );
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "manifest and registry disagree on actions (missing from the manifest: echo)",
      ),
    );
    body = manifest;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    });
    await waitFor(() => expect(screen.getByTestId("app").textContent).toBe("probe"));
    expect(requests).toHaveLength(2);
  });

  it("shows a startup error when GET /rex/manifest fails", async () => {
    const fetch: RexFetch = async () => new Response("down", { status: 503 });
    const RexApp = createRexApp({ registry, fetch, baseUrl: "http://rex.test" });
    render(
      <RexApp>
        <Probe />
      </RexApp>,
    );
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("GET /rex/manifest answered 503"),
    );
  });

  it("refuses to start without an http origin", () => {
    expect(() => createRexApp({ registry, baseUrl: "file:///tmp" })).toThrow(RexStartupError);
  });

  it("throws when a hook is used outside RexApp", () => {
    function Outside() {
      useManifest();
      return null;
    }
    const original = console.error;
    console.error = () => {};
    try {
      expect(() => render(<Outside />)).toThrow("inside the RexApp returned by createRexApp()");
    } finally {
      console.error = original;
    }
  });
});

describe("startup helpers", () => {
  it("round-trips the actor header", () => {
    const decoded = decodeActorHeader(encodeActorHeader(signedIn));
    expect(decoded).toEqual(signedIn);
    expect(() => decodeActorHeader("%7Bnot-json")).toThrow(RexStartupError);
    expect(() => decodeActorHeader(encodeURIComponent("[1]"))).toThrow(RexStartupError);
    expect(() => decodeActorHeader(encodeURIComponent('{"id":""}'))).toThrow(RexStartupError);
  });

  it("validates the manifest shape and its agreement with the registry", () => {
    expect(parseManifest(JSON.parse(JSON.stringify(manifest)))).toEqual(manifest);
    expect(() => parseManifest({ ...manifest, version: 2 })).toThrow("manifest version 2");
    expect(() => parseManifest({ ...manifest, pages: null })).toThrow('"pages" must be an array');
    expect(() => checkManifest({ ...manifest, pages: [] }, registry)).toThrow(
      "manifest and registry disagree on pages (missing from the manifest: home)",
    );
    expect(checkManifest(manifest, registry)).toBe(manifest);
  });
});
