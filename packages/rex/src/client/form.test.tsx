import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { action } from "../core/action.ts";
import { actor } from "../core/actor.ts";
import { page } from "../core/page.ts";
import { always } from "../core/policy.ts";
import { createRegistry } from "../core/registry.ts";
import { boolean, enumOf, integer, money, text } from "../core/schema.ts";
import { z } from "zod/mini";
import { buildManifest } from "../manifest/build.ts";
import { AUDIT_OK, memoryLedger, type Ledger } from "../server/audit.ts";
import { createRexServer } from "../server/index.ts";
import {
  OUTCOME_COOKIE,
  OutcomeRegion,
  encodeOutcomeCookie,
  parseOutcomeCookie,
  readCookie,
} from "./agent/outcome.tsx";
import { createRexApp, type RexFetch } from "./app.tsx";
import {
  ACTION_FIELD,
  ActionForm,
  CSRF_COOKIE,
  CSRF_FIELD,
  CsrfTokenContext,
  formActionPath,
} from "./form.tsx";
import { createOutcomeStore, OutcomeProvider, type OutcomeStore } from "./outcome.ts";
import { definePageModules, region, view, type PageModuleSet } from "./page.tsx";
import { RexProviders } from "./providers.ts";
import { Shell } from "./shell.tsx";

const received: unknown[] = [];

const transfer = action("transfer", {
  input: z.object({
    amount: money(),
    memo: text({ max: 40 }).optional(),
    express: boolean(),
    count: integer({ min: 1 }),
    tier: enumOf(["basic", "priority"]),
    to: z.object({ name: text({ min: 1 }) }),
  }),
  output: z.object({ amount: money(), count: integer() }),
  policy: always(),
  effect: "reversible",
  label: "Transfer",
  handler: (input) => {
    received.push(input);
    return { amount: input.amount, count: input.count };
  },
});

const wipe = action("wipe", {
  input: z.object({ reason: text({ min: 1 }) }),
  output: z.object({ wiped: boolean() }),
  policy: always(),
  effect: "irreversible",
  label: "Wipe",
  handler: (input) => {
    received.push(input);
    return { wiped: true };
  },
});

const payments = page("payments", {
  route: "/",
  actions: [transfer, wipe],
  regions: ["main"],
  states: ["ready"],
});

const Main = region("main", () => (
  <>
    <ActionForm action={transfer} defaultValues={{ memo: "rent" }} />
    <ActionForm action={wipe} />
  </>
));

const pages: readonly PageModuleSet[] = [
  definePageModules({
    page: payments,
    view: view(() => <Main />),
    states: {},
    regions: { main: Main },
  }),
];

const registry = createRegistry().register(transfer, wipe, payments).freeze();
const manifest = buildManifest(registry);
const owner = actor({ id: "owner" });

interface Mounted {
  readonly ledger: Ledger;
  readonly store: OutcomeStore;
  readonly history: readonly string[];
}

function mount(csrf: string | null = null): Mounted {
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
  const memory = memoryLocation({ path: "/", record: true });
  const shell = (
    <OutcomeProvider store={store}>
      <RexApp>
        <Router hook={memory.hook}>
          <RexProviders>
            <Shell pages={pages} outcome={OutcomeRegion} />
          </RexProviders>
        </Router>
      </RexApp>
    </OutcomeProvider>
  );
  render(
    csrf === null ? (
      shell
    ) : (
      <CsrfTokenContext.Provider value={csrf}>{shell}</CsrfTokenContext.Provider>
    ),
  );
  return { ledger, store, history: memory.history ?? [] };
}

function form(name: string): HTMLFormElement {
  return screen.getByRole("form", { name }) as HTMLFormElement;
}

function named(owner: HTMLFormElement, name: string): HTMLInputElement {
  const element = owner.querySelector(`[name="${name}"]`);
  if (element === null) throw new Error(`no control named ${name}`);
  return element as HTMLInputElement;
}

function outcomeText(): string {
  return screen.getByRole("status", { name: "Outcome" }).textContent ?? "";
}

function fill(owner: HTMLFormElement, values: Readonly<Record<string, string>>) {
  for (const [name, value] of Object.entries(values)) {
    fireEvent.change(named(owner, name), { target: { value } });
  }
}

async function submit(owner: HTMLFormElement) {
  await act(async () => {
    const name = owner.getAttribute("aria-label") ?? "";
    fireEvent.click(within(owner).getByRole("button", { name }));
  });
}

afterEach(() => {
  cleanup();
  received.length = 0;
  document.cookie = `${CSRF_COOKIE}=; Path=/; Max-Age=0`;
  document.cookie = `${OUTCOME_COOKIE}=; Path=/; Max-Age=0`;
});

describe("ActionForm", () => {
  it("renders a real form posting to the form route with CSRF, action and schema fields", () => {
    mount();
    const transferForm = form("Transfer");
    expect(transferForm.getAttribute("method")).toBe("post");
    expect(transferForm.getAttribute("action")).toBe("/rex/form/transfer");
    expect(formActionPath("transfer")).toBe("/rex/form/transfer");
    expect(transferForm.getAttribute("data-rex-form")).toBe("payments/transfer");

    const csrf = named(transferForm, CSRF_FIELD);
    expect(csrf.type).toBe("hidden");
    expect(csrf.value).toMatch(/^[0-9a-f]{64}$/);
    expect(readCookie(CSRF_COOKIE, document.cookie)).toBe(csrf.value);
    expect(named(form("Wipe"), CSRF_FIELD).value).toBe(csrf.value);
    const actionField = named(transferForm, ACTION_FIELD);
    expect(actionField.type).toBe("hidden");
    expect(actionField.value).toBe("transfer");

    const amount = named(transferForm, "amount");
    expect(amount.type).toBe("text");
    expect(amount.getAttribute("inputmode")).toBe("decimal");
    expect(amount.required).toBe(true);
    expect(screen.getByLabelText("Amount")).toBe(amount);
    const memo = named(transferForm, "memo");
    expect(memo.required).toBe(false);
    expect(memo.maxLength).toBe(40);
    expect(memo.value).toBe("rent");
    const express = named(transferForm, "express");
    expect(express.type).toBe("checkbox");
    expect(express.value).toBe("true");
    expect(express.checked).toBe(false);
    const count = named(transferForm, "count");
    expect(count.type).toBe("number");
    expect(count.getAttribute("step")).toBe("1");
    expect(count.getAttribute("min")).toBe("1");
    const tier = named(transferForm, "tier") as unknown as HTMLSelectElement;
    expect(tier.tagName).toBe("SELECT");
    expect([...tier.options].map((option) => option.value)).toEqual(["basic", "priority"]);
    const recipient = named(transferForm, "to.name");
    expect(recipient.type).toBe("text");
    expect(recipient.required).toBe(true);
    expect(recipient.minLength).toBe(1);
    expect(
      [...transferForm.querySelectorAll("[data-rex-field]")].map((row) =>
        row.getAttribute("data-rex-field"),
      ),
    ).toEqual(["amount", "memo", "express", "count", "tier", "to.name"]);

    const button = within(transferForm).getByRole("button", { name: "Transfer" });
    expect(button.getAttribute("type")).toBe("submit");
    expect(button.getAttribute("data-rex")).toBe("payments/transfer");
    expect(button.getAttribute("data-rex-allowed")).toBe("true");
  });

  it("uses a CSRF token provided by the server render instead of minting one", () => {
    mount("server-token");
    expect(named(form("Transfer"), CSRF_FIELD).value).toBe("server-token");
    expect(readCookie(CSRF_COOKIE, document.cookie)).toBeNull();
  });

  it("intercepts the submit with JavaScript and runs the action over RPC", async () => {
    const { ledger, history } = mount();
    const transferForm = form("Transfer");
    fill(transferForm, { amount: "12.50", count: "3", tier: "priority", "to.name": "Ada" });
    fireEvent.click(named(transferForm, "express"));
    await submit(transferForm);
    await waitFor(() => expect(outcomeText()).toContain("Transfer: Succeeded"));
    expect(outcomeText()).toContain("Transfer succeeded");
    expect(received).toEqual([
      {
        amount: "12.50",
        memo: "rent",
        express: true,
        count: 3,
        tier: "priority",
        to: { name: "Ada" },
      },
    ]);
    const records = await ledger.list({ actionId: "transfer" });
    expect(records).toHaveLength(1);
    expect(records[0]?.outcome).toBe(AUDIT_OK);
    expect(history).toEqual(["/"]);
    expect(transferForm.querySelectorAll("[data-rex-field-error]")).toHaveLength(0);
  });

  it("asks for confirmation before running an irreversible action from its form", async () => {
    const { ledger } = mount();
    const wipeForm = form("Wipe");
    fill(wipeForm, { reason: "cleanup" });
    await submit(wipeForm);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.getAttribute("data-rex-confirm")).toBe("payments/wipe");
    expect(received).toEqual([]);
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Confirm Wipe" }));
    });
    await waitFor(() => expect(outcomeText()).toContain("Wipe: Succeeded"));
    expect(received).toEqual([{ reason: "cleanup" }]);
    expect(await ledger.list({ actionId: "wipe" })).toHaveLength(1);
  });

  it("shows field errors next to the fields when the input fails the schema", async () => {
    const { ledger } = mount();
    const transferForm = form("Transfer");
    fill(transferForm, { amount: "12,5", count: "2", tier: "basic", "to.name": "" });
    await submit(transferForm);
    await waitFor(() => expect(outcomeText()).toContain("Transfer: Failed"));
    expect(outcomeText()).toContain("Transfer: invalid input");
    const amountError = transferForm.querySelector(
      '[data-rex-field="amount"] [data-rex-field-error="amount"]',
    );
    expect(amountError?.textContent).not.toBe("");
    const amount = named(transferForm, "amount");
    expect(amount.getAttribute("aria-invalid")).toBe("true");
    expect(amount.getAttribute("aria-describedby")).toBe(amountError?.id);
    expect(
      transferForm.querySelector('[data-rex-field="to.name"] [data-rex-field-error="to.name"]'),
    ).not.toBeNull();
    expect(
      transferForm.querySelector('[data-rex-field="count"] [data-rex-field-error]'),
    ).toBeNull();
    expect(received).toEqual([]);
    expect(await ledger.list({ actionId: "transfer" })).toHaveLength(0);

    fill(transferForm, { amount: "12.5", "to.name": "Ada" });
    await submit(transferForm);
    await waitFor(() => expect(outcomeText()).toContain("Transfer: Succeeded"));
    expect(transferForm.querySelectorAll("[data-rex-field-error]")).toHaveLength(0);
    expect(amount.getAttribute("aria-invalid")).toBeNull();
  });

  it("shows the outcome and field errors from a rex-outcome cookie, then clears it", async () => {
    const at = new Date().toISOString();
    document.cookie = `${OUTCOME_COOKIE}=${encodeOutcomeCookie({
      actionId: "transfer",
      ok: false,
      message: "Transfer: invalid input: amount must be a decimal amount",
      at,
      code: "BAD_REQUEST",
      fields: {
        amount: ["must be a decimal amount"],
        "to.name": ["is required", "must not be blank"],
        _form: ["check the form"],
      },
    })}; Path=/`;
    const { store } = mount();
    const transferForm = form("Transfer");
    await waitFor(() =>
      expect(
        transferForm.querySelector('[data-rex-field="amount"] [data-rex-field-error="amount"]')
          ?.textContent,
      ).toBe("must be a decimal amount"),
    );
    expect(
      transferForm.querySelector('[data-rex-field="to.name"] [data-rex-field-error="to.name"]')
        ?.textContent,
    ).toBe("is required; must not be blank");
    expect(transferForm.querySelector('[data-rex-form-errors="transfer"]')?.textContent).toBe(
      "check the form",
    );
    expect(named(transferForm, "amount").getAttribute("aria-invalid")).toBe("true");
    expect(form("Wipe").querySelectorAll("[data-rex-field-error]")).toHaveLength(0);
    expect(outcomeText()).toContain("Transfer: Failed");
    expect(outcomeText()).toContain("Transfer: invalid input: amount must be a decimal amount");
    expect(store.get("payments")?.at).toBe(at);
    expect(readCookie(OUTCOME_COOKIE, document.cookie)).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Dismiss the Transfer outcome" }));
    });
    expect(transferForm.querySelectorAll("[data-rex-field-error]")).toHaveLength(0);
    expect(named(transferForm, "amount").getAttribute("aria-invalid")).toBeNull();
  });

  it("shows a successful cookie outcome once and ignores a malformed cookie", async () => {
    const at = new Date().toISOString();
    document.cookie = `${OUTCOME_COOKIE}=${encodeOutcomeCookie({
      actionId: "wipe",
      ok: true,
      message: "Wipe succeeded",
      at,
      code: null,
      fields: {},
    })}; Path=/`;
    mount();
    await waitFor(() => expect(outcomeText()).toContain("Wipe: Succeeded"));
    expect(readCookie(OUTCOME_COOKIE, document.cookie)).toBeNull();
    cleanup();

    document.cookie = `${OUTCOME_COOKIE}=${encodeURIComponent("{not json")}; Path=/`;
    mount();
    await waitFor(() => expect(readCookie(OUTCOME_COOKIE, document.cookie)).toBeNull());
    expect(outcomeText()).toBe("No action has run on this page yet.");
    const malformed = { actionId: "wipe", ok: "yes" };
    expect(parseOutcomeCookie(encodeURIComponent(JSON.stringify(malformed)))).toBeNull();
    const flat = { actionId: "wipe", ok: true, message: "done", at, code: null, fields: { a: "x" } };
    expect(parseOutcomeCookie(encodeURIComponent(JSON.stringify(flat)))).toBeNull();
  });
});
