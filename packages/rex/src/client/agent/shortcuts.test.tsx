import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { action, parseShortcut } from "../../core/action.ts";
import { actor } from "../../core/actor.ts";
import { page } from "../../core/page.ts";
import { always, never, policy } from "../../core/policy.ts";
import { createRegistry } from "../../core/registry.ts";
import { boolean, money, text } from "../../schema/index.ts";
import { z } from "zod/mini";
import { buildManifest } from "../../manifest/build.ts";
import { memoryLedger, type Ledger } from "../../server/audit.ts";
import { createRexServer } from "../../server/index.ts";
import { createRexApp, type RexFetch } from "../app.tsx";
import { createOutcomeStore, OutcomeProvider, type OutcomeStore } from "../outcome.ts";
import { definePageModules, view, type PageModuleSet } from "../page.tsx";
import { Shell, ShellOutcome, type OutcomeSlotProps } from "../shell.tsx";
import { ConfirmProvider, PageInvokers } from "./confirm.tsx";
import {
  RexShortcuts,
  SHORTCUT_INPUT,
  eventKeys,
  isModShortcut,
  matchesShortcut,
  shortcutAction,
  type ShortcutEventLike,
} from "./shortcuts.ts";

const wallet = policy("wallet", {
  permissions: ["send"],
  resolve: (subject) => subject.permissions.filter((permission) => permission === "send"),
});

const hideDust = action("hide-dust", {
  input: z.object({ hide: boolean().default(true) }),
  output: z.object({ hide: boolean() }),
  policy: always(),
  effect: "reversible",
  label: "Hide dust",
  shortcut: "alt+h",
  handler: (input) => ({ hide: input.hide }),
});

const send = action("send", {
  input: z.object({ to: text({ min: 1 }).default("bob"), amount: money().default("1") }),
  output: z.object({ txId: text() }),
  policy: wallet.can("send"),
  effect: "irreversible",
  label: "Send",
  shortcut: "mod+enter",
  handler: (input) => ({ txId: `tx-${input.to}-${input.amount}` }),
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
  actions: [hideDust, send, purge],
  states: ["ready"],
});
const about = page("about", { route: "/about", states: ["ready"] });

function Surfaces() {
  return (
    <div>
      <input aria-label="Note" />
      <div aria-modal="true">
        <button type="button">Inside modal</button>
      </div>
      <button type="button">Plain</button>
    </div>
  );
}

function AgentSlot({ page: pageId }: OutcomeSlotProps) {
  return (
    <PageInvokers>
      <ShellOutcome page={pageId} />
      <RexShortcuts />
    </PageInvokers>
  );
}

const pages: readonly PageModuleSet[] = [
  definePageModules({ page: portfolio, view: view(() => <Surfaces />), states: {} }),
  definePageModules({ page: about, view: view(() => <p>About Rex</p>), states: {} }),
];

const registry = createRegistry()
  .register(wallet, hideDust, send, purge, portfolio, about)
  .freeze();
const manifest = buildManifest(registry);
const owner = actor({ id: "owner", permissions: ["send"] });

const plain: ShortcutEventLike = {
  key: "",
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
};

interface Mounted {
  readonly ledger: Ledger;
  readonly store: OutcomeStore;
  readonly memory: ReturnType<typeof memoryLocation>;
}

function mount(path: string): Mounted {
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
      <RexApp>
        <Router hook={memory.hook}>
          <ConfirmProvider>
            <Shell pages={pages} outcome={AgentSlot} />
          </ConfirmProvider>
        </Router>
      </RexApp>
    </OutcomeProvider>,
  );
  return { ledger, store, memory };
}

async function press(
  target: Element | Window,
  init: KeyboardEventInit & { key: string },
): Promise<boolean> {
  let dispatched = true;
  await act(async () => {
    dispatched = fireEvent.keyDown(target, init);
  });
  return dispatched;
}

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

async function audited(ledger: Ledger): Promise<string[]> {
  return (await ledger.list()).map((record) => `${record.actionId}:${record.outcome}`);
}

async function waitAudited(ledger: Ledger, expected: string[]) {
  await waitFor(async () => expect(await audited(ledger)).toEqual(expected));
}

afterEach(() => {
  cleanup();
});

describe("shortcut matching", () => {
  it("normalises event keys with aliases and physical codes", () => {
    expect(eventKeys({ ...plain, key: " " })).toEqual(["space"]);
    expect(eventKeys({ ...plain, key: "Esc" })).toEqual(["escape"]);
    expect(eventKeys({ ...plain, key: "Up" })).toEqual(["arrowup"]);
    expect(eventKeys({ ...plain, key: "ArrowDown" })).toEqual(["arrowdown"]);
    expect(eventKeys({ ...plain, key: "˙", code: "KeyH" })).toEqual(["˙", "h"]);
    expect(eventKeys({ ...plain, key: "#", code: "Digit3" })).toEqual(["#", "3"]);
    expect(eventKeys({ ...plain, key: "H", code: "KeyH" })).toEqual(["h"]);
    expect(eventKeys({ ...plain, key: "Enter", code: "NumpadEnter" })).toEqual(["enter"]);
  });

  it("matches a parsed shortcut only when the modifiers and the key agree", () => {
    const save = parseShortcut("mod+shift+s");
    expect(matchesShortcut({ ...plain, key: "s", ctrlKey: true, shiftKey: true }, save)).toBe(true);
    expect(matchesShortcut({ ...plain, key: "S", metaKey: true, shiftKey: true }, save)).toBe(true);
    expect(matchesShortcut({ ...plain, key: "s", ctrlKey: true }, save)).toBe(false);
    expect(
      matchesShortcut({ ...plain, key: "s", ctrlKey: true, shiftKey: true, altKey: true }, save),
    ).toBe(false);
    expect(matchesShortcut({ ...plain, key: "d", ctrlKey: true, shiftKey: true }, save)).toBe(false);
    expect(matchesShortcut({ ...plain, key: "/" }, parseShortcut("/"))).toBe(true);
    expect(isModShortcut({ ...plain, key: "k", ctrlKey: true }, "k")).toBe(true);
    expect(isModShortcut({ ...plain, key: "k", metaKey: true }, "k")).toBe(true);
    expect(isModShortcut({ ...plain, key: "k", ctrlKey: true, shiftKey: true }, "k")).toBe(false);
    expect(isModShortcut({ ...plain, key: "k", ctrlKey: true, altKey: true }, "k")).toBe(false);
    expect(isModShortcut({ ...plain, key: "k" }, "k")).toBe(false);
  });

  it("picks the first declared action whose shortcut the event matches", () => {
    const actions = [purge, hideDust, send];
    expect(shortcutAction(actions, { ...plain, key: "h", altKey: true })).toBe(hideDust);
    expect(shortcutAction(actions, { ...plain, key: "Enter", metaKey: true })).toBe(send);
    expect(shortcutAction(actions, { ...plain, key: "h" })).toBeNull();
    expect(shortcutAction(actions, { ...plain, key: "p" })).toBeNull();
    expect(shortcutAction([], { ...plain, key: "h", altKey: true })).toBeNull();
    expect(SHORTCUT_INPUT).toEqual({});
    expect(Object.isFrozen(SHORTCUT_INPUT)).toBe(true);
  });
});

describe("useShortcuts", () => {
  it("invokes the bound page action and prevents the default only for the chord", async () => {
    const { ledger, store } = mount("/");
    expect(await press(window, { key: "x", code: "KeyX", altKey: true })).toBe(true);
    expect(await press(window, { key: "h", code: "KeyH", altKey: true })).toBe(false);
    await waitFor(() => expect(store.get("portfolio")).toMatchObject({ actionId: "hide-dust", ok: true }));
    expect(await audited(ledger)).toEqual(["hide-dust:ok"]);
  });

  it("ignores repeated, already handled and modal-scoped key events", async () => {
    const { ledger } = mount("/");
    const chord = { key: "h", code: "KeyH", altKey: true };
    expect(await press(window, { ...chord, repeat: true })).toBe(true);
    const swallow = (event: KeyboardEvent) => {
      event.preventDefault();
    };
    window.addEventListener("keydown", swallow, { capture: true });
    try {
      await press(screen.getByRole("button", { name: "Plain" }), chord);
    } finally {
      window.removeEventListener("keydown", swallow, { capture: true });
    }
    expect(await press(screen.getByRole("button", { name: "Inside modal" }), chord)).toBe(true);
    expect(await press(screen.getByRole("button", { name: "Plain" }), chord)).toBe(false);
    await waitAudited(ledger, ["hide-dust:ok"]);
  });

  it("leaves alt chords to editable fields but honours mod chords there", async () => {
    const { ledger } = mount("/");
    const note = screen.getByLabelText("Note");
    note.focus();
    expect(await press(note, { key: "h", code: "KeyH", altKey: true })).toBe(true);
    expect(await press(note, { key: "Enter", ctrlKey: true })).toBe(false);
    const dialog = await screen.findByRole("alertdialog", { name: "Confirm Send" });
    await click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(await press(screen.getByRole("button", { name: "Plain" }), { key: "h", code: "KeyH", altKey: true })).toBe(false);
    await waitAudited(ledger, ["hide-dust:ok"]);
  });

  it("binds the shortcuts of the active page only", async () => {
    const { ledger, memory } = mount("/");
    await act(async () => {
      memory.navigate("/about");
    });
    expect(screen.getByText("About Rex")).toBeTruthy();
    expect(await press(window, { key: "h", code: "KeyH", altKey: true })).toBe(true);
    await act(async () => {
      memory.navigate("/");
    });
    expect(await press(window, { key: "h", code: "KeyH", altKey: true })).toBe(false);
    await waitAudited(ledger, ["hide-dust:ok"]);
  });

  it("throws REX306 outside PageInvokers", () => {
    const original = console.error;
    console.error = () => {};
    try {
      expect(() => render(<RexShortcuts />)).toThrow(
        "REX306 rex: palette, shortcuts and URL invocation must render inside PageInvokers",
      );
    } finally {
      console.error = original;
    }
  });
});
