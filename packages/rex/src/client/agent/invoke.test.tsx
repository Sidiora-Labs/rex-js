import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
import { memoryLedger, type Ledger } from "../../server/audit.ts";
import { createRexServer } from "../../server/index.ts";
import { createRexApp, type RexFetch } from "../app.tsx";
import { createOutcomeStore, OutcomeProvider, type OutcomeStore } from "../outcome.ts";
import { definePageModules, view, type PageModuleSet } from "../page.tsx";
import { Shell, ShellOutcome, type OutcomeSlotProps } from "../shell.tsx";
import { ConfirmProvider, PageInvokers, useInvoke } from "./confirm.tsx";
import { RexPalette } from "./palette.tsx";
import { RexShortcuts, matchesShortcut } from "./shortcuts.ts";
import { RexUrlInvoke, parseUrlInvocation, withoutInvocation } from "./url-invoke.ts";
import { parseShortcut } from "../../core/action.ts";

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

function Controls() {
  const hide = useInvoke(hideDust);
  const sending = useInvoke(send);
  return (
    <div>
      <button type="button" {...hide.controlProps} onClick={() => void hide.invoke({ hide: true })}>
        Hide dust
      </button>
      <button type="button" {...sending.controlProps} onClick={() => void sending.invoke({})}>
        Send
      </button>
    </div>
  );
}

const pages: readonly PageModuleSet[] = [
  definePageModules({ page: portfolio, view: view(() => <Controls />), states: {} }),
  definePageModules({ page: about, view: view(() => <p>About Rex</p>), states: {} }),
];

const registry = createRegistry()
  .register(wallet, hideDust, send, purge, portfolio, about)
  .freeze();
const manifest = buildManifest(registry);
const owner = actor({ id: "owner", permissions: ["send"] });

function AgentSlot({ page: pageId }: OutcomeSlotProps) {
  return (
    <PageInvokers>
      <ShellOutcome page={pageId} />
      <RexPalette />
      <RexShortcuts />
      <RexUrlInvoke />
    </PageInvokers>
  );
}

interface Mounted {
  readonly ledger: Ledger;
  readonly store: OutcomeStore;
  readonly memory: ReturnType<typeof memoryLocation>;
}

function mount(path: string): Mounted {
  const ledger = memoryLedger();
  const server = createRexServer({ registry, ledger, actor: () => owner });
  const fetch: RexFetch = async (input, init) =>
    server.fetch(input instanceof Request ? input : new Request(input, init));
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

async function audited(ledger: Ledger): Promise<string[]> {
  return (await ledger.list()).map((record) => `${record.actionId}:${record.outcome}`);
}

async function press(init: KeyboardEventInit & { key: string }) {
  await act(async () => {
    fireEvent.keyDown(window, init);
  });
}

async function openPalette(): Promise<HTMLElement> {
  await press({ key: "k", code: "KeyK", ctrlKey: true });
  return screen.getByRole("dialog", { name: "Command palette" });
}

async function search(palette: HTMLElement, value: string) {
  await act(async () => {
    fireEvent.change(within(palette).getByRole("combobox"), { target: { value } });
  });
}

async function enter(palette: HTMLElement) {
  await act(async () => {
    fireEvent.keyDown(within(palette).getByRole("combobox"), { key: "Enter" });
  });
}

async function waitOutcome(store: OutcomeStore, actionId: string, ok: boolean) {
  await waitFor(() => expect(store.get("portfolio")).toMatchObject({ actionId, ok }));
}

async function confirmDialog(): Promise<HTMLElement> {
  return waitFor(() => screen.getByRole("alertdialog", { name: "Confirm Send" }));
}

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

afterEach(() => {
  cleanup();
});

describe("command palette", () => {
  it("opens on mod+k and lists the page actions with allowed state and the navigable pages", async () => {
    mount("/");
    expect(screen.queryByRole("dialog", { name: "Command palette" })).toBeNull();
    const palette = await openPalette();
    const options = within(palette).getAllByRole("option");
    expect(options.map((option) => option.getAttribute("data-value"))).toEqual([
      "action:hide-dust",
      "action:send",
      "action:purge",
      "page:about",
      "page:portfolio",
    ]);
    const purgeOption = options[2] as HTMLElement;
    expect(purgeOption.getAttribute("aria-disabled")).toBe("true");
    expect(purgeOption.getAttribute("data-rex-allowed")).toBe("false");
    expect(purgeOption.textContent).toContain("Not allowed: never");
    expect(options[0]?.getAttribute("data-rex-allowed")).toBe("true");
    expect(options[0]?.textContent).toContain("alt+h");
    expect(palette.querySelector("[data-rex]")).toBeNull();
    await press({ key: "k", code: "KeyK", metaKey: true });
    expect(screen.queryByRole("dialog", { name: "Command palette" })).toBeNull();
  });

  it("filters by id and label and executes or navigates on enter", async () => {
    const { store, ledger, memory } = mount("/");
    let palette = await openPalette();
    await search(palette, "hide-dust");
    expect(
      within(palette)
        .getAllByRole("option")
        .map((o) => o.getAttribute("data-value")),
    ).toEqual(["action:hide-dust"]);
    await enter(palette);
    expect(screen.queryByRole("dialog", { name: "Command palette" })).toBeNull();
    await waitOutcome(store, "hide-dust", true);
    expect(await audited(ledger)).toEqual(["hide-dust:ok"]);

    palette = await openPalette();
    await search(palette, "About");
    expect(
      within(palette)
        .getAllByRole("option")
        .map((o) => o.getAttribute("data-value")),
    ).toEqual(["page:about"]);
    await enter(palette);
    expect(memory.history.at(-1)).toBe("/about");
    expect(screen.getByText("About Rex")).toBeTruthy();
  });

  it("does not execute a disallowed action", async () => {
    const { store, ledger } = mount("/");
    const palette = await openPalette();
    await search(palette, "Purge");
    const option = within(palette).getByRole("option");
    expect(option.getAttribute("aria-disabled")).toBe("true");
    await click(option);
    await enter(palette);
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeTruthy();
    expect(store.get("portfolio")).toBeNull();
    expect(await audited(ledger)).toEqual([]);
  });
});

describe("shortcuts", () => {
  it("parses and matches declared shortcuts exactly", () => {
    const altH = parseShortcut("alt+h");
    expect(
      matchesShortcut(
        { key: "˙", code: "KeyH", altKey: true, ctrlKey: false, metaKey: false, shiftKey: false },
        altH,
      ),
    ).toBe(true);
    expect(
      matchesShortcut(
        { key: "h", altKey: false, ctrlKey: false, metaKey: false, shiftKey: false },
        altH,
      ),
    ).toBe(false);
    const modEnter = parseShortcut("mod+enter");
    expect(
      matchesShortcut(
        { key: "Enter", altKey: false, ctrlKey: false, metaKey: true, shiftKey: false },
        modEnter,
      ),
    ).toBe(true);
    expect(
      matchesShortcut(
        { key: "Enter", altKey: false, ctrlKey: true, metaKey: false, shiftKey: true },
        modEnter,
      ),
    ).toBe(false);
  });

  it("invokes the active page action bound to its shortcut", async () => {
    const { store, ledger } = mount("/");
    await press({ key: "h", code: "KeyH", altKey: true });
    await waitOutcome(store, "hide-dust", true);
    expect(await audited(ledger)).toEqual(["hide-dust:ok"]);
  });

  it("binds shortcuts only while their page is active", async () => {
    const { store, ledger } = mount("/about");
    await press({ key: "h", code: "KeyH", altKey: true });
    expect(store.get("portfolio")).toBeNull();
    expect(store.get("about")).toBeNull();
    expect(await audited(ledger)).toEqual([]);
  });
});

describe("URL invocation", () => {
  it("parses the act and input parameters", () => {
    expect(parseUrlInvocation("act=send&input=%7B%22to%22%3A%22x%22%7D")).toEqual({
      ok: true,
      action: "send",
      input: { to: "x" },
    });
    expect(parseUrlInvocation("act=send")).toEqual({ ok: true, action: "send", input: {} });
    expect(parseUrlInvocation("act=send&input=nope")).toMatchObject({ ok: false, action: "send" });
    expect(parseUrlInvocation("tab=1")).toBeNull();
    expect(withoutInvocation("tab=1&act=send&input=%7B%7D")).toBe("tab=1");
  });

  it("invokes the action with valid input on page mount and clears the URL", async () => {
    const input = encodeURIComponent(JSON.stringify({ hide: false }));
    const { store, ledger, memory } = mount(`/?act=hide-dust&input=${input}`);
    await waitOutcome(store, "hide-dust", true);
    expect(await audited(ledger)).toEqual(["hide-dust:ok"]);
    expect(memory.history.at(-1)).toBe("/");
  });

  it("writes a validation outcome for input that fails the schema", async () => {
    const input = encodeURIComponent(JSON.stringify({ hide: "yes" }));
    const { store, ledger } = mount(`/?act=hide-dust&input=${input}`);
    await waitOutcome(store, "hide-dust", false);
    expect(store.get("portfolio")?.message).toMatch(/^Hide dust: invalid input: hide /);
    expect(await audited(ledger)).toEqual([]);
  });

  it("writes a validation outcome for input that is not JSON and for an unknown action", async () => {
    const first = mount("/?act=hide-dust&input=nope");
    await waitOutcome(first.store, "hide-dust", false);
    expect(first.store.get("portfolio")?.message).toBe(
      "Hide dust: invalid input: the input parameter is not valid JSON",
    );
    cleanup();
    const second = mount("/?act=nope");
    await waitOutcome(second.store, "nope", false);
    expect(second.store.get("portfolio")?.message).toBe(
      'page "portfolio" declares no action "nope"',
    );
    expect(await audited(second.ledger)).toEqual([]);
  });
});

describe("confirmation for irreversible actions", () => {
  it("confirms the click route before the server runs the handler", async () => {
    const { store, ledger } = mount("/");
    await click(screen.getByRole("button", { name: "Send" }));
    const dialog = await confirmDialog();
    expect(dialog.getAttribute("data-rex-confirm")).toBe("portfolio/send");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(
      within(dialog).getByRole("button", { name: "Confirm Send" }),
    );
    expect(await audited(ledger)).toEqual([]);
    expect(store.get("portfolio")).toBeNull();
    await click(within(dialog).getByRole("button", { name: "Confirm Send" }));
    await waitOutcome(store, "send", true);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(await audited(ledger)).toEqual(["send:ok"]);
  });

  it("cancels on the cancel control and on Escape without calling the server", async () => {
    const { store, ledger } = mount("/");
    await click(screen.getByRole("button", { name: "Send" }));
    await click(within(await confirmDialog()).getByRole("button", { name: "Cancel" }));
    await waitOutcome(store, "send", false);
    expect(store.get("portfolio")?.message).toBe("Send cancelled");
    store.clear("portfolio");
    await click(screen.getByRole("button", { name: "Send" }));
    const dialog = await confirmDialog();
    await act(async () => {
      fireEvent.keyDown(dialog, { key: "Escape" });
    });
    await waitOutcome(store, "send", false);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(await audited(ledger)).toEqual([]);
  });

  it("confirms the shortcut route", async () => {
    const { store, ledger } = mount("/");
    await press({ key: "Enter", ctrlKey: true });
    const dialog = await confirmDialog();
    expect(await audited(ledger)).toEqual([]);
    await click(within(dialog).getByRole("button", { name: "Confirm Send" }));
    await waitOutcome(store, "send", true);
    expect(await audited(ledger)).toEqual(["send:ok"]);
  });

  it("confirms the palette route", async () => {
    const { store, ledger } = mount("/");
    const palette = await openPalette();
    await search(palette, "send");
    await enter(palette);
    const dialog = await confirmDialog();
    expect(await audited(ledger)).toEqual([]);
    await click(within(dialog).getByRole("button", { name: "Confirm Send" }));
    await waitOutcome(store, "send", true);
    expect(store.get("portfolio")?.message).toBe("Send succeeded");
    expect(await audited(ledger)).toEqual(["send:ok"]);
  });

  it("confirms the URL route", async () => {
    const input = encodeURIComponent(JSON.stringify({ to: "carol", amount: "3" }));
    const { store, ledger } = mount(`/?act=send&input=${input}`);
    const dialog = await confirmDialog();
    expect(dialog.textContent).toContain('{"to":"carol","amount":"3"}');
    expect(await audited(ledger)).toEqual([]);
    await click(within(dialog).getByRole("button", { name: "Confirm Send" }));
    await waitOutcome(store, "send", true);
    expect(await audited(ledger)).toEqual(["send:ok"]);
  });
});
