import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { action } from "../../core/action.ts";
import { actor } from "../../core/actor.ts";
import { page } from "../../core/page.ts";
import { always } from "../../core/policy.ts";
import { RESERVED_QUERY_KEYS } from "../../core/protocol.ts";
import { createRegistry } from "../../core/registry.ts";
import { boolean } from "../../schema/index.ts";
import { z } from "zod/mini";
import { buildManifest } from "../../manifest/build.ts";
import { memoryLedger, type Ledger } from "../../server/audit.ts";
import { createRexServer } from "../../server/index.ts";
import { createRexApp, type RexFetch } from "../app.tsx";
import {
  APP_OUTCOME_KEY,
  createOutcomeStore,
  OutcomeProvider,
  type OutcomeStore,
} from "../outcome.ts";
import { definePageModules, view, type PageModuleSet } from "../page.tsx";
import { Shell, ShellOutcome, type OutcomeSlotProps } from "../shell.tsx";
import { ConfirmProvider, PageInvokers } from "./confirm.tsx";
import {
  ACT_QUERY_KEY,
  INPUT_QUERY_KEY,
  RexUrlInvoke,
  parseUrlInvocation,
  withoutInvocation,
} from "./url-invoke.ts";

const hideDust = action("hide-dust", {
  input: z.object({ hide: boolean().default(true) }),
  output: z.object({ hide: boolean() }),
  policy: always(),
  effect: "reversible",
  label: "Hide dust",
  handler: (input) => ({ hide: input.hide }),
});

const portfolio = page("portfolio", { route: "/", actions: [hideDust], states: ["ready"] });
const about = page("about", { route: "/about", states: ["ready"] });

function AgentSlot({ page: pageId }: OutcomeSlotProps) {
  return (
    <PageInvokers>
      <ShellOutcome page={pageId} />
      <RexUrlInvoke />
    </PageInvokers>
  );
}

const pages: readonly PageModuleSet[] = [
  definePageModules({ page: portfolio, view: view(() => <p>Portfolio view</p>), states: {} }),
  definePageModules({ page: about, view: view(() => <p>About Rex</p>), states: {} }),
];

const registry = createRegistry().register(hideDust, portfolio, about).freeze();
const manifest = buildManifest(registry);
const owner = actor({ id: "owner" });

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

function json(value: unknown): string {
  return encodeURIComponent(JSON.stringify(value));
}

async function audited(ledger: Ledger): Promise<string[]> {
  return (await ledger.list()).map((record) => `${record.actionId}:${record.outcome}`);
}

async function waitOutcome(store: OutcomeStore, actionId: string, ok: boolean) {
  await waitFor(() => expect(store.get("portfolio")).toMatchObject({ actionId, ok }));
}

afterEach(() => {
  cleanup();
});

describe("URL invocation parsing", () => {
  it("reads the reserved act and input keys", () => {
    expect(RESERVED_QUERY_KEYS).toContain(ACT_QUERY_KEY);
    expect(RESERVED_QUERY_KEYS).toContain(INPUT_QUERY_KEY);
    expect(parseUrlInvocation("")).toBeNull();
    expect(parseUrlInvocation("tab=1&input=%7B%7D")).toBeNull();
    expect(parseUrlInvocation("?act=send")).toEqual({ ok: true, action: "send", input: {} });
    expect(parseUrlInvocation("act=send&input=")).toEqual({ ok: true, action: "send", input: {} });
    expect(parseUrlInvocation(`act=send&input=${json({ to: "x", amount: "2" })}`)).toEqual({
      ok: true,
      action: "send",
      input: { to: "x", amount: "2" },
    });
    expect(parseUrlInvocation(`act=send&input=${json([1])}`)).toEqual({
      ok: true,
      action: "send",
      input: [1],
    });
    expect(parseUrlInvocation("act=send&input=%7Bnope")).toEqual({
      ok: false,
      action: "send",
      error: "the input parameter is not valid JSON",
    });
  });

  it("strips the invocation keys and keeps the other params", () => {
    expect(withoutInvocation("tab=1&act=send&input=%7B%7D&zoom=2")).toBe("tab=1&zoom=2");
    expect(withoutInvocation("act=send")).toBe("");
    expect(withoutInvocation("?act=send&q=rex")).toBe("q=rex");
    expect(withoutInvocation("")).toBe("");
  });
});

describe("useUrlInvoke", () => {
  it("invokes with the parsed input once and rewrites the URL keeping the other params", async () => {
    const { store, ledger, memory } = mount(
      `/?tab=all&act=hide-dust&input=${json({ hide: false })}`,
    );
    await waitOutcome(store, "hide-dust", true);
    expect(store.get("portfolio")?.message).toBe("Hide dust succeeded");
    expect(await audited(ledger)).toEqual(["hide-dust:ok"]);
    expect(memory.history).toEqual(["/?tab=all"]);
    expect(screen.getByText("Portfolio view")).toBeTruthy();
  });

  it("invokes again when the invocation is navigated to a second time", async () => {
    const { store, ledger, memory } = mount("/?act=hide-dust");
    await waitOutcome(store, "hide-dust", true);
    expect(memory.history).toEqual(["/"]);
    store.clear("portfolio");
    await act(async () => {
      memory.navigate("/?act=hide-dust");
    });
    await waitOutcome(store, "hide-dust", true);
    expect(await audited(ledger)).toEqual(["hide-dust:ok", "hide-dust:ok"]);
    expect(memory.history).toEqual(["/", "/"]);
  });

  it("records input problems against the declared action without calling the server", async () => {
    const first = mount("/?act=hide-dust&input=%7Bnope");
    await waitOutcome(first.store, "hide-dust", false);
    expect(first.store.get("portfolio")?.message).toBe(
      "Hide dust: invalid input: the input parameter is not valid JSON",
    );
    expect(await audited(first.ledger)).toEqual([]);
    expect(first.memory.history).toEqual(["/"]);
    cleanup();
    const second = mount(`/?act=hide-dust&input=${json({ hide: "yes" })}`);
    await waitOutcome(second.store, "hide-dust", false);
    expect(second.store.get("portfolio")?.message).toMatch(/^Hide dust: invalid input: hide /);
    expect(await audited(second.ledger)).toEqual([]);
  });

  it("routes an action the page does not declare to the page invokers", async () => {
    const { store, ledger, memory } = mount("/?act=nope&input=%7Bnope");
    await waitOutcome(store, "nope", false);
    expect(store.get("portfolio")?.message).toBe('page "portfolio" declares no action "nope"');
    expect(await audited(ledger)).toEqual([]);
    expect(memory.history).toEqual(["/"]);
  });

  it("stays inert without an active page", async () => {
    const { store, ledger, memory } = mount("/nowhere?act=hide-dust");
    await act(async () => {});
    expect(memory.history).toEqual(["/nowhere?act=hide-dust"]);
    expect(store.get("portfolio")).toBeNull();
    expect(store.get(APP_OUTCOME_KEY)).toBeNull();
    expect(await audited(ledger)).toEqual([]);
  });

  it("throws REX306 outside PageInvokers", () => {
    const original = console.error;
    console.error = () => {};
    try {
      expect(() => render(<RexUrlInvoke />)).toThrow(
        "REX306 rex: palette, shortcuts and URL invocation must render inside PageInvokers",
      );
    } finally {
      console.error = original;
    }
  });
});
