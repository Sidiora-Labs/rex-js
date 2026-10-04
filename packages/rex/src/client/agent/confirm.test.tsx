import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { action, type AnyAction } from "../../core/action.ts";
import { actor, type Actor } from "../../core/actor.ts";
import { page } from "../../core/page.ts";
import { always, never, policy } from "../../core/policy.ts";
import { createRegistry } from "../../core/registry.ts";
import { boolean, money, text } from "../../schema/index.ts";
import { z } from "zod/mini";
import { buildManifest } from "../../manifest/build.ts";
import { memoryLedger, type Ledger } from "../../server/audit.ts";
import { createRexServer } from "../../server/index.ts";
import type { ActResult } from "../act.ts";
import { createRexApp, type RexFetch } from "../app.tsx";
import {
  APP_OUTCOME_KEY,
  createOutcomeStore,
  OutcomeProvider,
  type OutcomeStore,
} from "../outcome.ts";
import { definePageModules, view, type PageModuleSet } from "../page.tsx";
import { Shell, ShellOutcome, type OutcomeSlotProps } from "../shell.tsx";
import {
  CANCELLED,
  ConfirmProvider,
  PageInvokers,
  UNKNOWN_ACTION,
  useConfirm,
  useInvoke,
  usePageInvokers,
  type ConfirmRequest,
} from "./confirm.tsx";

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
  handler: (input) => ({ hide: input.hide }),
});

const send = action("send", {
  input: z.object({ to: text({ min: 1 }).default("bob"), amount: money().default("1") }),
  output: z.object({ txId: text() }),
  policy: wallet.can("send"),
  effect: "irreversible",
  label: "Send",
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
  const purging = useInvoke(purge);
  const [result, setResult] = useState("none");
  const show = (pending: Promise<ActResult<AnyAction>>) => {
    void pending.then((settled) => setResult(JSON.stringify(settled)));
  };
  return (
    <div>
      <p data-testid="result">{result}</p>
      <button
        type="button"
        {...hide.controlProps}
        onClick={() => show(hide.invoke({ hide: true }))}
      >
        Hide dust
      </button>
      <button type="button" {...sending.controlProps} onClick={() => show(sending.invoke({}))}>
        Send
      </button>
      <button type="button" onClick={() => show(sending.invoke({ to: "", amount: "1" }))}>
        Send nowhere
      </button>
      <button type="button" onClick={() => show(purging.invoke({}))}>
        Purge
      </button>
    </div>
  );
}

function Probe() {
  const invokers = usePageInvokers();
  const [result, setResult] = useState("none");
  const [declared, setDeclared] = useState("unread");
  useEffect(() => {
    const has = (id: string) => String(invokers.has(id));
    setDeclared(`send=${has("send")} nope=${has("nope")}`);
  }, [invokers]);
  const run = (id: string) => {
    void invokers.invoke(id, {}).then((settled) => setResult(JSON.stringify(settled)));
  };
  return (
    <div>
      <p data-testid="invokers">{`page=${String(invokers.page)} ${declared}`}</p>
      <p data-testid="invoked">{result}</p>
      <button type="button" onClick={() => run("hide-dust")}>
        Run hide-dust
      </button>
      <button type="button" onClick={() => run("nope")}>
        Run nope
      </button>
      <button type="button" onClick={() => run("")}>
        Run nothing
      </button>
    </div>
  );
}

function AgentSlot({ page: pageId }: OutcomeSlotProps) {
  return (
    <PageInvokers>
      <ShellOutcome page={pageId} />
      <Probe />
    </PageInvokers>
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
const clerk = actor({ id: "clerk" });

interface Mounted {
  readonly ledger: Ledger;
  readonly store: OutcomeStore;
}

function mount(path: string, serverActor: Actor = owner): Mounted {
  const ledger = memoryLedger();
  const server = createRexServer({ registry, ledger, actor: () => serverActor });
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
  const memory = memoryLocation({ path });
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
  return { ledger, store };
}

function Asker({
  page: pageId,
  record,
}: {
  readonly page: string | null;
  readonly record: (entry: string) => void;
}) {
  const confirm = useConfirm();
  const ask = (request: ConfirmRequest) => {
    void confirm(request).then((accepted) => record(`${request.action.id}:${String(accepted)}`));
  };
  return (
    <div>
      <button type="button" onClick={() => ask({ page: pageId, action: hideDust, input: {} })}>
        Ask hide
      </button>
      <button
        type="button"
        onClick={() => ask({ page: pageId, action: send, input: { to: "carol" } })}
      >
        Ask send
      </button>
    </div>
  );
}

function mountAsker(pageId: string | null) {
  const log: string[] = [];
  const mounted = render(
    <ConfirmProvider>
      <Asker page={pageId} record={(entry) => log.push(entry)} />
    </ConfirmProvider>,
  );
  return { log, unmount: mounted.unmount };
}

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

async function audited(ledger: Ledger): Promise<string[]> {
  return (await ledger.list()).map((record) => `${record.actionId}:${record.outcome}`);
}

function result(): string | null {
  return screen.getByTestId("result").textContent;
}

function silenced(run: () => void): void {
  const original = console.error;
  console.error = () => {};
  try {
    run();
  } finally {
    console.error = original;
  }
}

afterEach(() => {
  cleanup();
});

describe("ConfirmProvider and useConfirm", () => {
  it("resolves at once for actions that are not irreversible", async () => {
    const { log } = mountAsker("portfolio");
    await click(screen.getByRole("button", { name: "Ask hide" }));
    await waitFor(() => expect(log).toEqual(["hide-dust:true"]));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("asks through the dialog for an irreversible action and resolves with the choice", async () => {
    const { log } = mountAsker("portfolio");
    await click(screen.getByRole("button", { name: "Ask send" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Confirm Send" });
    expect(dialog.getAttribute("data-rex-confirm")).toBe("portfolio/send");
    expect(dialog.textContent).toContain('{"to":"carol"}');
    await click(within(dialog).getByRole("button", { name: "Confirm Send" }));
    await waitFor(() => expect(log).toEqual(["send:true"]));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await click(screen.getByRole("button", { name: "Ask send" }));
    const again = await screen.findByRole("alertdialog", { name: "Confirm Send" });
    await click(within(again).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(log).toEqual(["send:true", "send:false"]));
  });

  it("addresses the dialog by the action id alone when no page is active", async () => {
    mountAsker(null);
    await click(screen.getByRole("button", { name: "Ask send" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Confirm Send" });
    expect(dialog.getAttribute("data-rex-confirm")).toBe("send");
  });

  it("declines the previous request when a new one arrives and when the provider unmounts", async () => {
    const { log, unmount } = mountAsker("portfolio");
    await click(screen.getByRole("button", { name: "Ask send" }));
    await screen.findByRole("alertdialog", { name: "Confirm Send" });
    await click(screen.getByRole("button", { name: "Ask send" }));
    await waitFor(() => expect(log).toEqual(["send:false"]));
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
    unmount();
    await waitFor(() => expect(log).toEqual(["send:false", "send:false"]));
  });

  it("restores focus to the opener once the request settles", async () => {
    mountAsker("portfolio");
    const opener = screen.getByRole("button", { name: "Ask send" });
    opener.focus();
    await click(opener);
    const dialog = await screen.findByRole("alertdialog", { name: "Confirm Send" });
    expect(document.activeElement).toBe(
      within(dialog).getByRole("button", { name: "Confirm Send" }),
    );
    await click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(document.activeElement).toBe(opener);
  });

  it("throws REX306 from useConfirm outside a ConfirmProvider", () => {
    function Outside() {
      useConfirm();
      return null;
    }
    silenced(() => {
      expect(() => render(<Outside />)).toThrow(
        "REX306 rex: irreversible actions need a ConfirmProvider above the shell",
      );
    });
  });
});

describe("useInvoke", () => {
  it("runs a reversible action without confirmation", async () => {
    const { ledger, store } = mount("/");
    await click(screen.getByRole("button", { name: "Hide dust" }));
    await waitFor(() =>
      expect(result()).toBe(JSON.stringify({ ok: true, output: { hide: true } })),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(store.get("portfolio")).toMatchObject({
      actionId: "hide-dust",
      ok: true,
      message: "Hide dust succeeded",
    });
    expect(await audited(ledger)).toEqual(["hide-dust:ok"]);
  });

  it("confirms an irreversible action, fetches a token and runs with it", async () => {
    const { ledger, store } = mount("/");
    await click(screen.getByRole("button", { name: "Send" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Confirm Send" });
    expect(await audited(ledger)).toEqual([]);
    await click(within(dialog).getByRole("button", { name: "Confirm Send" }));
    await waitFor(() =>
      expect(result()).toBe(JSON.stringify({ ok: true, output: { txId: "tx-bob-1" } })),
    );
    expect(store.get("portfolio")?.message).toBe("Send succeeded");
    expect(await audited(ledger)).toEqual(["send:ok"]);
  });

  it("returns CANCELLED and records the outcome when the dialog is dismissed", async () => {
    const { ledger, store } = mount("/");
    await click(screen.getByRole("button", { name: "Send" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Confirm Send" });
    await click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(result()).toBe(
        JSON.stringify({ ok: false, code: CANCELLED, message: "Send cancelled" }),
      ),
    );
    expect(store.get("portfolio")).toMatchObject({
      actionId: "send",
      ok: false,
      message: "Send cancelled",
    });
    expect(await audited(ledger)).toEqual([]);
  });

  it("skips the dialog and answers from run for invalid input and disallowed actions", async () => {
    const { ledger, store } = mount("/");
    await click(screen.getByRole("button", { name: "Send nowhere" }));
    await waitFor(() => expect(result()).toContain('"code":"BAD_REQUEST"'));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(store.get("portfolio")?.message).toMatch(/^Send: invalid input: to /);
    await click(screen.getByRole("button", { name: "Purge" }));
    await waitFor(() =>
      expect(result()).toBe(
        JSON.stringify({ ok: false, code: "FORBIDDEN", message: "Purge: not allowed (never)" }),
      ),
    );
    expect(await audited(ledger)).toEqual([]);
  });

  it("records the confirm procedure failure when the server refuses the token", async () => {
    const { ledger, store } = mount("/", clerk);
    await click(screen.getByRole("button", { name: "Send" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Confirm Send" });
    await click(within(dialog).getByRole("button", { name: "Confirm Send" }));
    const refusal = 'action "send" is forbidden: missing-permission:send';
    await waitFor(() =>
      expect(result()).toBe(JSON.stringify({ ok: false, code: "FORBIDDEN", message: refusal })),
    );
    expect(store.get("portfolio")?.message).toBe(`Send failed: ${refusal}`);
    expect(await audited(ledger)).toEqual([]);
  });
});

describe("PageInvokers", () => {
  it("exposes the active page's actions and runs them through useInvoke", async () => {
    const { ledger, store } = mount("/");
    await waitFor(() =>
      expect(screen.getByTestId("invokers").textContent).toBe(
        "page=portfolio send=true nope=false",
      ),
    );
    await click(screen.getByRole("button", { name: "Run hide-dust" }));
    await waitFor(() =>
      expect(screen.getByTestId("invoked").textContent).toBe(
        JSON.stringify({ ok: true, output: { hide: true } }),
      ),
    );
    expect(store.get("portfolio")?.actionId).toBe("hide-dust");
    expect(await audited(ledger)).toEqual(["hide-dust:ok"]);
  });

  it("answers NOT_FOUND and records an outcome for an action the page does not declare", async () => {
    const { ledger, store } = mount("/");
    await click(screen.getByRole("button", { name: "Run nope" }));
    const message = 'page "portfolio" declares no action "nope"';
    await waitFor(() =>
      expect(screen.getByTestId("invoked").textContent).toBe(
        JSON.stringify({ ok: false, code: UNKNOWN_ACTION, message }),
      ),
    );
    expect(store.get("portfolio")).toMatchObject({ actionId: "nope", ok: false, message });
    await click(screen.getByRole("button", { name: "Run nothing" }));
    await waitFor(() => expect(store.get("portfolio")?.actionId).toBe("unknown"));
    expect(await audited(ledger)).toEqual([]);
  });

  it("has no actions and records app outcomes when no page is active", async () => {
    const { store } = mount("/nowhere");
    await waitFor(() =>
      expect(screen.getByTestId("invokers").textContent).toBe("page=null send=false nope=false"),
    );
    await click(screen.getByRole("button", { name: "Run nope" }));
    await waitFor(() =>
      expect(store.get(APP_OUTCOME_KEY)).toMatchObject({
        actionId: "nope",
        ok: false,
        message: 'no page is active to run "nope"',
      }),
    );
    expect(store.get("portfolio")).toBeNull();
  });

  it("throws REX306 from usePageInvokers outside PageInvokers", () => {
    function Outside() {
      usePageInvokers();
      return null;
    }
    silenced(() => {
      expect(() => render(<Outside />)).toThrow(
        "REX306 rex: palette, shortcuts and URL invocation must render inside PageInvokers",
      );
    });
  });
});
