import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { action } from "../core/action.ts";
import { actor } from "../core/actor.ts";
import { page } from "../core/page.ts";
import { always } from "../core/policy.ts";
import { REX_DENSITY_HEADER, REX_MANIFEST_PATH } from "../core/protocol.ts";
import { createRegistry } from "../core/registry.ts";
import { money, text } from "../schema/index.ts";
import { z } from "zod/mini";
import { buildManifest } from "../manifest/build.ts";
import {
  SIDECAR_ELEMENT_ID,
  SIDECAR_MIME_TYPE,
  validateSidecar,
  type SidecarPayload,
} from "../manifest/sidecar.schema.ts";
import { memoryLedger, type Ledger } from "../server/audit.ts";
import { createRexServer } from "../server/index.ts";
import { useAddress } from "./agent/address.tsx";
import { DENSITY_ATTRIBUTE, DENSITY_STORAGE_KEY } from "./agent/density.ts";
import { OUTCOME_EMPTY_TEXT } from "./agent/outcome.tsx";
import { createRexEntry, type RexFetch } from "./app.tsx";
import basicPage, { greet } from "./fixtures/page-basic/page.ts";
import MainRegion from "./fixtures/page-basic/regions/main/region.tsx";
import * as basicStates from "./fixtures/page-basic/states.tsx";
import BasicView from "./fixtures/page-basic/view.tsx";
import secondPage from "./fixtures/page-second/page.ts";
import * as secondStates from "./fixtures/page-second/states.tsx";
import SecondView from "./fixtures/page-second/view.tsx";
import { defaultOutcomeStore } from "./outcome.ts";
import { definePageModules, region, view, type PageModuleSet } from "./page.tsx";

const withdraw = action("withdraw", {
  input: z.object({ amount: money().default("5") }),
  output: z.object({ receipt: text() }),
  policy: always(),
  effect: "irreversible",
  label: "Withdraw",
  shortcut: "mod+enter",
  handler: (input) => ({ receipt: `withdrew ${input.amount}` }),
});

const home = page("home", { route: "/", chrome: { title: "Home" }, states: ["ready"] });
const vault = page("vault", {
  route: "/vault",
  actions: [withdraw],
  regions: ["controls"],
  chrome: { title: "Vault" },
  states: ["ready"],
});

const VaultControls = region("controls", ({ act }) => {
  const handle = act(withdraw);
  const address = useAddress();
  return (
    <div>
      <p data-testid="address">
        {address.regionAddress} {address.action(withdraw.id)}
      </p>
      <button
        type="button"
        {...handle.controlProps}
        onClick={() => {
          void handle.run({ amount: "5" });
        }}
      >
        Withdraw
      </button>
    </div>
  );
});

const pages: readonly PageModuleSet[] = [
  definePageModules({ page: home, view: view(() => <p>Home body</p>), states: {} }),
  definePageModules({
    page: basicPage,
    view: BasicView,
    states: basicStates,
    regions: { main: MainRegion },
  }),
  definePageModules({ page: secondPage, view: SecondView, states: secondStates }),
  definePageModules({
    page: vault,
    view: view(() => <VaultControls />),
    states: {},
    regions: { controls: VaultControls },
  }),
];

const registry = createRegistry()
  .register(greet, withdraw, home, basicPage, secondPage, vault)
  .freeze();
const manifest = buildManifest(registry);
const viewer = actor({ id: "viewer", permissions: ["view"] });

interface Mounted {
  readonly ledger: Ledger;
  readonly manifestDensity: () => string | null | undefined;
}

function mount(path: string): Mounted {
  const ledger = memoryLedger();
  const server = createRexServer({ registry, ledger, actor: () => viewer });
  let density: string | null | undefined;
  const fetch: RexFetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    if (request.method !== "GET" && !request.headers.has("origin")) {
      request.headers.set("origin", new URL(request.url).origin);
    }
    const response = await server.fetch(request);
    if (new URL(request.url).pathname === REX_MANIFEST_PATH) {
      density = response.headers.get(REX_DENSITY_HEADER);
    }
    return response;
  };
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
        queryFn: ({ queryKey }) => (queryKey[0] === "greeting" ? "Hello" : ["gold"]),
      },
    },
  });
  window.history.replaceState(null, "", path);
  const RexEntry = createRexEntry(
    { registry, manifest, pages },
    { fetch, baseUrl: "http://rex.test", queryClient },
  );
  render(<RexEntry />);
  return { ledger, manifestDensity: () => density };
}

function sidecars(): Element[] {
  return [
    ...document.querySelectorAll(`script[type="${SIDECAR_MIME_TYPE}"]#${SIDECAR_ELEMENT_ID}`),
  ];
}

function sidecarPayload(): SidecarPayload {
  const found = sidecars();
  expect(found).toHaveLength(1);
  const validation = validateSidecar(JSON.parse(found[0]?.textContent ?? "null"));
  if (!validation.valid) throw new Error(JSON.stringify(validation.issues));
  return validation.payload;
}

async function ready(pageId: string): Promise<void> {
  await waitFor(() => expect(document.querySelector(`[data-rex-page="${pageId}"]`)).not.toBeNull());
}

async function click(element: Element) {
  await act(async () => {
    fireEvent.click(element);
  });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  for (const key of ["vault", "second", "home"]) defaultOutcomeStore.clear(key);
  localStorage.clear();
  document.documentElement.removeAttribute(DENSITY_ATTRIBUTE);
  window.history.replaceState(null, "", "/");
});

describe("the assembled entry", () => {
  it("renders exactly one sidecar per page and keeps it in step with navigation", async () => {
    mount("/vault");
    await ready("vault");
    const first = sidecarPayload();
    expect(first.page).toBe("vault");
    expect(first.state).toBe("ready");
    expect(first.actions.map((entry) => [entry.id, entry.allowed, entry.effect])).toEqual([
      ["withdraw", true, "irreversible"],
    ]);
    expect(first.actions[0]?.via).toEqual(["click", "key", "palette", "url"]);
    expect(window.__rex).toEqual(first);

    const link = within(screen.getByRole("navigation", { name: "Pages" })).getByRole("link", {
      name: "Second",
    });
    await click(link);
    await ready("second");
    const second = sidecarPayload();
    expect(second.page).toBe("second");
    expect(second.actions).toEqual([]);
    expect(window.__rex).toEqual(second);
    expect(sidecars()).toHaveLength(1);
  });

  it("renders the outcome region and opens the palette on mod+k", async () => {
    mount("/vault");
    await ready("vault");
    const outcome = screen.getByRole("status", { name: "Outcome" });
    expect(outcome.getAttribute("aria-live")).toBe("polite");
    expect(outcome.textContent).toContain(OUTCOME_EMPTY_TEXT);

    expect(screen.queryByRole("dialog", { name: "Command palette" })).toBeNull();
    await act(async () => {
      fireEvent.keyDown(window, { key: "k", code: "KeyK", ctrlKey: true });
    });
    const palette = await screen.findByRole("dialog", { name: "Command palette" });
    const values = within(palette)
      .getAllByRole("option")
      .map((option) => option.getAttribute("data-value"));
    expect(values).toContain("action:withdraw");
    expect(values).toContain("page:second");
    expect(values).not.toContain("page:basic");
  });

  it("confirms an irreversible click before the handler runs and records the outcome and audit", async () => {
    const { ledger } = mount("/vault");
    await ready("vault");
    const control = document.querySelector(
      '[data-rex-region="vault/controls"] [data-rex="vault/withdraw"]',
    );
    expect(control).not.toBeNull();
    await click(control as Element);
    const dialog = await waitFor(() =>
      screen.getByRole("alertdialog", { name: "Confirm Withdraw" }),
    );
    expect(dialog.getAttribute("data-rex-confirm")).toBe("vault/withdraw");
    expect(await ledger.list()).toEqual([]);

    const accept = dialog.querySelector('[data-rex-confirm-accept="vault/withdraw"]');
    await click(accept as Element);
    await waitFor(() =>
      expect(
        document.querySelector('[data-rex-outcome="withdraw"][data-rex-outcome-ok="true"]'),
      ).not.toBeNull(),
    );
    expect(screen.getByRole("status", { name: "Outcome" }).textContent).toContain(
      "Withdraw succeeded",
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    const records = await ledger.list();
    expect(records.map((record) => [record.actionId, record.outcome, record.effect])).toEqual([
      ["withdraw", "ok", "irreversible"],
    ]);
    expect(records[0]?.actor).toBe("viewer");
    await waitFor(() =>
      expect(sidecarPayload().outcome).toMatchObject({ action: "withdraw", ok: true }),
    );
  });

  it("resolves data-rex addresses inside region bodies", async () => {
    mount("/vault");
    await ready("vault");
    const section = document.querySelector('[data-rex-region="vault/controls"]');
    expect(section).not.toBeNull();
    expect(within(section as HTMLElement).getByTestId("address").textContent).toBe(
      "vault/controls vault/withdraw",
    );
    expect(section?.querySelector('[data-rex="vault/withdraw"]')).not.toBeNull();
    expect(document.querySelector('main[data-rex-page="vault"]')).not.toBeNull();
  });

  it("applies the stored density preference when the manifest request carried no header", async () => {
    localStorage.setItem(DENSITY_STORAGE_KEY, "agent");
    const { manifestDensity } = mount("/vault");
    await ready("vault");
    expect(manifestDensity()).toBeNull();
    expect(document.documentElement.getAttribute(DENSITY_ATTRIBUTE)).toBe("agent");
  });

  it("uses the default density, comfortable on the root, when nothing is stored and the header is absent", async () => {
    const { manifestDensity } = mount("/vault");
    await ready("vault");
    expect(manifestDensity()).toBeNull();
    expect(document.documentElement.getAttribute(DENSITY_ATTRIBUTE)).toBe("comfortable");
  });
});
