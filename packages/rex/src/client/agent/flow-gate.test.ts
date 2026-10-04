import { beforeEach, describe, expect, it } from "vitest";
import { action } from "../../core/action.ts";
import { actor, type Actor } from "../../core/actor.ts";
import { flow, type AnyFlow, type ApprovalStep } from "../../core/flow.ts";
import { actionAddress } from "../../core/ids.ts";
import { memoryJournal } from "../../core/journal.ts";
import { page } from "../../core/page.ts";
import { always, can, evaluate } from "../../core/policy.ts";
import type { FlowState } from "../../core/protocol.ts";
import { createRegistry } from "../../core/registry.ts";
import { money, text } from "../../schema/index.ts";
import { z } from "zod/mini";
import { memoryLedger, type Ledger } from "../../server/audit.ts";
import { createRexServer } from "../../server/app.ts";
import { describeError } from "../act.ts";
import type { RexFetch } from "../app.tsx";
import { createOutcomeStore, type OutcomeStore } from "../outcome.ts";
import type { ConfirmRequest } from "./confirm.tsx";
import { createFlowClient, gateAffordanceId, gateLabel, type FlowClient } from "./flow.tsx";
import {
  confirmFlowDecision,
  decideFlow,
  flowAffordances,
  gateControlProps,
  type FlowGateContext,
  type FlowGateNames,
} from "./flow-gate.ts";

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

const payouts = page("payouts", { route: "/", states: ["ready"] });
const approver = actor({ id: "approver", permissions: ["approve"] });
const clerk = actor({ id: "clerk" });

const names: FlowGateNames = {
  affordanceId: gateAffordanceId,
  label: gateLabel,
  address: actionAddress,
  describe: describeError,
};

const EMPTY_INPUT = { type: "object", properties: {}, additionalProperties: false };

interface Calls {
  readonly states: FlowState[];
  readonly pending: boolean[];
  readonly errors: (string | null)[];
}

interface Harness {
  readonly payout: AnyFlow;
  readonly gate: ApprovalStep;
  readonly client: FlowClient;
  readonly ledger: Ledger;
  readonly outcomes: OutcomeStore;
  readonly calls: Calls;
  context(overrides?: Partial<FlowGateContext>): FlowGateContext;
}

function harness(subject: Actor, instanceId: string): Harness {
  const payout = flow("payout", {
    journal: memoryJournal(),
    steps: [
      { action: prepare, input: () => ({ amount: "12" }) },
      { approval: "review", label: "Review payout", approvers: can("approve") },
      {
        action: charge,
        input: (ctx) => ({ amount: (ctx.outputs[0] as { amount: string }).amount }),
      },
    ],
  });
  const gate = payout.steps.find((step): step is ApprovalStep => step.kind === "approval");
  if (gate === undefined) throw new Error("the payout flow declares the review gate");
  const registry = createRegistry().register(prepare, charge, payout, payouts).freeze();
  const ledger = memoryLedger();
  const server = createRexServer({ registry, ledger, actor: () => subject });
  const fetch: RexFetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    if (request.method !== "GET" && !request.headers.has("origin")) {
      request.headers.set("origin", new URL(request.url).origin);
    }
    return server.fetch(request);
  };
  const client = createFlowClient({ baseUrl: "http://rex.test", fetch });
  const outcomes = createOutcomeStore();
  const calls: Calls = { states: [], pending: [], errors: [] };
  const decision = evaluate(gate.approvers, subject);
  return {
    payout,
    gate,
    client,
    ledger,
    outcomes,
    calls,
    context: (overrides = {}) => ({
      declared: payout,
      instanceId,
      client,
      outcomes,
      pageId: "payouts",
      outcomeKey: "payouts",
      names,
      gate,
      decision,
      setState: (next) => {
        calls.states.push(next);
      },
      setPending: (pending) => {
        calls.pending.push(pending);
      },
      setError: (error) => {
        calls.errors.push(error);
      },
      ...overrides,
    }),
  };
}

async function pause(h: Harness, instanceId: string): Promise<void> {
  const state = await h.client.start({ flow: "payout", instance: instanceId });
  expect(state).toMatchObject({ status: "paused", gate: { id: "review", label: "Review payout" } });
}

async function audited(ledger: Ledger): Promise<string[]> {
  return (await ledger.list()).map((record) => `${record.actionId}:${record.outcome}`);
}

beforeEach(() => {
  charged.length = 0;
});

describe("decideFlow", () => {
  it("reports CONFLICT without calling the server when the flow is not paused at a gate", async () => {
    const h = harness(approver, "p-1");
    const result = await decideFlow(h.context({ gate: null }), "approve");
    expect(result).toEqual({
      ok: false,
      code: "CONFLICT",
      message: 'flow "payout" is not paused at a gate',
    });
    expect(h.outcomes.get("payouts")).toBeNull();
    expect(h.calls).toEqual({ states: [], pending: [], errors: [] });
    expect(await audited(h.ledger)).toEqual([]);
  });

  it("refuses locally and records the reason when the actor may not decide", async () => {
    const h = harness(clerk, "p-2");
    await pause(h, "p-2");
    const result = await decideFlow(h.context(), "reject");
    const message = "Reject Review payout: not allowed (missing-permission:approve)";
    expect(result).toEqual({ ok: false, code: "FORBIDDEN", message });
    expect(h.outcomes.get("payouts")).toMatchObject({
      actionId: "payout.review.reject",
      ok: false,
      message,
    });
    expect(h.calls).toEqual({ states: [], pending: [], errors: [] });
    expect(await audited(h.ledger)).toEqual([]);
    expect(await h.client.status({ flow: "payout", instance: "p-2" })).toMatchObject({
      status: "paused",
    });
  });

  it("decides through the flow client, publishes the new state and records success", async () => {
    const h = harness(approver, "p-3");
    await pause(h, "p-3");
    const result = await decideFlow(h.context(), "approve");
    const completed: FlowState = {
      flow: "payout",
      instance: "p-3",
      status: "completed",
      gate: null,
      completed: 3,
    };
    expect(result).toEqual({ ok: true, state: completed });
    expect(charged).toEqual(["12"]);
    expect(h.calls).toEqual({ states: [completed], pending: [true, false], errors: [null] });
    expect(h.outcomes.get("payouts")).toMatchObject({
      actionId: "payout.review.approve",
      ok: true,
      message: "Approve Review payout succeeded; flow completed",
    });
    expect(await audited(h.ledger)).toEqual(["payout.review.approve:ok"]);
  });

  it("surfaces the server refusal when the local decision disagrees with the server", async () => {
    const h = harness(clerk, "p-4");
    await pause(h, "p-4");
    const result = await decideFlow(
      h.context({ decision: { allowed: true, reason: null } }),
      "approve",
    );
    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
    const message = result.ok ? "" : result.message;
    expect(message).toContain('actor "clerk" may not decide gate "review"');
    expect(h.calls).toEqual({ states: [], pending: [true, false], errors: [message] });
    expect(h.outcomes.get("payouts")).toMatchObject({
      actionId: "payout.review.approve",
      ok: false,
      message: `Approve Review payout failed: ${message}`,
    });
    expect(await audited(h.ledger)).toEqual(["payout.review.approve:FORBIDDEN"]);
    expect(charged).toEqual([]);
  });

  it("reports the server's CONFLICT when the instance has no pending approval", async () => {
    const h = harness(approver, "p-5");
    const result = await decideFlow(h.context(), "approve");
    expect(result).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(result.ok ? "" : result.message).toContain('flow "payout" has no instance "p-5"');
    expect(h.calls.pending).toEqual([true, false]);
    expect(h.calls.states).toEqual([]);
    expect(h.outcomes.get("payouts")).toMatchObject({
      actionId: "payout.review.approve",
      ok: false,
    });
  });
});

describe("confirmFlowDecision", () => {
  it("decides directly without asking when no gate is pending", async () => {
    const h = harness(approver, "p-6");
    const asked: ConfirmRequest[] = [];
    const context = h.context({ gate: null });
    const result = await confirmFlowDecision(
      context,
      async (request) => {
        asked.push(request);
        return true;
      },
      "approve",
      (choice) => decideFlow(context, choice),
    );
    expect(asked).toEqual([]);
    expect(result).toMatchObject({ ok: false, code: "CONFLICT" });
  });

  it("records CANCELLED and leaves the flow paused when the confirmation is declined", async () => {
    const h = harness(approver, "p-7");
    await pause(h, "p-7");
    const asked: ConfirmRequest[] = [];
    const context = h.context();
    const result = await confirmFlowDecision(
      context,
      async (request) => {
        asked.push(request);
        return false;
      },
      "reject",
      (choice) => decideFlow(context, choice),
    );
    expect(asked).toEqual([
      {
        page: "payouts",
        action: {
          id: "payout.review.reject",
          label: "Reject Review payout",
          effect: "irreversible",
        },
        input: {},
      },
    ]);
    expect(result).toEqual({
      ok: false,
      code: "CANCELLED",
      message: "Reject Review payout cancelled",
    });
    expect(h.outcomes.get("payouts")).toMatchObject({
      actionId: "payout.review.reject",
      ok: false,
      message: "Reject Review payout cancelled",
    });
    expect(h.calls).toEqual({ states: [], pending: [], errors: [] });
    expect(await h.client.status({ flow: "payout", instance: "p-7" })).toMatchObject({
      status: "paused",
    });
  });

  it("runs the decision once the confirmation is accepted", async () => {
    const h = harness(approver, "p-8");
    await pause(h, "p-8");
    const context = h.context();
    const result = await confirmFlowDecision(context, async () => true, "reject", (choice) =>
      decideFlow(context, choice),
    );
    expect(result).toMatchObject({ ok: true, state: { status: "rejected", gate: null } });
    expect(charged).toEqual([]);
    expect(await audited(h.ledger)).toEqual(["payout.review.reject:ok"]);
  });
});

describe("flowAffordances", () => {
  it("is empty without a pending gate or a policy decision", () => {
    const h = harness(approver, "p-9");
    const decide = () => decideFlow(h.context(), "approve");
    expect(flowAffordances(h.context({ gate: null }), decide)).toEqual([]);
    expect(flowAffordances(h.context({ decision: null }), decide)).toEqual([]);
  });

  it("describes approve and reject as irreversible affordances that delegate to decide", async () => {
    const h = harness(approver, "p-10");
    await pause(h, "p-10");
    const entries = flowAffordances(h.context(), (choice) => decideFlow(h.context(), choice));
    expect(
      entries.map((entry) => ({
        id: entry.id,
        label: entry.label,
        allowed: entry.allowed,
        reason: entry.reason,
        effect: entry.effect,
        input: entry.input,
        via: entry.via,
      })),
    ).toEqual([
      {
        id: "payout.review.approve",
        label: "Approve Review payout",
        allowed: true,
        reason: null,
        effect: "irreversible",
        input: EMPTY_INPUT,
        via: ["click", "palette"],
      },
      {
        id: "payout.review.reject",
        label: "Reject Review payout",
        allowed: true,
        reason: null,
        effect: "irreversible",
        input: EMPTY_INPUT,
        via: ["click", "palette"],
      },
    ]);
    const [approve] = entries;
    expect(await approve?.invoke({})).toMatchObject({ ok: true, state: { status: "completed" } });
    expect(charged).toEqual(["12"]);
  });

  it("carries the denial reason for actors outside the approvers", () => {
    const h = harness(clerk, "p-11");
    const entries = flowAffordances(h.context(), (choice) => decideFlow(h.context(), choice));
    expect(entries.map((entry) => [entry.id, entry.allowed, entry.reason])).toEqual([
      ["payout.review.approve", false, "missing-permission:approve"],
      ["payout.review.reject", false, "missing-permission:approve"],
    ]);
  });
});

describe("gateControlProps", () => {
  it("is null without a page, a gate or a decision", () => {
    const h = harness(approver, "p-12");
    const ignore = () => {};
    expect(gateControlProps(h.context({ pageId: null }), "approve", false, ignore)).toBeNull();
    expect(gateControlProps(h.context({ gate: null }), "approve", false, ignore)).toBeNull();
    expect(gateControlProps(h.context({ decision: null }), "approve", false, ignore)).toBeNull();
  });

  it("addresses the control, mirrors the decision and forwards clicks", () => {
    const h = harness(approver, "p-13");
    const decided: string[] = [];
    const props = gateControlProps(h.context(), "approve", false, (choice) => {
      decided.push(choice);
    });
    expect(props).toMatchObject({
      "data-rex": "payouts/payout.review.approve",
      "data-rex-allowed": "true",
      disabled: false,
      "aria-disabled": false,
    });
    expect(props !== null && "title" in props).toBe(false);
    props?.onClick();
    expect(decided).toEqual(["approve"]);
    const busy = gateControlProps(h.context(), "reject", true, (choice) => {
      decided.push(choice);
    });
    expect(busy).toMatchObject({
      "data-rex": "payouts/payout.review.reject",
      "data-rex-allowed": "true",
      disabled: true,
      "aria-disabled": true,
    });
  });

  it("disables and explains the control when the actor may not decide", () => {
    const h = harness(clerk, "p-14");
    const props = gateControlProps(h.context(), "reject", false, () => {});
    expect(props).toMatchObject({
      "data-rex-allowed": "false",
      disabled: true,
      "aria-disabled": true,
      title: "Not allowed: missing-permission:approve",
    });
  });
});
