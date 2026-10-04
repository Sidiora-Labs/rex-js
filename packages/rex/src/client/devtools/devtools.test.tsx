import { QueryClient, useQuery } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { action } from "../../core/action.ts";
import { actor } from "../../core/actor.ts";
import { regionAddress } from "../../core/ids.ts";
import { page } from "../../core/page.ts";
import { always } from "../../core/policy.ts";
import { createRegistry } from "../../core/registry.ts";
import { text, z } from "../../core/schema.ts";
import { buildManifest } from "../../manifest/build.ts";
import { memoryLedger, type Ledger } from "../../server/audit.ts";
import { createRexServer } from "../../server/index.ts";
import { DEV_AUDIT_PATH } from "../../server/routes/dev.ts";
import { readSidecar } from "../agent/sidecar.tsx";
import { createRexEntry, type RexFetch } from "../app.tsx";
import { defaultOutcomeStore } from "../outcome.ts";
import { definePageModules, region, view, type PageModuleSet } from "../page.tsx";
import { REX_PROVIDERS } from "../providers.ts";
import { SHELL_SLOTS } from "../shell/slots.ts";
import {
  DEVTOOLS_AUDIT_PATH,
  DEVTOOLS_PANELS,
  DEVTOOLS_PANEL_TITLES,
  DEVTOOLS_TITLE,
  createDevtoolsStore,
  type DevtoolsPanel,
} from "./index.ts";

const ping = action("ping", {
  input: z.object({ note: text() }),
  output: z.object({ echo: text() }),
  policy: always(),
  effect: "reversible",
  label: "Ping",
  handler: (input) => ({ echo: `pong ${input.note}` }),
});

const notes = action("notes", {
  input: z.object({ topic: text() }),
  output: z.object({ items: z.array(text()) }),
  policy: always(),
  effect: "read",
  handler: (input) => ({ items: [`about ${input.topic}`] }),
});

const lab = page("lab", {
  route: "/lab/:topic",
  params: z.object({ topic: text({ min: 1 }) }),
  actions: [ping],
  regions: ["controls"],
  load: { notes },
  chrome: { title: "Lab" },
  states: ["ready"],
});

const home = page("home", { route: "/", chrome: { title: "Home" }, states: ["ready"] });

interface LabParams {
  readonly topic: string;
}

const LabControls = region<LabParams>("controls", ({ act: useAction, params }) => {
  const handle = useAction(ping);
  const [bumps, setBumps] = useState(0);
  const findings = useQuery({
    queryKey: ["lab", params.topic],
    queryFn: () => ({ topic: params.topic, findings: ["first finding"] }),
  });
  return (
    <div>
      <p>Findings: {findings.data?.findings.join(", ") ?? "none"}</p>
      <p>Bumps: {bumps}</p>
      <button type="button" onClick={() => setBumps((count) => count + 1)}>
        Bump
      </button>
      <button
        type="button"
        {...handle.controlProps}
        onClick={() => {
          void handle.run({ note: params.topic });
        }}
      >
        Ping
      </button>
    </div>
  );
});

const pages: readonly PageModuleSet[] = [
  definePageModules({ page: home, view: view(() => <p>Home body</p>), states: {} }),
  definePageModules({
    page: lab,
    view: view(() => <LabControls />),
    states: {},
    regions: { controls: LabControls },
  }),
];

const registry = createRegistry().register(ping, notes, home, lab).freeze();
const manifest = buildManifest(registry);
const viewer = actor({ id: "viewer", permissions: ["view"] });
const CONTROLS = regionAddress("lab", "controls");

const originalFetch = globalThis.fetch;

interface Mounted {
  readonly ledger: Ledger;
}

function mount(path: string): Mounted {
  const ledger = memoryLedger();
  const server = createRexServer({ registry, ledger, actor: () => viewer, dev: true });
  const fetch: RexFetch = async (input, init) =>
    server.fetch(input instanceof Request ? input : new Request(input, init));
  globalThis.fetch = fetch as typeof globalThis.fetch;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  window.history.replaceState(null, "", path);
  const RexEntry = createRexEntry(
    { registry, manifest, pages },
    { fetch, baseUrl: "http://rex.test", queryClient },
  );
  render(<RexEntry />);
  return { ledger };
}

async function ready(): Promise<void> {
  await waitFor(() => expect(screen.getByText("Findings: first finding")).toBeDefined());
}

function devtools(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-rex-devtools]");
}

async function press(init: KeyboardEventInit): Promise<void> {
  await act(async () => {
    fireEvent.keyDown(window, init);
  });
}

async function openDevtools(): Promise<HTMLElement> {
  await press({ key: "D", code: "KeyD", ctrlKey: true, shiftKey: true });
  const frame = devtools();
  if (frame === null) throw new Error("the devtools did not open");
  return frame;
}

async function showPanel(panel: DevtoolsPanel): Promise<HTMLElement> {
  const frame = devtools() ?? (await openDevtools());
  await act(async () => {
    fireEvent.click(within(frame).getByRole("tab", { name: DEVTOOLS_PANEL_TITLES[panel] }));
  });
  const shown = frame.querySelector<HTMLElement>(`[data-rex-devtools-panel="${panel}"]`);
  if (shown === null) throw new Error(`the ${panel} panel is not shown`);
  return shown;
}

async function click(name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  for (const key of ["lab", "home", "app"]) defaultOutcomeStore.clear(key);
  window.history.replaceState(null, "", "/");
});

describe("RexDevtools registration", () => {
  it("registers the devtools provider and shell slot in dev mode with devtools enabled", () => {
    expect(import.meta.env.DEV).toBe(true);
    expect(import.meta.env.REX_DEVTOOLS).toBeUndefined();
    expect(REX_PROVIDERS.map((entry) => entry.id)).toEqual(["confirm", "devtools"]);
    expect(SHELL_SLOTS.map((entry) => entry.id)).toContain("devtools");
    expect(DEVTOOLS_AUDIT_PATH).toBe(DEV_AUDIT_PATH);
  });

  it("toggles the overlay with shift+mod+d and ignores other chords", async () => {
    mount("/lab/alpha");
    await ready();
    expect(devtools()).toBeNull();

    await press({ key: "d", code: "KeyD", ctrlKey: true });
    expect(devtools()).toBeNull();
    await press({ key: "d", code: "KeyD", shiftKey: true });
    expect(devtools()).toBeNull();

    const frame = await openDevtools();
    expect(frame.getAttribute("aria-label")).toBe(DEVTOOLS_TITLE);
    expect(within(frame).getAllByRole("tab").map((tab) => tab.textContent)).toEqual(
      DEVTOOLS_PANELS.map((panel) => DEVTOOLS_PANEL_TITLES[panel]),
    );

    await press({ key: "D", code: "KeyD", metaKey: true, shiftKey: true });
    expect(devtools()).toBeNull();

    await openDevtools();
    await click("Close devtools");
    expect(devtools()).toBeNull();
  });
});

describe("RexDevtools panels", () => {
  it("shows the manifest served by the app", async () => {
    mount("/lab/alpha");
    await ready();
    const panel = await showPanel("manifest");
    expect(panel.textContent).toContain(manifest.pages.map((entry) => entry.id).join(", "));
    expect(panel.textContent).toContain(manifest.actions.map((entry) => entry.id).join(", "));
    const shown = JSON.parse(panel.querySelector("pre")?.textContent ?? "null") as unknown;
    expect(shown).toEqual(JSON.parse(JSON.stringify(manifest)));
  });

  it("shows the current page params, data state and loaders", async () => {
    mount("/lab/alpha");
    await ready();
    const panel = await showPanel("page");
    expect(panel.textContent).toContain("/lab/:topic");
    expect(panel.querySelector("[data-rex-devtools-state]")?.textContent).toBe("ready");
    expect(JSON.parse(panel.querySelector("[data-rex-devtools-params]")?.textContent ?? "")).toEqual(
      { topic: "alpha" },
    );
    const loader = panel.querySelector('[data-rex-devtools-loader="notes"]');
    expect(loader?.textContent).toContain("notes");
    expect(loader?.textContent).toContain("not loaded");
  });

  it("shows the live sidecar JSON", async () => {
    mount("/lab/alpha");
    await ready();
    const panel = await showPanel("sidecar");
    expect(JSON.parse(panel.textContent ?? "")).toEqual(readSidecar(document));

    await click("Ping");
    await waitFor(() =>
      expect(JSON.parse(panel.textContent ?? "")).toMatchObject({
        page: "lab",
        outcome: { action: "ping", ok: true },
      }),
    );
    expect(JSON.parse(panel.textContent ?? "")).toEqual(readSidecar(document));
  });

  it("logs every outcome in order", async () => {
    mount("/lab/alpha");
    await ready();
    const panel = await showPanel("outcomes");
    expect(panel.textContent).toContain("No outcomes yet.");

    await click("Ping");
    await waitFor(() =>
      expect(panel.querySelectorAll('[data-rex-devtools-outcome="ping"]')).toHaveLength(1),
    );
    await click("Ping");
    await waitFor(() =>
      expect(panel.querySelectorAll('[data-rex-devtools-outcome="ping"]')).toHaveLength(2),
    );
    expect(panel.textContent).toContain("lab ping ok: Ping succeeded");
  });

  it("shows the QueryClient cache", async () => {
    mount("/lab/alpha");
    await ready();
    const panel = await showPanel("queries");
    const entry = panel.querySelector(`[data-rex-devtools-query='["lab","alpha"]']`);
    expect(entry?.textContent).toContain("success");
    expect(JSON.parse(entry?.querySelector("pre")?.textContent ?? "")).toEqual({
      topic: "alpha",
      findings: ["first finding"],
    });
  });

  it("shows per-region render durations measured by the Profiler", async () => {
    mount("/lab/alpha");
    await ready();
    const panel = await showPanel("renders");
    const row = () => panel.querySelector(`[data-rex-devtools-render="${CONTROLS}"]`);
    await waitFor(() => expect(row()).not.toBeNull());
    const commits = () => Number(row()?.children[1]?.textContent);
    const before = commits();
    expect(before).toBeGreaterThanOrEqual(1);
    expect(row()?.children[2]?.textContent).toMatch(/^\d+\.\d{2} ms$/);

    await click("Bump");
    await waitFor(() => expect(screen.getByText("Bumps: 1")).toBeDefined());
    await waitFor(() => expect(commits()).toBe(before + 1));
    await click("Bump");
    await waitFor(() => expect(commits()).toBe(before + 2));
  });

  it("shows the audit tail from the dev server", async () => {
    const { ledger } = mount("/lab/alpha");
    await ready();
    await click("Ping");
    await waitFor(async () => expect(await ledger.list()).toHaveLength(1));
    const [record] = await ledger.list();

    const panel = await showPanel("audit");
    await waitFor(() =>
      expect(panel.querySelector(`[data-rex-devtools-audit="${record?.id}"]`)).not.toBeNull(),
    );
    const shown = panel.querySelector(`[data-rex-devtools-audit="${record?.id}"]`);
    expect(shown?.textContent).toContain("viewer ping reversible ok");

    await click("Ping");
    await waitFor(async () => expect(await ledger.list()).toHaveLength(2));
    await click("Refresh audit");
    await waitFor(() => expect(panel.querySelectorAll("[data-rex-devtools-audit]")).toHaveLength(2));
  });
});

describe("the devtools store", () => {
  it("rejects unknown panels and keeps render statistics per region", async () => {
    const store = createDevtoolsStore();
    expect(() => store.showPanel("network" as DevtoolsPanel)).toThrow(/unknown panel/);
    store.recordRenders([
      { address: "b.main", durationMs: 2 },
      { address: "a.main", durationMs: 1 },
    ]);
    store.recordRenders([{ address: "a.main", durationMs: 3 }]);
    await Promise.resolve();
    expect(store.snapshot().renders).toEqual([
      { address: "a.main", commits: 2, lastMs: 3, totalMs: 4, maxMs: 3 },
      { address: "b.main", commits: 1, lastMs: 2, totalMs: 2, maxMs: 2 },
    ]);
  });
});

describe("GET /rex/dev/audit", () => {
  async function seeded(dev: boolean | undefined) {
    const ledger = memoryLedger();
    for (const [index, at] of ["2026-10-01T00:00:00.000Z", "2026-10-02T00:00:00.000Z"].entries()) {
      await ledger.append({
        actor: "viewer",
        actionId: "ping",
        inputDigest: String(index).repeat(64),
        outcome: "ok",
        effect: "reversible",
        durationMs: 1,
        at,
      });
    }
    const options = { registry, ledger, actor: () => viewer };
    const server = createRexServer(dev === undefined ? options : { ...options, dev });
    return { ledger, server };
  }

  it("serves the audit tail only in dev mode", async () => {
    const { server } = await seeded(true);
    const response = await server.fetch(new Request(`http://rex.test${DEV_AUDIT_PATH}`));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { records: { at: string }[] };
    expect(body.records.map((record) => record.at)).toEqual([
      "2026-10-01T00:00:00.000Z",
      "2026-10-02T00:00:00.000Z",
    ]);

    const tail = await server.fetch(new Request(`http://rex.test${DEV_AUDIT_PATH}?limit=1`));
    const last = (await tail.json()) as { records: { at: string }[] };
    expect(last.records.map((record) => record.at)).toEqual(["2026-10-02T00:00:00.000Z"]);

    const invalid = await server.fetch(new Request(`http://rex.test${DEV_AUDIT_PATH}?limit=0`));
    expect(invalid.status).toBe(400);

    const production = (await seeded(false)).server;
    expect(
      (await production.fetch(new Request(`http://rex.test${DEV_AUDIT_PATH}`))).status,
    ).toBe(404);
    expect(process.env.NODE_ENV).not.toBe("development");
    const unset = (await seeded(undefined)).server;
    expect((await unset.fetch(new Request(`http://rex.test${DEV_AUDIT_PATH}`))).status).toBe(404);
  });
});
