import { QueryClient, useQuery } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { action } from "../../core/action.ts";
import { actor } from "../../core/actor.ts";
import { page } from "../../core/page.ts";
import { always, never, policy } from "../../core/policy.ts";
import { createRegistry } from "../../core/registry.ts";
import { boolean, money, text, z } from "../../core/schema.ts";
import { buildManifest } from "../../manifest/build.ts";
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
  createAffordanceRegistry,
  createOverlayRegistry,
  readSidecar,
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
  const fetch: RexFetch = async (input, init) =>
    server.fetch(input instanceof Request ? input : new Request(input, init));
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
          input: send.inputJsonSchema,
          via: ["click", "key", "palette", "url"],
        },
        {
          id: "hide-dust",
          label: "Hide dust",
          allowed: true,
          reason: null,
          effect: "reversible",
          input: hideDust.inputJsonSchema,
          via: ["click", "palette", "url"],
        },
        {
          id: "purge",
          label: "purge",
          allowed: false,
          reason: "never",
          effect: "reversible",
          input: purge.inputJsonSchema,
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

  it("renders nothing and clears window.__rex outside a page", async () => {
    mount("/missing");
    expect(sidecarElements()).toHaveLength(0);
    expect(window.__rex).toBeUndefined();
  });
});
