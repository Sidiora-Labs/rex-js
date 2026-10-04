import { ORPCError, createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { action } from "../core/action.ts";
import { actor, anonymousActor, type Actor } from "../core/actor.ts";
import { RexError } from "../core/errors.ts";
import { flow, type AnyFlow } from "../core/flow.ts";
import { memoryJournal } from "../core/journal.ts";
import { always, can } from "../core/policy.ts";
import { createRegistry } from "../core/registry.ts";
import { money, text } from "../core/schema.ts";
import { z } from "zod/mini";
import { AUDIT_OK, DIGEST_PATTERN, digest, memoryLedger, type Ledger } from "./audit.ts";
import { createRexServer } from "./app.ts";
import {
  FLOW_DECISION_EFFECT,
  FLOW_RPC_PREFIX,
  buildFlowRouter,
  gateActionId,
  mountFlows,
  type FlowRouter,
} from "./flow.ts";

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

const actors: Record<string, Actor> = {
  approver: actor({ id: "approver", permissions: ["approve"] }),
  signer: actor({ id: "signer", permissions: ["approve", "sign"] }),
  clerk: actor({ id: "clerk" }),
};

function resolveActor(request: Request): Actor {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  return actors[bearer] ?? anonymousActor;
}

function payoutFlow(): AnyFlow {
  return flow("payout", {
    journal: memoryJournal(),
    steps: [
      { action: prepare, input: () => ({ amount: "12" }) },
      { approval: "review", label: "Review payout", approvers: can("approve") },
      { approval: "sign-off", label: "Sign off payout", approvers: can("sign") },
      {
        action: charge,
        input: (ctx) => ({ amount: (ctx.outputs[0] as { amount: string }).amount }),
      },
    ],
  });
}

interface Served {
  readonly ledger: Ledger;
  readonly payout: AnyFlow;
  readonly as: (name: string) => RouterClient<FlowRouter>;
}

function client(app: Hono, name: string): RouterClient<FlowRouter> {
  return createORPCClient(
    new RPCLink({
      url: `http://rex.test${FLOW_RPC_PREFIX}`,
      headers: { authorization: `Bearer ${name}`, origin: "http://rex.test" },
      fetch: async (request) => app.fetch(request),
    }),
  );
}

function serve(): Served {
  const payout = payoutFlow();
  const ledger = memoryLedger();
  const registry = createRegistry().register(prepare, charge, payout).freeze();
  const app = createRexServer({ registry, ledger, actor: resolveActor });
  return { ledger, payout, as: (name) => client(app, name) };
}

async function rejection(promise: Promise<unknown>): Promise<ORPCError<string, unknown>> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ORPCError);
    return error as ORPCError<string, unknown>;
  }
  throw new Error("expected the call to be refused");
}

async function decisionDigest(instance: string, gate: string, decision: "approve" | "reject") {
  return digest({ flow: "payout", instance, gate, decision });
}

beforeEach(() => {
  charged.length = 0;
});

describe("flow decision audit records", () => {
  it("writes one record per approval with the gate id and decision and none for start or status", async () => {
    const { ledger, as } = serve();
    const before = Date.now();
    expect(await as("approver").start({ flow: "payout", instance: "a-1" })).toMatchObject({
      status: "paused",
      gate: { id: "review", label: "Review payout" },
    });
    await as("approver").status({ flow: "payout", instance: "a-1" });
    expect(await ledger.list()).toEqual([]);

    expect(
      await as("approver").decide({ flow: "payout", instance: "a-1", decision: "approve" }),
    ).toMatchObject({ status: "paused", gate: { id: "sign-off" } });
    expect(
      await as("signer").decide({ flow: "payout", instance: "a-1", decision: "approve" }),
    ).toMatchObject({ status: "completed", gate: null, completed: 4 });
    expect(charged).toEqual(["12"]);

    const records = await ledger.list();
    expect(records.map((record) => [record.actor, record.actionId, record.outcome])).toEqual([
      ["approver", "payout.review.approve", AUDIT_OK],
      ["signer", "payout.sign-off.approve", AUDIT_OK],
    ]);
    expect(records[0]?.inputDigest).toBe(await decisionDigest("a-1", "review", "approve"));
    expect(records[1]?.inputDigest).toBe(await decisionDigest("a-1", "sign-off", "approve"));
    for (const record of records) {
      expect(record.effect).toBe(FLOW_DECISION_EFFECT);
      expect(record.effect).toBe("irreversible");
      expect(record.inputDigest).toMatch(DIGEST_PATTERN);
      expect(Number.isFinite(record.durationMs)).toBe(true);
      expect(record.durationMs).toBeGreaterThanOrEqual(0);
      const at = Date.parse(record.at);
      expect(at).toBeGreaterThanOrEqual(before);
      expect(at).toBeLessThanOrEqual(Date.now());
    }
  });

  it("records a rejection with the rejected gate and runs no further step", async () => {
    const { ledger, payout, as } = serve();
    await as("approver").start({ flow: "payout", instance: "r-1" });
    expect(
      await as("approver").decide({ flow: "payout", instance: "r-1", decision: "reject" }),
    ).toMatchObject({ status: "rejected", gate: null, completed: 1 });
    expect(charged).toEqual([]);
    const records = await ledger.list({ actionId: gateActionId(payout, "review", "reject") });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      actor: "approver",
      actionId: "payout.review.reject",
      inputDigest: await decisionDigest("r-1", "review", "reject"),
      outcome: AUDIT_OK,
      effect: "irreversible",
    });
    expect(await ledger.list({ actionId: "payout.review.approve" })).toEqual([]);
  });

  it("records a refused decision with the FORBIDDEN outcome and leaves the gate pending", async () => {
    const { ledger, as } = serve();
    await as("approver").start({ flow: "payout", instance: "f-1" });
    const refused = await rejection(
      as("clerk").decide({ flow: "payout", instance: "f-1", decision: "approve" }),
    );
    expect(refused.code).toBe("FORBIDDEN");
    expect(await as("clerk").status({ flow: "payout", instance: "f-1" })).toMatchObject({
      status: "paused",
      gate: { id: "review" },
    });
    expect(await ledger.list({ outcome: "error" })).toMatchObject([
      {
        actor: "clerk",
        actionId: "payout.review.approve",
        inputDigest: await decisionDigest("f-1", "review", "approve"),
        outcome: "FORBIDDEN",
        effect: "irreversible",
      },
    ]);
    await as("approver").decide({ flow: "payout", instance: "f-1", decision: "approve" });
    expect(
      (await ledger.list({ actionId: "payout.review.approve" })).map((record) => [
        record.actor,
        record.outcome,
      ]),
    ).toEqual([
      ["clerk", "FORBIDDEN"],
      ["approver", AUDIT_OK],
    ]);
  });

  it("writes no record when there is no pending gate to decide", async () => {
    const { ledger, as } = serve();
    const idle = await rejection(
      as("approver").decide({ flow: "payout", instance: "n-1", decision: "approve" }),
    );
    expect(idle.code).toBe("CONFLICT");
    await as("approver").start({ flow: "payout", instance: "n-2" });
    await as("approver").decide({ flow: "payout", instance: "n-2", decision: "reject" });
    const closed = await rejection(
      as("approver").decide({ flow: "payout", instance: "n-2", decision: "approve" }),
    );
    expect(closed.code).toBe("CONFLICT");
    const unknown = await rejection(
      as("approver").decide({ flow: "missing", instance: "n-3", decision: "approve" }),
    );
    expect(unknown.code).toBe("NOT_FOUND");
    expect((await ledger.list()).map((record) => record.actionId)).toEqual([
      "payout.review.reject",
    ]);
  });

  it("writes decisions to the ledger given to mountFlows", async () => {
    const payout = payoutFlow();
    const ledger = memoryLedger();
    const app = mountFlows(new Hono(), { flows: [payout], actor: resolveActor, ledger });
    await client(app, "approver").start({ flow: "payout", instance: "m-1" });
    await client(app, "approver").decide({ flow: "payout", instance: "m-1", decision: "approve" });
    expect(await ledger.list()).toMatchObject([
      {
        actor: "approver",
        actionId: "payout.review.approve",
        inputDigest: await decisionDigest("m-1", "review", "approve"),
        outcome: AUDIT_OK,
      },
    ]);
  });

  it("names gate actions as flow.gate.decision", () => {
    const payout = payoutFlow();
    expect(gateActionId(payout, "review", "approve")).toBe("payout.review.approve");
    expect(gateActionId(payout, "sign-off", "reject")).toBe("payout.sign-off.reject");
  });

  it("refuses to build or mount the flow router without a ledger", () => {
    const payout = payoutFlow();
    const missing = {} as Ledger;
    expect(() => buildFlowRouter([payout], missing)).toThrow(
      new RexError("REX400", "buildFlowRouter: ledger must implement append and list"),
    );
    expect(() =>
      mountFlows(new Hono(), { flows: [payout], actor: resolveActor, ledger: missing }),
    ).toThrow(new RexError("REX400", "mountFlows: ledger must implement append and list"));
  });
});
