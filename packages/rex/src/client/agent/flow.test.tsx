import { ORPCError } from "@orpc/client";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import * as core from "../../index.ts";
import { action } from "../../core/action.ts";
import { actor, type Actor } from "../../core/actor.ts";
import { flow } from "../../core/flow.ts";
import { memoryJournal } from "../../core/journal.ts";
import { page } from "../../core/page.ts";
import { always, can } from "../../core/policy.ts";
import { createRegistry } from "../../core/registry.ts";
import { money, text, z } from "../../core/schema.ts";
import { buildManifest } from "../../manifest/build.ts";
import { validateSidecar, type SidecarPayload } from "../../manifest/sidecar.schema.ts";
import { memoryLedger } from "../../server/audit.ts";
import { mountFlows } from "../../server/flow.ts";
import { createRexServer } from "../../server/index.ts";
import { createRexApp, type RexFetch } from "../app.tsx";
import { createOutcomeStore, OutcomeProvider, type OutcomeStore } from "../outcome.ts";
import { definePageModules, view, type PageModuleSet } from "../page.tsx";
import { Shell, ShellOutcome, type OutcomeSlotProps } from "../shell.tsx";
import { ConfirmProvider, PageInvokers } from "./confirm.tsx";
import { FlowClientProvider, createFlowClient, useFlow, type FlowClient } from "./flow.tsx";
import { RexPalette } from "./palette.tsx";
import {
  AffordanceRegistryProvider,
  RexSidecar,
  createAffordanceRegistry,
  readSidecar,
} from "./sidecar.tsx";

const charged: string[] = [];

const prepare = action("prepare", {
  input: z.object({ amount: money() }),
  output: z.object({ amount: money() }),
  policy: always(),
  effect: "reversible",
  handler: (input) => ({ amount: input.amount }),
});

const charge = action("charge", {
  input: z.object({ amount: money() }),
  output: z.object({ receipt: text() }),
  policy: always(),
  effect: "irreversible",
  handler: (input) => {
    charged.push(input.amount);
    return { receipt: `r-${input.amount}` };
  },
});

let journal = memoryJournal();

function payoutFlow() {
  return flow("payout", {
    journal,
    steps: [
      { action: prepare, input: () => ({ amount: "12" }) },
      { approval: "review", label: "Review payout", approvers: can("approve") },
      {
        action: charge,
        input: (ctx) => ({ amount: (ctx.outputs[0] as { amount: string }).amount }),
      },
    ],
  });
}

const approver = actor({ id: "approver", permissions: ["approve"] });
const clerk = actor({ id: "clerk" });

interface Mounted {
  readonly store: OutcomeStore;
  readonly client: FlowClient;
}

function mount(subject: Actor, instance: string): Mounted {
  const payout = payoutFlow();
  function Payout() {
    const handle = useFlow(payout, instance);
    return (
      <div>
        <p data-testid="status">
          {handle.state === null ? "unknown" : handle.state.status}
          {handle.gate === null ? "" : ` at ${handle.gate.label}`}
        </p>
        <button type="button" onClick={() => void handle.start({ note: "weekly" })}>
          Start payout
        </button>
        {handle.approveProps === null ? null : (
          <button type="button" {...handle.approveProps}>
            Approve
          </button>
        )}
        {handle.rejectProps === null ? null : (
          <button type="button" {...handle.rejectProps}>
            Reject
          </button>
        )}
      </div>
    );
  }
  const payouts = page("payouts", { route: "/", states: ["ready"] });
  const registry = createRegistry().register(prepare, charge, payout, payouts).freeze();
  const manifest = buildManifest(registry);
  const pages: readonly PageModuleSet[] = [
    definePageModules({ page: payouts, view: view(() => <Payout />), states: {} }),
  ];
  const server = createRexServer({ registry, ledger: memoryLedger(), actor: () => subject });
  mountFlows(server, { flows: [payout], actor: () => subject });
  const fetch: RexFetch = async (input, init) =>
    server.fetch(input instanceof Request ? input : new Request(input, init));
  const client = createFlowClient({ baseUrl: "http://rex.test", fetch });
  const RexApp = createRexApp({
    registry,
    manifest,
    actor: subject,
    fetch,
    baseUrl: "http://rex.test",
  });
  const store = createOutcomeStore();
  function Slot({ page: pageId }: OutcomeSlotProps) {
    return (
      <PageInvokers>
        <ShellOutcome page={pageId} />
        <RexSidecar />
        <RexPalette />
      </PageInvokers>
    );
  }
  const memory = memoryLocation({ path: "/" });
  render(
    <OutcomeProvider store={store}>
      <AffordanceRegistryProvider registry={createAffordanceRegistry()}>
        <FlowClientProvider client={client}>
          <RexApp>
            <Router hook={memory.hook}>
              <ConfirmProvider>
                <Shell pages={pages} outcome={Slot} />
              </ConfirmProvider>
            </Router>
          </RexApp>
        </FlowClientProvider>
      </AffordanceRegistryProvider>
    </OutcomeProvider>,
  );
  return { store, client };
}

function sidecar(): SidecarPayload {
  const result = validateSidecar(readSidecar(document));
  if (!result.valid) throw new Error(JSON.stringify(result.issues));
  return result.payload;
}

async function status(text: string) {
  await waitFor(() => expect(screen.getByTestId("status").textContent).toBe(text));
}

async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

async function pause() {
  await status("idle");
  await click(screen.getByRole("button", { name: "Start payout" }));
  await status("paused at Review payout");
}

beforeEach(() => {
  journal = memoryJournal();
  charged.length = 0;
});

afterEach(() => {
  cleanup();
});

describe("core entry exports", () => {
  it("exports flow, the journal, runFlow and decide", () => {
    expect(core.flow).toBe(flow);
    expect(core.memoryJournal).toBe(memoryJournal);
    expect(typeof core.runFlow).toBe("function");
    expect(typeof core.decide).toBe("function");
    expect(typeof core.FlowDecisionError).toBe("function");
    expect(typeof core.isJournal).toBe("function");
  });
});

describe("useFlow", () => {
  it("pauses at the approval gate and exposes approve and reject in the sidecar and palette", async () => {
    mount(approver, "p-1");
    await pause();
    expect(charged).toEqual([]);
    const actions = sidecar().actions;
    expect(actions).toEqual([
      {
        id: "payout.review.approve",
        label: "Approve Review payout",
        allowed: true,
        reason: null,
        effect: "irreversible",
        input: { type: "object", properties: {}, additionalProperties: false },
        via: ["click", "palette"],
      },
      {
        id: "payout.review.reject",
        label: "Reject Review payout",
        allowed: true,
        reason: null,
        effect: "irreversible",
        input: { type: "object", properties: {}, additionalProperties: false },
        via: ["click", "palette"],
      },
    ]);
    expect(screen.getByRole("button", { name: "Approve" }).getAttribute("data-rex")).toBe(
      "payouts/payout.review.approve",
    );
    expect(screen.getByRole("button", { name: "Reject" }).getAttribute("data-rex")).toBe(
      "payouts/payout.review.reject",
    );
    await act(async () => {
      fireEvent.keyDown(window, { key: "k", code: "KeyK", ctrlKey: true });
    });
    const palette = screen.getByRole("dialog", { name: "Command palette" });
    expect(
      within(palette)
        .getAllByRole("option")
        .map((o) => o.getAttribute("data-value")),
    ).toEqual(["action:payout.review.approve", "action:payout.review.reject", "page:payouts"]);
  });

  it("resumes the flow on approve after confirmation", async () => {
    const { store } = mount(approver, "p-2");
    await pause();
    await click(screen.getByRole("button", { name: "Approve" }));
    const dialog = await waitFor(() =>
      screen.getByRole("alertdialog", { name: "Confirm Approve Review payout" }),
    );
    expect(charged).toEqual([]);
    await click(within(dialog).getByRole("button", { name: "Confirm Approve Review payout" }));
    await status("completed");
    expect(charged).toEqual(["12"]);
    expect(store.get("payouts")).toMatchObject({
      actionId: "payout.review.approve",
      ok: true,
      message: "Approve Review payout succeeded; flow completed",
    });
    await waitFor(() => expect(sidecar().actions).toEqual([]));
    expect(sidecar().outcome).toMatchObject({ action: "payout.review.approve", ok: true });
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("terminates the flow on reject chosen from the palette", async () => {
    const { store } = mount(approver, "p-3");
    await pause();
    await act(async () => {
      fireEvent.keyDown(window, { key: "k", code: "KeyK", ctrlKey: true });
    });
    const palette = screen.getByRole("dialog", { name: "Command palette" });
    await act(async () => {
      fireEvent.change(within(palette).getByRole("combobox"), { target: { value: "reject" } });
    });
    await act(async () => {
      fireEvent.keyDown(within(palette).getByRole("combobox"), { key: "Enter" });
    });
    const dialog = await waitFor(() =>
      screen.getByRole("alertdialog", { name: "Confirm Reject Review payout" }),
    );
    await click(within(dialog).getByRole("button", { name: "Confirm Reject Review payout" }));
    await status("rejected");
    expect(charged).toEqual([]);
    expect(store.get("payouts")).toMatchObject({ actionId: "payout.review.reject", ok: true });
    await waitFor(() => expect(sidecar().actions).toEqual([]));
  });

  it("shows the gate as not allowed for an actor outside the approvers and the server refuses", async () => {
    const { client } = mount(clerk, "p-4");
    await pause();
    const actions = sidecar().actions;
    expect(actions.map((entry) => [entry.id, entry.allowed, entry.reason])).toEqual([
      ["payout.review.approve", false, "missing-permission:approve"],
      ["payout.review.reject", false, "missing-permission:approve"],
    ]);
    const approve = screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
    let refused: unknown = null;
    try {
      await client.decide({ flow: "payout", instance: "p-4", decision: "approve" });
    } catch (error) {
      refused = error;
    }
    expect(refused).toBeInstanceOf(ORPCError);
    expect((refused as ORPCError<string, unknown>).code).toBe("FORBIDDEN");
    expect(await client.status({ flow: "payout", instance: "p-4" })).toEqual({
      flow: "payout",
      instance: "p-4",
      status: "paused",
      gate: { id: "review", label: "Review payout" },
      completed: 1,
    });
    expect(charged).toEqual([]);
  });
});
