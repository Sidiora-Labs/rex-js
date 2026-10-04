import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useMemo } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { action, parseShortcut, RESERVED_SHORTCUTS } from "../../core/action.ts";
import { actor } from "../../core/actor.ts";
import { page } from "../../core/page.ts";
import { always, never } from "../../core/policy.ts";
import { createRegistry } from "../../core/registry.ts";
import { boolean, text } from "../../schema/index.ts";
import { z } from "zod/mini";
import { buildManifest } from "../../manifest/build.ts";
import { memoryLedger, type Ledger } from "../../server/audit.ts";
import { createRexServer } from "../../server/index.ts";
import { createRexApp, type RexFetch } from "../app.tsx";
import { createOutcomeStore, OutcomeProvider, type OutcomeStore } from "../outcome.ts";
import { definePageModules, view, type PageModuleSet } from "../page.tsx";
import { paletteTrigger, Shell, ShellOutcome, type OutcomeSlotProps } from "../shell.tsx";
import { ConfirmProvider, PageInvokers } from "./confirm.tsx";
import {
  PALETTE_INPUT,
  PALETTE_LABEL,
  PALETTE_SHORTCUT,
  paletteValue,
  RexPalette,
} from "./palette.tsx";
import {
  AffordanceRegistryProvider,
  createAffordanceRegistry,
  useRegisterAffordances,
  type Affordance,
} from "./sidecar.tsx";

const hideDust = action("hide-dust", {
  input: z.object({ hide: boolean().default(true) }),
  output: z.object({ hide: boolean() }),
  policy: always(),
  effect: "reversible",
  label: "Hide dust",
  shortcut: "alt+h",
  handler: (input) => ({ hide: input.hide }),
});

const rename = action("rename", {
  input: z.object({ name: text({ min: 1 }) }),
  output: z.object({ name: text() }),
  policy: always(),
  effect: "reversible",
  label: "Rename",
  handler: (input) => ({ name: input.name }),
});

const purge = action("purge", {
  input: z.object({}),
  output: z.object({}),
  policy: never(),
  effect: "reversible",
  label: "Purge",
  handler: () => ({}),
});

const portfolio = page("portfolio", {
  route: "/",
  actions: [hideDust, rename, purge],
  states: ["ready"],
});
const about = page("about", { route: "/about", states: ["ready"] });

const invoked: string[] = [];

function affordance(
  id: string,
  label: string,
  effect: Affordance["effect"],
  allowed: boolean,
  reason: string | null,
): Affordance {
  return {
    id,
    label,
    allowed,
    reason,
    effect,
    input: { type: "object", properties: {}, additionalProperties: false },
    via: ["click", "palette"],
    invoke: async (input) => {
      invoked.push(`${id}:${JSON.stringify(input)}`);
      return null;
    },
  };
}

function Portfolio() {
  const entries = useMemo(
    () => [
      affordance("archive-all", "Archive everything", "reversible", true, null),
      affordance("wipe", "Wipe everything", "irreversible", true, null),
      affordance("locked", "Locked affordance", "reversible", false, "locked"),
    ],
    [],
  );
  useRegisterAffordances("portfolio", entries);
  return <button type="button">Focus me</button>;
}

function ClosedSlot({ page: pageId }: OutcomeSlotProps) {
  return (
    <PageInvokers>
      <ShellOutcome page={pageId} />
      <RexPalette />
    </PageInvokers>
  );
}

function OpenSlot({ page: pageId }: OutcomeSlotProps) {
  return (
    <PageInvokers>
      <ShellOutcome page={pageId} />
      <RexPalette defaultOpen />
    </PageInvokers>
  );
}

const pages: readonly PageModuleSet[] = [
  definePageModules({ page: portfolio, view: view(() => <Portfolio />), states: {} }),
  definePageModules({ page: about, view: view(() => <p>About Rex</p>), states: {} }),
];

const registry = createRegistry().register(hideDust, rename, purge, portfolio, about).freeze();
const manifest = buildManifest(registry);
const owner = actor({ id: "owner" });

interface Mounted {
  readonly ledger: Ledger;
  readonly store: OutcomeStore;
  readonly memory: ReturnType<typeof memoryLocation>;
}

function mount(path: string, options: { readonly open?: boolean } = {}): Mounted {
  const ledger = memoryLedger();
  const server = createRexServer({ registry, ledger, actor: () => owner });
  const fetch: RexFetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    if (request.method !== "GET" && !request.headers.has("origin")) {
      request.headers.set("origin", new URL(request.url).origin);
    }
    return server.fetch(request);
  };
  const RexApp = createRexApp({
    registry,
    manifest,
    actor: owner,
    fetch,
    baseUrl: "http://rex.test",
  });
  const store = createOutcomeStore();
  const memory = memoryLocation({ path, record: true });
  render(
    <OutcomeProvider store={store}>
      <AffordanceRegistryProvider registry={createAffordanceRegistry()}>
        <RexApp>
          <Router hook={memory.hook}>
            <ConfirmProvider>
              <Shell pages={pages} outcome={options.open === true ? OpenSlot : ClosedSlot} />
            </ConfirmProvider>
          </Router>
        </RexApp>
      </AffordanceRegistryProvider>
    </OutcomeProvider>,
  );
  return { ledger, store, memory };
}

async function press(target: Element | Window, init: KeyboardEventInit & { key: string }) {
  await act(async () => {
    fireEvent.keyDown(target, init);
  });
}

async function openPalette(): Promise<HTMLElement> {
  await press(window, { key: "k", code: "KeyK", ctrlKey: true });
  return screen.findByRole("dialog", { name: PALETTE_LABEL });
}

function palette(): HTMLElement | null {
  return screen.queryByRole("dialog", { name: PALETTE_LABEL });
}

function options(dialog: HTMLElement): string[] {
  return within(dialog)
    .getAllByRole("option")
    .map((option) => option.getAttribute("data-value") ?? "");
}

async function search(dialog: HTMLElement, value: string) {
  await act(async () => {
    fireEvent.change(within(dialog).getByRole("combobox"), { target: { value } });
  });
}

async function enter(dialog: HTMLElement) {
  await act(async () => {
    fireEvent.keyDown(within(dialog).getByRole("combobox"), { key: "Enter" });
  });
}

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

async function audited(ledger: Ledger): Promise<string[]> {
  return (await ledger.list()).map((record) => `${record.actionId}:${record.outcome}`);
}

beforeEach(() => {
  invoked.length = 0;
});

afterEach(() => {
  cleanup();
});

describe("palette constants", () => {
  it("names the palette and its reserved chord the way the shell trigger uses them", () => {
    expect(PALETTE_LABEL).toBe("Command palette");
    expect(parseShortcut(PALETTE_SHORTCUT)).toEqual({ mod: true, shift: false, alt: false, key: "k" });
    expect(RESERVED_SHORTCUTS).toContain(PALETTE_SHORTCUT);
    expect(paletteTrigger()).toMatchObject({ label: PALETTE_LABEL, shortcut: PALETTE_SHORTCUT });
    expect(paletteValue("action", "send")).toBe("action:send");
    expect(paletteValue("page", "about")).toBe("page:about");
    expect(Object.isFrozen(PALETTE_INPUT)).toBe(true);
    expect(Object.keys(PALETTE_INPUT)).toEqual([]);
  });
});

describe("RexPalette", () => {
  it("opens at once with defaultOpen and lists declared actions before registered affordances", async () => {
    mount("/", { open: true });
    const dialog = await screen.findByRole("dialog", { name: PALETTE_LABEL });
    expect(options(dialog)).toEqual([
      "action:hide-dust",
      "action:rename",
      "action:purge",
      "action:archive-all",
      "action:locked",
      "action:wipe",
      "page:about",
      "page:portfolio",
    ]);
    const entries = within(dialog).getAllByRole("option");
    expect(entries[0]?.textContent).toContain("alt+h");
    expect(entries[2]?.getAttribute("aria-disabled")).toBe("true");
    expect(entries[2]?.textContent).toContain("Not allowed: never");
    expect(entries[4]?.getAttribute("aria-disabled")).toBe("true");
    expect(entries[4]?.getAttribute("data-rex-allowed")).toBe("false");
    expect(entries[4]?.textContent).toContain("Not allowed: locked");
    expect(entries[5]?.getAttribute("data-rex-palette-item")).toBe("portfolio/wipe");
  });

  it("toggles with mod+k, ignores handled key events, closes on Escape and restores focus", async () => {
    mount("/");
    const opener = screen.getByRole("button", { name: "Focus me" });
    opener.focus();
    const swallow = (event: KeyboardEvent) => {
      event.preventDefault();
    };
    window.addEventListener("keydown", swallow, { capture: true });
    try {
      await press(opener, { key: "k", code: "KeyK", ctrlKey: true });
    } finally {
      window.removeEventListener("keydown", swallow, { capture: true });
    }
    expect(palette()).toBeNull();
    await press(opener, { key: "k", code: "KeyK", metaKey: true });
    const dialog = await screen.findByRole("dialog", { name: PALETTE_LABEL });
    expect(document.activeElement).toBe(within(dialog).getByRole("combobox"));
    await press(within(dialog).getByRole("combobox"), { key: "Escape" });
    expect(palette()).toBeNull();
    expect(document.activeElement).toBe(opener);
    await openPalette();
    await press(window, { key: "k", code: "KeyK", ctrlKey: true });
    expect(palette()).toBeNull();
  });

  it("records a validation outcome for an action whose input the palette cannot supply", async () => {
    const { store, ledger } = mount("/");
    const dialog = await openPalette();
    await search(dialog, "rename");
    await enter(dialog);
    expect(palette()).toBeNull();
    await waitFor(() =>
      expect(store.get("portfolio")).toMatchObject({ actionId: "rename", ok: false }),
    );
    expect(store.get("portfolio")?.message).toMatch(/^Rename: invalid input: name /);
    expect(await audited(ledger)).toEqual([]);
  });

  it("invokes a registered affordance directly and confirms an irreversible one first", async () => {
    mount("/");
    let dialog = await openPalette();
    await search(dialog, "archive");
    await enter(dialog);
    await waitFor(() => expect(invoked).toEqual(["archive-all:{}"]));
    dialog = await openPalette();
    await search(dialog, "wipe");
    await enter(dialog);
    const confirm = await screen.findByRole("alertdialog", { name: "Confirm Wipe everything" });
    expect(confirm.getAttribute("data-rex-confirm")).toBe("portfolio/wipe");
    await click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(invoked).toEqual(["archive-all:{}"]);
    dialog = await openPalette();
    await search(dialog, "wipe");
    await enter(dialog);
    const again = await screen.findByRole("alertdialog", { name: "Confirm Wipe everything" });
    await click(within(again).getByRole("button", { name: "Confirm Wipe everything" }));
    await waitFor(() => expect(invoked).toEqual(["archive-all:{}", "wipe:{}"]));
    dialog = await openPalette();
    await search(dialog, "locked");
    await enter(dialog);
    expect(palette()).toBe(dialog);
    expect(invoked).toHaveLength(2);
  });

  it("navigates to a page entry", async () => {
    const { memory } = mount("/");
    const dialog = await openPalette();
    await search(dialog, "About");
    await enter(dialog);
    expect(memory.history.at(-1)).toBe("/about");
    expect(screen.getByText("About Rex")).toBeTruthy();
    expect(palette()).toBeNull();
  });

  it("throws REX306 when rendered outside PageInvokers", () => {
    const original = console.error;
    console.error = () => {};
    try {
      expect(() => render(<RexPalette />)).toThrow(
        "REX306 rex: palette, shortcuts and URL invocation must render inside PageInvokers",
      );
    } finally {
      console.error = original;
    }
  });
});
