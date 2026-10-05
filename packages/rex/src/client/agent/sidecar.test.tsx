import { QueryClient, useQuery } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToReadableStream } from "react-dom/server";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { action } from "../../core/action.ts";
import { actor } from "../../core/actor.ts";
import { page } from "../../core/page.ts";
import { always, never, policy } from "../../core/policy.ts";
import { createRegistry } from "../../core/registry.ts";
import { boolean, money, text } from "../../schema/index.ts";
import { z } from "zod/mini";
import { buildManifest } from "../../manifest/build.ts";
import { standardJsonSchema } from "../../manifest/json-schema.ts";
import { validateSidecar, type SidecarPayload } from "../../manifest/sidecar.schema.ts";
import { memoryLedger } from "../../server/audit.ts";
import { createRexServer } from "../../server/index.ts";
import { createRexApp, type RexFetch } from "../app.tsx";
import { createOutcomeStore, OutcomeProvider } from "../outcome.ts";
import { definePageModules, region, view, type PageModuleSet } from "../page.tsx";
import { ShellOutcome, Shell, type OutcomeSlotProps } from "../shell.tsx";
import {
  AffordanceRegistryProvider,
  OverlayRegistryProvider,
  RexSidecar,
  buildSidecarPayload,
  createAffordanceRegistry,
  createOverlayRegistry,
  readSidecar,
  useAffordances,
  type AffordanceRegistry,
  type OverlayRegistry,
} from "./sidecar.tsx";

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
  shortcut: "mod+enter",
  handler: (input) => ({ txId: `tx-${input.to}` }),
});

const hideDust = action("hide-dust", {
  input: z.object({ hide: boolean() }),
  output: z.object({ hide: boolean() }),
  policy: always(),
  effect: "reversible",
  label: "Hide dust",
  handler: (input) => ({ hide: input.hide }),
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
  params: z.object({ currency: text().optional() }),
  actions: [send, hideDust, purge],
  regions: ["holdings"],
  overlays: [{ id: "FilterSheet", dismiss: "both", binding: "region" }],
  states: ["loading", "recoverable-error", "ready"],
});

const about = page("about", { route: "/about", states: ["ready"] });

const gate: { resolve: ((value: string[]) => void) | null } = { resolve: null };

const Holdings = region("holdings", ({ act }) => {
  const holdings = useQuery<string[]>({
    queryKey: ["holdings"],
    queryFn: () =>
      new Promise<string[]>((resolve) => {
        gate.resolve = resolve;
      }),
  });
  const hide = act(hideDust);
  const sending = act(send);
  const purging = act(purge);
  return (
    <div>
      <p>{(holdings.data ?? []).join(", ")}</p>
      <button type="button" {...hide.controlProps} onClick={() => void hide.run({ hide: true })}>
        Hide dust
      </button>
      <button type="button" {...sending.controlProps}>
        Send
      </button>
      <button type="button" {...purging.controlProps}>
        Purge
      </button>
    </div>
  );
});

function Loading() {
  return <p>Loading holdings</p>;
}

function RecoverableError() {
  return <p>Could not load holdings</p>;
}

const pages: readonly PageModuleSet[] = [
  definePageModules({
    page: portfolio,
    view: view(() => <Holdings />),
    states: { Loading, RecoverableError },
    regions: { holdings: Holdings },
    overlays: { FilterSheet: () => <div>Filter</div> },
  }),
  definePageModules({ page: about, view: view(() => <p>About Rex</p>), states: {} }),
];

const registry = createRegistry()
  .register(wallet, send, hideDust, purge, portfolio, about)
  .freeze();
const manifest = buildManifest(registry);
const owner = actor({ id: "owner", permissions: ["send"] });

function Slot({ page: pageId }: OutcomeSlotProps) {
  return (
    <>
      <ShellOutcome page={pageId} />
      <RexSidecar />
    </>
  );
}

function DoubleSlot({ page: pageId }: OutcomeSlotProps) {
  return (
    <>
      <ShellOutcome page={pageId} />
      <RexSidecar />
      <RexSidecar />
    </>
  );
}

interface Mounted {
  readonly overlays: OverlayRegistry;
  readonly affordances: AffordanceRegistry;
  readonly memory: ReturnType<typeof memoryLocation>;
}

function mount(path: string, slot = Slot): Mounted {
  const server = createRexServer({ registry, ledger: memoryLedger(), actor: () => owner });
  const fetch: RexFetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    if (request.method !== "GET" && !request.headers.has("origin")) {
      request.headers.set("origin", new URL(request.url).origin);
    }
    return server.fetch(request);
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const RexApp = createRexApp({
    registry,
    manifest,
    actor: owner,
    fetch,
    baseUrl: "http://rex.test",
    queryClient,
  });
  const overlays = createOverlayRegistry();
  const affordances = createAffordanceRegistry();
  const memory = memoryLocation({ path, record: true });
  render(
    <OutcomeProvider store={createOutcomeStore()}>
      <OverlayRegistryProvider registry={overlays}>
        <AffordanceRegistryProvider registry={affordances}>
          <RexApp>
            <Router hook={memory.hook}>
              <Shell pages={pages} outcome={slot} />
            </Router>
          </RexApp>
        </AffordanceRegistryProvider>
      </OverlayRegistryProvider>
    </OutcomeProvider>,
  );
  return { overlays, affordances, memory };
}

function documentTree(path: string, overlays: OverlayRegistry): ReactNode {
  const server = createRexServer({ registry, ledger: memoryLedger(), actor: () => owner });
  const fetch: RexFetch = async (input, init) =>
    server.fetch(input instanceof Request ? input : new Request(input, init));
  const RexApp = createRexApp({
    registry,
    manifest,
    actor: owner,
    fetch,
    baseUrl: "http://rex.test",
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  });
  return (
    <OutcomeProvider store={createOutcomeStore()}>
      <OverlayRegistryProvider registry={overlays}>
        <AffordanceRegistryProvider registry={createAffordanceRegistry()}>
          <RexApp>
            <Router ssrPath={path}>
              <Shell pages={pages} outcome={Slot} />
            </Router>
          </RexApp>
        </AffordanceRegistryProvider>
      </OverlayRegistryProvider>
    </OutcomeProvider>
  );
}

async function serverHtml(tree: ReactNode): Promise<string> {
  const stream = await renderToReadableStream(tree);
  await stream.allReady;
  return new Response(stream).text();
}

function sidecar(): SidecarPayload {
  const raw = readSidecar(document);
  const result = validateSidecar(raw);
  if (!result.valid) throw new Error(JSON.stringify(result.issues));
  expect(window.__rex).toEqual(result.payload);
  return result.payload;
}

function sidecarElements(): NodeListOf<Element> {
  return document.querySelectorAll('script[type="application/rex+json"]');
}

afterEach(() => {
  cleanup();
  gate.resolve = null;
});

describe("RexSidecar", () => {
  it("hydrates against the server snapshot when another boundary has already registered handlers", async () => {
    function Reader() {
      const affordances = useAffordances("browser");
      return <pre>{JSON.stringify(affordances)}</pre>;
    }
    const tree = (registry: AffordanceRegistry) => (
      <AffordanceRegistryProvider registry={registry}>
        <Reader />
      </AffordanceRegistryProvider>
    );
    const container = document.createElement("div");
    container.innerHTML = await serverHtml(tree(createAffordanceRegistry()));
    document.body.append(container);
    const original = container.querySelector("pre");
    expect(original?.textContent).toBe("[]");
    const registry = createAffordanceRegistry();
    const unregister = registry.register("browser", [
      {
        id: "copy",
        label: "Copy",
        allowed: true,
        reason: null,
        effect: "read",
        input: {},
        via: ["click"],
        invoke: async () => navigator.clipboard.writeText("browser/copy"),
      },
    ]);
    const errors: unknown[] = [];
    let root: Root | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, tree(registry), {
          onRecoverableError: (error) => errors.push(error),
        });
      });
      await waitFor(() => expect(container.textContent).toContain('"id":"copy"'));
      expect(errors).toEqual([]);
      expect(container.querySelector("pre")).toBe(original);
      await act(async () => unregister());
      expect(original?.textContent).toBe("[]");
    } finally {
      await act(async () => root?.unmount());
      container.remove();
    }
  });
  it("keeps declared controls discoverable and pending until their browser handlers exist", () => {
    const copy = {
      id: "copy",
      label: "Copy",
      effect: "read",
      input: {},
      via: ["click", "palette"],
    } as const;
    const declared = page("browser", { route: "/browser", affordances: [copy] });
    const source = {
      manifest: buildManifest(createRegistry().register(declared).freeze()),
      page: declared,
      params: {},
      state: "ready",
      actor: owner,
      openOverlays: [],
      outcome: null,
    } as const;
    const pending = buildSidecarPayload(source);
    expect(pending.state).toBe("loading");
    expect(pending.actions).toEqual([
      { ...copy, allowed: false, reason: "Requires an active browser control" },
    ]);
    const affordances = [{ ...copy, allowed: true, reason: null, invoke: async () => null }];
    expect(buildSidecarPayload({ ...source, affordances, browserReady: false }).state).toBe(
      "loading",
    );
    expect(buildSidecarPayload({ ...source, affordances, browserReady: true })).toMatchObject({
      state: "ready",
      actions: [{ id: "copy", allowed: true, reason: null }],
    });
    expect(buildSidecarPayload({ ...source, state: "permission-denied" }).state).toBe(
      "permission-denied",
    );
    expect(buildSidecarPayload({ ...source, affordances: [] }).state).toBe("loading");
  });

  it("does not emit a ready interactive sidecar in server HTML before hydration", async () => {
    const previousUrl = window.location.href;
    window.history.replaceState(null, "", "/about");
    const container = document.createElement("div");
    container.innerHTML = await serverHtml(documentTree("/about", createOverlayRegistry()));
    expect(readSidecar(container)).toMatchObject({ page: "about", state: "loading" });
    const hydrated: { root: Root | null } = { root: null };
    document.body.append(container);
    try {
      await act(async () => {
        hydrated.root = hydrateRoot(container, documentTree("/about", createOverlayRegistry()));
      });
      await waitFor(() =>
        expect(readSidecar(container)).toMatchObject({ page: "about", state: "ready" }),
      );
      expect(readSidecar(container)).toEqual(window.__rex);
    } finally {
      await act(async () => hydrated.root?.unmount());
      container.remove();
      window.history.replaceState(null, "", previousUrl);
    }
  });
  it("renders one valid application/rex+json payload for the active page", async () => {
    mount("/?currency=usd");
    expect(sidecarElements()).toHaveLength(1);
    expect(sidecarElements()[0]?.id).toBe("rex-page");
    const payload = sidecar();
    expect(payload).toEqual({
      version: 1,
      page: "portfolio",
      params: { currency: "usd" },
      state: payload.state,
      actions: [
        {
          id: "send",
          label: "Send",
          allowed: true,
          reason: null,
          effect: "irreversible",
          input: standardJsonSchema(send.input, "input"),
          via: ["click", "key", "palette", "url"],
        },
        {
          id: "hide-dust",
          label: "Hide dust",
          allowed: true,
          reason: null,
          effect: "reversible",
          input: standardJsonSchema(hideDust.input, "input"),
          via: ["click", "palette", "url"],
        },
        {
          id: "purge",
          label: "purge",
          allowed: false,
          reason: "never",
          effect: "reversible",
          input: standardJsonSchema(purge.input, "input"),
          via: ["click", "palette", "url"],
        },
      ],
      overlays: [{ id: "FilterSheet", open: false, dismiss: "both" }],
      outcome: null,
    });
  });

  it("updates after a data state change", async () => {
    mount("/");
    await waitFor(() => expect(screen.getByText("Loading holdings")).toBeTruthy());
    expect(sidecar().state).toBe("loading");
    await act(async () => {
      gate.resolve?.(["gold", "silver"]);
    });
    await waitFor(() => expect(screen.getByText("gold, silver")).toBeTruthy());
    expect(sidecar().state).toBe("ready");
  });

  it("updates after an overlay opens and closes", async () => {
    const { overlays } = mount("/");
    expect(sidecar().overlays).toEqual([{ id: "FilterSheet", open: false, dismiss: "both" }]);
    await act(async () => {
      overlays.setOpen("portfolio", "FilterSheet", true);
    });
    expect(sidecar().overlays).toEqual([{ id: "FilterSheet", open: true, dismiss: "both" }]);
    await act(async () => {
      overlays.setOpen("portfolio", "FilterSheet", false);
    });
    expect(sidecar().overlays).toEqual([{ id: "FilterSheet", open: false, dismiss: "both" }]);
  });

  it("updates after an action outcome", async () => {
    mount("/");
    await act(async () => {
      gate.resolve?.(["gold"]);
    });
    await waitFor(() => expect(screen.getByText("gold")).toBeTruthy());
    expect(sidecar().outcome).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Hide dust" }));
    });
    await waitFor(() => expect(sidecar().outcome).not.toBeNull());
    const outcome = sidecar().outcome;
    expect(outcome).toMatchObject({
      action: "hide-dust",
      ok: true,
      message: "Hide dust succeeded",
    });
    expect(screen.getByRole("status", { name: "Outcome" }).textContent).toBe("Hide dust succeeded");
  });

  it("lists registered affordances next to the page actions", async () => {
    const { affordances } = mount("/");
    let unregister: () => void = () => {};
    await act(async () => {
      unregister = affordances.register("portfolio", [
        {
          id: "flow.approve",
          label: "Approve",
          allowed: false,
          reason: "missing-permission:approve",
          effect: "irreversible",
          input: {},
          via: ["palette", "click"],
          invoke: async () => null,
        },
      ]);
    });
    expect(sidecar().actions.at(-1)).toEqual({
      id: "flow.approve",
      label: "Approve",
      allowed: false,
      reason: "missing-permission:approve",
      effect: "irreversible",
      input: {},
      via: ["click", "palette"],
    });
    await act(async () => {
      unregister();
    });
    expect(sidecar().actions.map((entry) => entry.id)).toEqual(["send", "hide-dust", "purge"]);
  });

  it("keeps exactly one sidecar element per page across navigation", async () => {
    mount("/");
    expect(sidecarElements()).toHaveLength(1);
    expect(sidecar().page).toBe("portfolio");
    await act(async () => {
      fireEvent.click(screen.getByRole("link", { name: "About" }));
    });
    expect(screen.getByText("About Rex")).toBeTruthy();
    expect(sidecarElements()).toHaveLength(1);
    expect(sidecar()).toEqual({
      version: 1,
      page: "about",
      params: {},
      state: "ready",
      actions: [],
      overlays: [],
      outcome: null,
    });
  });

  it("refuses a second sidecar on the same page", () => {
    const original = console.error;
    console.error = () => {};
    try {
      expect(() => mount("/about", DoubleSlot)).toThrow(
        "rex: a page renders exactly one RexSidecar; another one is mounted",
      );
    } finally {
      console.error = original;
    }
  });

  it("writes the script in the commit that sets window.__rex when hydration renders a newer payload", async () => {
    window.history.replaceState(null, "", "/");
    const container = document.createElement("div");
    container.innerHTML = await serverHtml(documentTree("/", createOverlayRegistry()));
    document.body.append(container);
    const serverScript = container.querySelector('script[type="application/rex+json"]#rex-page');
    expect(serverScript).not.toBeNull();
    expect(JSON.parse(serverScript?.textContent ?? "")).toMatchObject({
      page: "portfolio",
      overlays: [{ id: "FilterSheet", open: false, dismiss: "both" }],
    });
    expect(window.__rex).toBeUndefined();

    const overlays = createOverlayRegistry();
    overlays.setOpen("portfolio", "FilterSheet", true);
    const hydrated: { root: Root | null } = { root: null };
    try {
      await act(async () => {
        hydrated.root = hydrateRoot(container, documentTree("/", overlays));
      });
      await waitFor(() => expect(window.__rex).toBeDefined());
      expect(sidecarElements()).toHaveLength(1);
      expect(container.querySelector("#rex-page")).toBe(serverScript);
      expect(window.__rex?.overlays).toEqual([{ id: "FilterSheet", open: true, dismiss: "both" }]);
      expect(JSON.parse(serverScript?.textContent ?? "")).toEqual(window.__rex);
      expect(sidecar().page).toBe("portfolio");
    } finally {
      await act(async () => {
        hydrated.root?.unmount();
      });
      container.remove();
    }
    expect(window.__rex).toBeUndefined();
  });

  it("renders nothing and clears window.__rex outside a page", async () => {
    mount("/missing");
    expect(sidecarElements()).toHaveLength(0);
    expect(window.__rex).toBeUndefined();
  });
});
